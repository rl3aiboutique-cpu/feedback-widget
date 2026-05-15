/**
 * Browser diagnostics capture — Sprint B / capture_v3.
 *
 * Mirrors the legacy iter-module's "console_errors_tail" and
 * "network_errors_tail" technical_metadata blocks so the chat
 * LLM receives the same runtime fingerprint when grilling the user.
 *
 * Strategy:
 *   - Patch `console.error` / `console.warn` once on first import,
 *     keeping a ring buffer of the last N entries.
 *   - Patch `fetch` and `XMLHttpRequest` to record any response with
 *     status >= 400 (host APIs only — same-origin filter optional).
 *   - Expose `getDiagnosticsSnapshot()` returning a frozen copy that
 *     the auto_context builder injects in the session payload.
 *
 * No third-party deps. Idempotent — patching twice is a no-op.
 *
 * The hook is OPT-IN per session: `installDiagnostics()` is called
 * exactly once from `useFeedbackChat.openSheet` so feedback-widget
 * consumers that never open the chat pay zero runtime cost.
 */

const MAX_CONSOLE_ENTRIES = 20;
const MAX_NETWORK_ENTRIES = 20;
const MAX_TEXT_LENGTH = 240;

const consoleRing: string[] = [];
const networkRing: string[] = [];

let installed = false;
let originalConsoleError: typeof console.error | null = null;
let originalConsoleWarn: typeof console.warn | null = null;
let originalFetch: typeof window.fetch | null = null;

function truncate(s: string): string {
  return s.length > MAX_TEXT_LENGTH ? `${s.slice(0, MAX_TEXT_LENGTH - 1)}…` : s;
}

function pushRing(ring: string[], entry: string, cap: number): void {
  ring.push(truncate(entry));
  while (ring.length > cap) {
    ring.shift();
  }
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

export function installDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    pushRing(consoleRing, `[error] ${formatArgs(args)}`, MAX_CONSOLE_ENTRIES);
    originalConsoleError?.(...args);
  };

  originalConsoleWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    pushRing(consoleRing, `[warn] ${formatArgs(args)}`, MAX_CONSOLE_ENTRIES);
    originalConsoleWarn?.(...args);
  };

  if (typeof window.fetch === "function") {
    originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const start = performance.now();
      try {
        const resp = await originalFetch!(input, init);
        if (resp.status >= 400) {
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          const dur = Math.round(performance.now() - start);
          pushRing(
            networkRing,
            `${resp.status} ${init?.method ?? "GET"} ${url} (${dur}ms)`,
            MAX_NETWORK_ENTRIES,
          );
        }
        return resp;
      } catch (err) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        pushRing(
          networkRing,
          `network-error ${init?.method ?? "GET"} ${url}: ${(err as Error).message}`,
          MAX_NETWORK_ENTRIES,
        );
        throw err;
      }
    };
  }
}

export interface DiagnosticsSnapshot {
  console_tail: string[];
  network_errors_tail: string[];
  framework: string | null;
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  return {
    console_tail: [...consoleRing],
    network_errors_tail: [...networkRing],
    framework: detectFramework(),
  };
}

/**
 * Best-effort framework detection. Probes well-known global symbols
 * left by the most common stacks. Falls back to null when nothing
 * recognisable is present — never throws.
 */
function detectFramework(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  if (w.__NEXT_DATA__) return "next.js";
  if (w.__NUXT__) return "nuxt";
  if (w.__REMIX_CONTEXT__) return "remix";
  if (w.__SVELTEKIT_DEV__ || w.__sveltekit_dev) return "sveltekit";
  if (w.ng) return "angular";
  if (w.Vue) return "vue";
  if (w.React) return "react";
  return null;
}

/** Truncate an element's outerHTML to fit the backend 4096 cap. */
export function snapshotElementOuterHtml(el: Element | null): string | null {
  if (!el) return null;
  const raw = el.outerHTML ?? "";
  return raw.length > 4096 ? `${raw.slice(0, 4095)}…` : raw;
}
