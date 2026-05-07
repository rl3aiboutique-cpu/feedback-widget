/**
 * Frontend defense-in-depth filter for jargon-leaking iter cards.
 *
 * Mirrors the backend `FEEDBACK_ITER_FORBIDDEN_WORDS` default list.
 * The server-side scrubber is the real enforcement layer; this is a
 * belt for the brace — when (rarely) an assumption slips past the
 * server filter, the focus view hides it locally and emits one
 * `console.warn` for the dev. Soft fail; never blocks the round.
 *
 * Hosts can override the active list via `FeedbackProvider`'s
 * optional `iterForbiddenWords` config; when omitted the default
 * here applies.
 */

export const defaultForbiddenWords: readonly string[] = [
  // Networking / API
  "endpoint",
  "api",
  "async",
  "asynchronous",
  "synchronous",
  "backend",
  "frontend",
  "middleware",
  "webhook",
  "callback",
  "listener",
  "observer",
  "subscriber",
  "dispatcher",
  "websocket",
  "polling",
  "streaming",
  "sse",
  "grpc",
  "http",
  "rest",
  // Caching / perf
  "cache",
  "debounce",
  "throttle",
  "ttl",
  "latency",
  "throughput",
  "bandwidth",
  "payload",
  "gzip",
  "encoding",
  "parsing",
  "serialization",
  "deserialization",
  // Auth / security
  "jwt",
  "oauth",
  "csrf",
  "xss",
  "sql injection",
  // Storage / data
  "json",
  "yaml",
  "schema",
  "database",
  "migration",
  "foreign key",
  "sql",
  "orm",
  "dao",
  // Concurrency
  "race condition",
  "mutex",
  "queue",
  "thread",
  "promise",
  "coroutine",
  "event loop",
  // Frontend internals
  "dom",
  "css",
  "html",
  "query selector",
  "lifecycle",
  "hydration",
  "ssr",
  "csr",
  "prop",
  "hook",
  "ref",
  // Build / deploy
  "dependency",
  "package",
  "library",
  "module",
  "config file",
  "env var",
  "environment variable",
  "build",
  "bundle",
  "deploy",
  "ci",
  "cd",
  "pipeline",
  "container",
  "kernel",
  "syscall",
];

let _cachedRegex: RegExp | null = null;
let _cachedKey: string | null = null;

function _buildRegex(words: readonly string[]): RegExp {
  // Sort longest first so multi-word phrases match before their
  // single-word substrings. Word-boundary lookarounds avoid matching
  // mid-identifier (so "API" matches "the API", not "rapid").
  const sorted = [...words]
    .filter((w) => w?.trim())
    .map((w) => w.trim().toLowerCase())
    .sort((a, b) => b.length - a.length);
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![A-Za-z0-9])(?:${escaped.join("|")})(?![A-Za-z0-9])`, "i");
}

/** True if any forbidden word appears in `text` as a whole token. */
export function containsForbidden(text: string, words: readonly string[]): boolean {
  if (!text || words.length === 0) return false;
  const key = words.join("|");
  if (_cachedKey !== key || _cachedRegex === null) {
    _cachedRegex = _buildRegex(words);
    _cachedKey = key;
  }
  return _cachedRegex.test(text);
}
