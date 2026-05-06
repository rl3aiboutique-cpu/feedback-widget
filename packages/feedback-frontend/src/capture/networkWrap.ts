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
const _buffer: NetworkEntry[] = [];
let _capacity = DEFAULT_CAPACITY;
let _installed = false;

function _push(entry: NetworkEntry): void {
	_buffer.push(entry);
	while (_buffer.length > _capacity) _buffer.shift();
}

function _excerpt(text: string): string {
	const redacted = redactString(text);
	return redacted.length > 512
		? `${redacted.slice(0, 512)}...[truncated]`
		: redacted;
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

		if (response.status >= 400) {
			const duration = performance.now() - start;
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
		}

		return response;
	};
}

export function getNetworkTail(): NetworkEntry[] {
	return [..._buffer];
}

export function _clearForTests(): void {
	_buffer.length = 0;
	_installed = false;
}
