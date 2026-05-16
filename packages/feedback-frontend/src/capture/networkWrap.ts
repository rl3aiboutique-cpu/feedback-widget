/**
 * Network capture: ring buffer of the last N **failed** requests
 * (status >= 400 or thrown error). Patches `window.fetch` so anything
 * the SPA does — including the auto-generated SDK's axios → XHR — when
 * routed through fetch is captured. Axios in this codebase uses XHR
 * under the hood, so we also expose `recordNetworkFailure(...)` for the
 * axios interceptor to call.
 *
 * Request/response bodies are NOT captured — only the URL, method,
 * status, duration, and a short response excerpt that's been run
 * through the same redactor as console messages. Headers other than
 * status are dropped on purpose; they leak too easily.
 */

import { redactString } from "../redactors";

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  response_excerpt: string;
  timestamp: string;
}

const DEFAULT_CAPACITY = 20;
// Slow-success buffer (v0.4.1). Independent ring so successful-but-
// slow requests don't push genuine failures out of the failure tail.
const DEFAULT_SUCCESS_CAPACITY = 30;
// Threshold (ms) above which a 2xx response is recorded as a "slow
// success". Calibrated to ignore the noise of fast XHRs while still
// catching the API hiccups admins care about.
const SLOW_SUCCESS_THRESHOLD_MS = 1000;

const _buffer: NetworkEntry[] = [];
const _success_buffer: NetworkEntry[] = [];
let _capacity = DEFAULT_CAPACITY;
const _success_capacity = DEFAULT_SUCCESS_CAPACITY;
let _installed = false;

function _push(entry: NetworkEntry): void {
  _buffer.push(entry);
  while (_buffer.length > _capacity) _buffer.shift();
}

function _pushSuccess(entry: NetworkEntry): void {
  _success_buffer.push(entry);
  while (_success_buffer.length > _success_capacity) _success_buffer.shift();
}

function _excerpt(text: string): string {
  const redacted = redactString(text);
  return redacted.length > 512 ? `${redacted.slice(0, 512)}...[truncated]` : redacted;
}

export function recordNetworkFailure(entry: NetworkEntry): void {
  _push({ ...entry, response_excerpt: _excerpt(entry.response_excerpt) });
}

export function installNetworkWrap(capacity: number = DEFAULT_CAPACITY): void {
  if (_installed || typeof window === "undefined") return;
  _capacity = capacity;
  _installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const start = performance.now();
    const method = (init?.method ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input.toString();

    let response: Response;
    try {
      response = await originalFetch(input, init);
    } catch (err) {
      const duration = performance.now() - start;
      _push({
        method,
        url,
        status: 0,
        duration_ms: Math.round(duration),
        response_excerpt: _excerpt(String(err)),
        timestamp: new Date().toISOString(),
      });
      throw err;
    }

    const duration = performance.now() - start;

    if (response.status >= 400) {
      let excerpt = "";
      try {
        // Clone so the original consumer can still read the body.
        excerpt = await response.clone().text();
      } catch {
        excerpt = "(no body)";
      }
      _push({
        method,
        url,
        status: response.status,
        duration_ms: Math.round(duration),
        response_excerpt: _excerpt(excerpt),
        timestamp: new Date().toISOString(),
      });
    } else if (duration >= SLOW_SUCCESS_THRESHOLD_MS) {
      // Slow-success bucket: 2xx/3xx that took longer than the
      // threshold. We don't read the body — admins want the timing
      // signal, not the payload.
      _pushSuccess({
        method,
        url,
        status: response.status,
        duration_ms: Math.round(duration),
        response_excerpt: "",
        timestamp: new Date().toISOString(),
      });
    }

    return response;
  };
}

export function getNetworkTail(): NetworkEntry[] {
  return [..._buffer];
}

export function getNetworkSuccessTail(): NetworkEntry[] {
  return [..._success_buffer];
}

export function _clearForTests(): void {
  _buffer.length = 0;
  _success_buffer.length = 0;
  _installed = false;
}
