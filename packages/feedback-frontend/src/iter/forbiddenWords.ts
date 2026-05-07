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

// v0.4.2 — tightened from the v0.4.1 list. The previous list flagged
// many words that are also legitimate non-technical English ("state",
// "index", "join", "action", "service", "controller", "hook", "ref",
// "prop", "build", "deploy", "package", "library", "module", "queue",
// "image", "streaming", "polling"). Those false positives risked
// hiding entire assumption cards from non-technical users with only
// a console.warn. Keep ONLY the unambiguous-jargon subset; the
// server-side scrubber stays as the broader enforcement layer.
export const defaultForbiddenWords: readonly string[] = [
  // Networking / API
  "endpoint",
  "asynchronous",
  "synchronous",
  "backend",
  "frontend",
  "middleware",
  "webhook",
  "websocket",
  "grpc",
  // Caching / perf
  "debounce",
  "throttle",
  "ttl",
  "gzip",
  "deserialization",
  "serialization",
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
  "migration",
  "foreign key",
  "sql",
  "orm",
  "dao",
  // Concurrency
  "race condition",
  "mutex",
  "coroutine",
  "event loop",
  // Frontend internals
  "dom",
  "query selector",
  "hydration",
  "ssr",
  "csr",
  // Build / deploy
  "config file",
  "env var",
  "environment variable",
  "ci/cd",
  "kernel",
  "syscall",
];

let _cachedRegex: RegExp | null = null;
let _cachedKey: string | null = null;

// Regex that never matches anything — used as a safe fallback when
// the words list is empty or every entry is whitespace. Without this,
// the empty-alternation `(?:)` would match at every boundary and
// hide every assumption in the focus view.
const _NEVER_MATCHES = /a^/;

function _buildRegex(words: readonly string[]): RegExp {
  // Sort longest first so multi-word phrases match before their
  // single-word substrings. Word-boundary lookarounds avoid matching
  // mid-identifier (so "API" matches "the API", not "rapid").
  const sorted = [...words]
    .filter((w) => w?.trim())
    .map((w) => w.trim().toLowerCase())
    .sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return _NEVER_MATCHES;
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  try {
    return new RegExp(`(?<![A-Za-z0-9])(?:${escaped.join("|")})(?![A-Za-z0-9])`, "i");
  } catch {
    // Pathological input (e.g. invalid Unicode) — fail safe rather
    // than crash the iter pane. The server-side scrubber is the
    // real enforcement; the frontend filter is a belt for the brace.
    return _NEVER_MATCHES;
  }
}

/** True if any forbidden word appears in `text` as a whole token. */
export function containsForbidden(text: string, words: readonly string[]): boolean {
  if (!text || words.length === 0) return false;
  const key = words.join("|");
  if (_cachedKey !== key || _cachedRegex === null) {
    _cachedRegex = _buildRegex(words);
    _cachedKey = key;
  }
  try {
    return _cachedRegex.test(text);
  } catch {
    return false;
  }
}
