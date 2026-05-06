/**
 * HTTP + SSE client for the Iterate-with-AI module.
 *
 * Mirrors the patterns in ../adapter.ts (CSRF + optional bearer +
 * apiBaseUrl/apiPathPrefix) but stays scoped to iter endpoints so
 * the always-loaded bundle doesn't pull in markdown rendering or
 * SSE consumer code unless the user opens the workspace.
 */

import type { FeedbackHostBindings } from "../adapter"
import type {
  IterAssumptionRead,
  IterAssumptionResolveRequest,
  IterCallRead,
  IterPackageRead,
  IterRunRequest,
  IterSessionRead,
  IterStartRequest,
  IterStreamEvent,
  IterUsageRead,
  IterVersionMarkdownEditRequest,
  IterVersionRead,
} from "./types"

export class IterApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly detail: string,
    public readonly retryAfter: string | null,
  ) {
    super(`${path} failed with ${status}`)
    this.name = "IterApiError"
  }
}

function _base(b: FeedbackHostBindings): string {
  return b.apiBaseUrl.replace(/\/$/, "")
}

function _prefix(b: FeedbackHostBindings): string {
  return b.apiPathPrefix ?? "/api/v1/feedback"
}

async function _headers(
  b: FeedbackHostBindings,
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...extra }
  try {
    const csrf = await b.getCsrfToken()
    if (csrf) out["X-CSRF-Token"] = csrf
  } catch {
    // host's broken CSRF callback shouldn't tank the request
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader()
      if (auth) out.Authorization = auth
    } catch {
      /* same — degrade gracefully */
    }
  }
  return out
}

async function _throwOn(path: string, resp: Response): Promise<never> {
  let detail: string
  try {
    const data = await resp.json()
    detail =
      typeof data === "string"
        ? data
        : data && typeof data === "object" && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : JSON.stringify(data)
  } catch {
    detail = await resp.text().catch(() => "")
  }
  throw new IterApiError(resp.status, path, detail, resp.headers.get("Retry-After"))
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for very old browsers / SSR — RFC 4122 v4 ish.
  return "k_" + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ─────────────────────────────────────────────────────────────────
// REST endpoints
// ─────────────────────────────────────────────────────────────────

export async function startIterSession(
  bindings: FeedbackHostBindings,
  body: IterStartRequest,
): Promise<IterSessionRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions`
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await _headers(bindings)) },
    body: JSON.stringify(body),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function getIterSession(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterSessionRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function abandonIterSession(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterSessionRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/abandon`
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function listIterVersions(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterVersionRead[]> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/iterations`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function getIterVersion(
  bindings: FeedbackHostBindings,
  sessionId: string,
  versionId: string,
): Promise<IterVersionRead> {
  const url =
    `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/iterations/${versionId}`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function editIterVersionMarkdown(
  bindings: FeedbackHostBindings,
  sessionId: string,
  versionId: string,
  body: IterVersionMarkdownEditRequest,
): Promise<IterVersionRead> {
  const url =
    `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}` +
    `/iterations/${versionId}/markdown`
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await _headers(bindings)) },
    body: JSON.stringify(body),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function listIterAssumptions(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterAssumptionRead[]> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/assumptions`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function resolveIterAssumption(
  bindings: FeedbackHostBindings,
  assumptionId: string,
  body: IterAssumptionResolveRequest,
): Promise<IterAssumptionRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/assumptions/${assumptionId}`
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await _headers(bindings)) },
    body: JSON.stringify(body),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function listIterCalls(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterCallRead[]> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/calls`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function finalizeIterSession(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterPackageRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/finalize`
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(await _headers(bindings)) },
    body: JSON.stringify({}),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function getIterPackage(
  bindings: FeedbackHostBindings,
  sessionId: string,
): Promise<IterPackageRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/package`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

export async function getMyIterUsage(
  bindings: FeedbackHostBindings,
): Promise<IterUsageRead> {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/usage/me`
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings),
  })
  if (!resp.ok) await _throwOn(url, resp)
  return resp.json()
}

// ─────────────────────────────────────────────────────────────────
// SSE consumer for POST /sessions/{sid}/iterations
//
// We can't use the native EventSource because it doesn't support
// custom headers (CSRF, Authorization) and only allows GET. So we
// fetch with `body` and parse the SSE bytes manually from the
// ReadableStream.
// ─────────────────────────────────────────────────────────────────

export interface RunIterationOptions {
  bindings: FeedbackHostBindings
  sessionId: string
  body: IterRunRequest
  idempotencyKey: string
  signal?: AbortSignal
  onEvent: (event: IterStreamEvent) => void
}

export async function runIterationStream(opts: RunIterationOptions): Promise<void> {
  const url =
    `${_base(opts.bindings)}${_prefix(opts.bindings)}` +
    `/iterate/sessions/${opts.sessionId}/iterations`

  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": opts.idempotencyKey,
      ...(await _headers(opts.bindings)),
    },
    body: JSON.stringify(opts.body),
  })
  if (!resp.ok) await _throwOn(url, resp)
  if (!resp.body) {
    throw new IterApiError(resp.status, url, "no response body", null)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE messages are separated by a blank line ("\n\n").
    let split = buffer.indexOf("\n\n")
    while (split !== -1) {
      const raw = buffer.slice(0, split)
      buffer = buffer.slice(split + 2)
      const evt = _parseSseFrame(raw)
      if (evt) opts.onEvent(evt)
      split = buffer.indexOf("\n\n")
    }
  }
}

function _parseSseFrame(frame: string): IterStreamEvent | null {
  // SSE comments begin with ":" — heartbeats use ": heartbeat".
  if (frame.startsWith(":")) {
    return { type: "heartbeat" }
  }
  let event: string | null = null
  let data: string | null = null
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      data = (data ?? "") + line.slice(5).trim()
    }
  }
  if (!event || data === null) return null
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>
    return { type: event as IterStreamEvent["type"], ...parsed } as IterStreamEvent
  } catch {
    return null
  }
}
