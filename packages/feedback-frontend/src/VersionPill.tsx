/**
 * Tiny version pill — shows the deployed widget frontend + backend
 * versions so the user (and their devs) can see at a glance which
 * build is live. Click to expand for git SHA / build timestamp /
 * model id, mostly for debugging when something feels stale.
 *
 * Both versions are fetched lazily — the backend GET /health endpoint
 * already returns `{ok, version}` so no new endpoint is needed.
 * Cached for 30s; the host calls this every time the panel opens.
 */

import { useQuery } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";

import { useFeedbackBindings } from "./FeedbackProvider";
import { VERSION as FRONTEND_VERSION } from "./version";

interface BackendHealth {
  ok: boolean;
  version: string;
}

async function fetchBackendHealth(baseUrl: string, pathPrefix: string): Promise<BackendHealth> {
  const url = `${baseUrl.replace(/\/$/, "")}${pathPrefix}/health`;
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) {
    throw new Error(`health check ${resp.status}`);
  }
  return resp.json();
}

export function VersionPill(): ReactElement {
  const bindings = useFeedbackBindings();
  const [expanded, setExpanded] = useState(false);

  const health = useQuery<BackendHealth>({
    queryKey: ["feedback-widget-health"],
    queryFn: () =>
      fetchBackendHealth(bindings.apiBaseUrl, bindings.apiPathPrefix ?? "/api/v1/feedback"),
    staleTime: 30_000,
    retry: false,
  });

  const beVersion = health.data?.version ?? "?";
  const beStatus = health.isLoading ? "…" : health.isError ? "error" : health.data?.ok ? "ok" : "?";

  const matched = FRONTEND_VERSION === beVersion;

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      title="Click to expand version detail"
      className="block w-full pt-1 pb-2 text-center text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      data-feedback-id="feedback.version-pill"
    >
      <span aria-hidden="true">⚙</span>{" "}
      <code className="font-mono">
        fe v{FRONTEND_VERSION} · be v{beVersion}
      </code>
      {!matched && beVersion !== "?" ? (
        <span className="ml-1 text-amber-600/80" title="Frontend and backend versions don't match">
          ⚠
        </span>
      ) : null}
      {expanded ? (
        <div className="mt-1 mx-auto max-w-md rounded border border-input bg-card p-2 text-left font-mono text-[10px] leading-snug">
          <div>frontend: {FRONTEND_VERSION}</div>
          <div>
            backend: {beVersion} ({beStatus})
          </div>
          <div>
            api: {bindings.apiBaseUrl}
            {bindings.apiPathPrefix ?? "/api/v1/feedback"}
          </div>
          {!matched && beVersion !== "?" ? (
            <div className="mt-1 text-amber-700">
              ⚠ Versiones distintas — refresca el navegador y/o reconstruye el backend.
            </div>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
