// src/client/iter.ts
var IterApiError = class extends Error {
  constructor(status, path, detail, retryAfter) {
    super(`${path} failed with ${status}`);
    this.status = status;
    this.path = path;
    this.detail = detail;
    this.retryAfter = retryAfter;
    this.name = "IterApiError";
  }
  status;
  path;
  detail;
  retryAfter;
};
function _base(b) {
  return b.apiBaseUrl.replace(/\/$/, "");
}
function _prefix(b) {
  return b.apiPathPrefix ?? "/api/v1/feedback";
}
async function _headers(b, extra = {}) {
  const out = { ...extra };
  try {
    const csrf = await b.getCsrfToken();
    if (csrf) out["X-CSRF-Token"] = csrf;
  } catch {
  }
  if (b.authHeader) {
    try {
      const auth = await b.authHeader();
      if (auth) out.Authorization = auth;
    } catch {
    }
  }
  return out;
}
async function _throwOn(path, resp) {
  let detail;
  try {
    const data = await resp.json();
    detail = typeof data === "string" ? data : data && typeof data === "object" && "detail" in data ? String(data.detail) : JSON.stringify(data);
  } catch {
    detail = await resp.text().catch(() => "");
  }
  throw new IterApiError(resp.status, path, detail, resp.headers.get("Retry-After"));
}
function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "k_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
async function startIterSession(bindings, body) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...await _headers(bindings) },
    body: JSON.stringify(body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function getIterSession(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function abandonIterSession(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/abandon`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function listIterVersions(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/iterations`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function listIterAssumptions(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/assumptions`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function resolveIterAssumption(bindings, assumptionId, body) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/assumptions/${assumptionId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...await _headers(bindings) },
    body: JSON.stringify(body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function finalizeIterSession(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/finalize`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...await _headers(bindings) },
    body: JSON.stringify({})
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function getIterPackage(bindings, sessionId) {
  const url = `${_base(bindings)}${_prefix(bindings)}/iterate/sessions/${sessionId}/package`;
  const resp = await fetch(url, {
    credentials: "include",
    headers: await _headers(bindings)
  });
  if (!resp.ok) await _throwOn(url, resp);
  return resp.json();
}
async function runIterationStream(opts) {
  const url = `${_base(opts.bindings)}${_prefix(opts.bindings)}/iterate/sessions/${opts.sessionId}/iterations`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Idempotency-Key": opts.idempotencyKey,
      ...await _headers(opts.bindings)
    },
    body: JSON.stringify(opts.body)
  });
  if (!resp.ok) await _throwOn(url, resp);
  if (!resp.body) {
    throw new IterApiError(resp.status, url, "no response body", null);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const evt = _parseSseFrame(raw);
      if (evt) opts.onEvent(evt);
      split = buffer.indexOf("\n\n");
    }
  }
}
function _parseSseFrame(frame) {
  if (frame.startsWith(":")) {
    return { type: "heartbeat" };
  }
  let event = null;
  let data = null;
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data = (data ?? "") + line.slice(5).trim();
    }
  }
  if (!event || data === null) return null;
  try {
    const parsed = JSON.parse(data);
    return { type: event, ...parsed };
  } catch {
    return null;
  }
}

export {
  IterApiError,
  newIdempotencyKey,
  startIterSession,
  getIterSession,
  abandonIterSession,
  listIterVersions,
  listIterAssumptions,
  resolveIterAssumption,
  finalizeIterSession,
  getIterPackage,
  runIterationStream
};
//# sourceMappingURL=chunk-GHTX6J36.js.map