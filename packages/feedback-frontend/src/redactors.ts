/**
 * Default + host-extensible string redactors.
 *
 * Every string value in the metadata bundle (console tail, network tail,
 * breadcrumbs, etc.) flows through `applyRedactors` before it leaves the
 * browser. The server-side redactor in `app/feedback/redaction.py` is
 * the second line of defence; this module is the first.
 *
 * The default list intentionally mirrors the server-side patterns so a
 * value scrubbed here doesn't trigger a different replacement string
 * server-side.
 */

const _ZERO_WIDTH = "";

const _DEFAULT_PATTERNS: { re: RegExp; replace: (match: string) => string }[] =
	[
		// Authorization: Bearer xxx / Authorization: Basic xxx → keep the header,
		// wipe the value. Multiline-friendly via [^\r\n]+.
		{
			re: /(authorization\s*[:=]\s*)[^\r\n]+/gi,
			replace: (m) =>
				m.replace(/(authorization\s*[:=]\s*)[^\r\n]+/i, "$1[REDACTED]"),
		},
		// Bare bearer tokens outside a header context.
		{
			re: /\bbearer\s+[A-Za-z0-9._\-+/=]+/gi,
			replace: () => "[REDACTED]",
		},
		// JWT-shaped triples (three base64url segments separated by dots).
		{
			re: /\b[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g,
			replace: () => "[REDACTED]",
		},
		// CC-like 13–19 digit runs separated by spaces or dashes.
		{
			re: /\b(?:\d[ -]?){12,18}\d\b/g,
			replace: () => "[REDACTED]",
		},
		// OAuth-style query string tokens.
		{
			re: /\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+/gi,
			replace: (m) =>
				m.replace(
					/\b(access_token|refresh_token|id_token|api[_-]?key|secret)=[^\s&]+/i,
					"$1=[REDACTED]",
				),
		},
		// Cookie header values.
		{
			re: /(cookie\s*[:=]\s*)[^\r\n]+/gi,
			replace: (m) => m.replace(/(cookie\s*[:=]\s*)[^\r\n]+/i, "$1[REDACTED]"),
		},
	];

const _hostRedactors: ((s: string) => string)[] = [];

export function registerRedactor(fn: (s: string) => string): void {
	_hostRedactors.push(fn);
}

export function clearHostRedactors(): void {
	_hostRedactors.length = 0;
}

export function redactString(value: string): string {
	let out = value;
	for (const { re, replace } of _DEFAULT_PATTERNS) {
		out = out.replace(re, replace);
	}
	for (const fn of _hostRedactors) {
		try {
			out = fn(out);
		} catch {
			// A buggy host redactor must never crash the submit flow. Skip + continue.
		}
	}
	return out + _ZERO_WIDTH;
}

/** Recursively redact every string inside a JSON-shaped value. */
export function redactBundle<T>(value: T): T {
	if (typeof value === "string") {
		return redactString(value) as unknown as T;
	}
	if (Array.isArray(value)) {
		return value.map(redactBundle) as unknown as T;
	}
	if (value !== null && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = redactBundle(v);
		}
		return out as unknown as T;
	}
	return value;
}

/**
 * The default list of CSS selectors whose innerHTML is blacked out
 * before the screenshot is captured. Hosts add to this list via the
 * adapter (typically by registering MFA/password fields specific to
 * their app).
 */
export const DEFAULT_REDACTION_SELECTORS: readonly string[] = Object.freeze([
	'input[type="password"]',
	'input[autocomplete="one-time-code"]',
	'[data-feedback-redact="true"]',
]);
