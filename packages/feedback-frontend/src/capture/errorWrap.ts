/**
 * Uncaught error capture: ring buffer of the last N `window.error` and
 * `unhandledrejection` events. Installed early (host's `main.tsx`) so
 * errors that fire before submission can land in the bundle.
 *
 * Console.error already lands in `console_tail` via `consoleWrap`, but
 * uncaught exceptions don't always go through console.error (e.g.
 * promise rejections that nothing observes). This buffer is the
 * complement: it records what the user's runtime threw without anyone
 * catching it.
 */

import { redactString } from "../redactors";

export interface ErrorEntry {
  kind: "error" | "unhandledrejection";
  message: string;
  source: string | null;
  lineno: number | null;
  colno: number | null;
  stack: string | null;
  timestamp: string;
}

const DEFAULT_CAPACITY = 20;
// Cap any single stack trace at 4KB so a runaway recursion can't blow
// the bundle. Same convention as consoleWrap's per-entry cap.
const MAX_STACK_BYTES = 4096;

const _buffer: ErrorEntry[] = [];
let _capacity = DEFAULT_CAPACITY;
let _installed = false;

function _truncStack(stack: string | undefined | null): string | null {
  if (!stack) return null;
  const redacted = redactString(stack);
  if (redacted.length > MAX_STACK_BYTES) {
    return `${redacted.slice(0, MAX_STACK_BYTES)}...[truncated]`;
  }
  return redacted;
}

function _push(entry: ErrorEntry): void {
  _buffer.push(entry);
  while (_buffer.length > _capacity) _buffer.shift();
}

export function installErrorWrap(capacity: number = DEFAULT_CAPACITY): void {
  if (_installed || typeof window === "undefined") return;
  _capacity = capacity;
  _installed = true;

  window.addEventListener("error", (ev: ErrorEvent) => {
    _push({
      kind: "error",
      message: redactString(String(ev.message ?? ev.error?.message ?? "(no message)")),
      source: ev.filename ? redactString(ev.filename) : null,
      lineno: typeof ev.lineno === "number" ? ev.lineno : null,
      colno: typeof ev.colno === "number" ? ev.colno : null,
      stack: _truncStack(ev.error?.stack),
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const reason = ev.reason as unknown;
    let message = "(no message)";
    let stack: string | null = null;
    if (reason instanceof Error) {
      message = reason.message || reason.name || message;
      stack = _truncStack(reason.stack);
    } else if (typeof reason === "string") {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        message = Object.prototype.toString.call(reason);
      }
    }
    _push({
      kind: "unhandledrejection",
      message: redactString(message),
      source: null,
      lineno: null,
      colno: null,
      stack,
      timestamp: new Date().toISOString(),
    });
  });
}

export function getErrorsTail(): ErrorEntry[] {
  return [..._buffer];
}

export function clearErrorsTail(): void {
  _buffer.length = 0;
}
