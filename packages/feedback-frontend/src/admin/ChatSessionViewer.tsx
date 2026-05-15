/**
 * Admin-only viewer for the chat session that produced a feedback row
 * (Sprint D — closes the FE gap that Sprint C's backend endpoint
 * ``GET /api/v1/feedback/{id}/chat`` had been missing a UI for).
 *
 * Renders three sections collapsed by default to keep the triage
 * drawer compact:
 *
 *   1. Synthesis card — the structured spec the LLM emitted.
 *   2. Conversation transcript — full message timeline.
 *   3. LLM call audit — one row per turn with latency / status /
 *      tokens / prompt hash + version.
 *
 * Returns ``null`` when the feedback has no chat session (legacy
 * multipart) so the drawer just hides the block.
 */

import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { useFeedbackBindings } from "../FeedbackProvider";
import type { FeedbackHostBindings } from "../adapter";

interface ChatMessage {
  role: "user" | "assistant" | string;
  text: string;
  ts?: string;
  mode?: "discover" | "synthesize" | string;
  active_branch?: string;
  covered?: Record<string, number>;
  inferred?: { type?: string; severity?: string } | null;
}

interface ChatSessionSynthesis {
  title?: string;
  summary?: string;
  user_story?: string;
  context?: string;
  user_need?: string;
  acceptance_criteria?: string[];
  open_questions?: string[];
  personas?: { name: string; goal: string; frustration: string }[];
  user_stories?: string[];
  assumptions?: string[];
  diagram?: string | null;
}

interface ChatCall {
  id: string;
  turn_index: number;
  model_id: string;
  model_provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  latency_ms: number;
  status:
    | "success"
    | "json_invalid"
    | "timeout"
    | "provider_error"
    | "cancelled"
    | string;
  attempt_number: number;
  error_message: string | null;
  prompt_sha256: string;
  prompt_version: string | null;
  created_at: string | null;
}

interface ChatSessionEnvelope {
  feedback_id: string;
  chat_session_id: string;
  mode: string;
  status: string;
  messages: ChatMessage[];
  synthesis_json: ChatSessionSynthesis | null;
  auto_context: Record<string, unknown>;
  detected_language: string | null;
  created_at: string | null;
  confirmed_at: string | null;
  abandoned_at: string | null;
  calls: ChatCall[];
}

async function fetchChatSession(
  bindings: FeedbackHostBindings,
  feedbackId: string,
): Promise<ChatSessionEnvelope | null> {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  const url = `${base}${prefix}/${feedbackId}/chat`;
  const headers: Record<string, string> = {};
  try {
    const csrf = await bindings.getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  } catch {
    /* ignore */
  }
  if (bindings.authHeader) {
    try {
      const auth = await bindings.authHeader();
      if (auth) headers.Authorization = auth;
    } catch {
      /* ignore */
    }
  }
  const resp = await fetch(url, { credentials: "include", headers });
  if (resp.status === 404) {
    return null;
  }
  if (!resp.ok) {
    throw new Error(`chat session fetch failed: ${resp.status}`);
  }
  return (await resp.json()) as ChatSessionEnvelope;
}

function SynthesisBlock({
  synthesis,
}: {
  synthesis: ChatSessionSynthesis;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
      <h4 className="text-sm font-medium text-foreground">
        {synthesis.title ?? "(synthesis sin título)"}
      </h4>
      {synthesis.summary ? (
        <p className="text-xs text-muted-foreground">{synthesis.summary}</p>
      ) : null}
      {synthesis.user_story ? (
        <blockquote className="border-l-2 border-primary pl-2 text-xs italic text-foreground">
          {synthesis.user_story}
        </blockquote>
      ) : null}
      {synthesis.personas && synthesis.personas.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Personas
          </p>
          <ul className="space-y-1 text-xs text-foreground">
            {synthesis.personas.map((p, i) => (
              <li key={`persona-${i}`} className="rounded border border-input/60 px-2 py-1">
                <span className="font-medium">{p.name}</span>
                {p.goal ? <span className="text-muted-foreground"> — {p.goal}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {synthesis.acceptance_criteria && synthesis.acceptance_criteria.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Criterios de aceptación
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-foreground">
            {synthesis.acceptance_criteria.map((c, i) => (
              <li key={`ac-${i}`}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {synthesis.assumptions && synthesis.assumptions.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Supuestos
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {synthesis.assumptions.map((a, i) => (
              <li key={`asm-${i}`}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {synthesis.diagram ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Diagrama
          </p>
          <pre className="overflow-x-auto rounded border border-input/60 bg-muted/40 p-2 text-[10px] text-foreground">
            <code>{synthesis.diagram}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function TranscriptBlock({ messages }: { messages: ChatMessage[] }): ReactElement {
  if (messages.length === 0) {
    return <p className="text-xs text-muted-foreground">(sin mensajes)</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {messages.map((m, idx) => (
        <li
          key={`msg-${idx}-${m.ts ?? ""}`}
          className="rounded border bg-card p-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className="font-semibold text-foreground">{m.role}</span>
            <span>{m.ts ?? ""}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{m.text}</p>
          {m.role === "assistant" && m.mode ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              mode={m.mode}
              {m.active_branch ? ` · branch=${m.active_branch}` : ""}
              {m.inferred?.type ? ` · inferred.type=${m.inferred.type}` : ""}
              {m.inferred?.severity ? ` · severity=${m.inferred.severity}` : ""}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CallsBlock({ calls }: { calls: ChatCall[] }): ReactElement {
  if (calls.length === 0) {
    return <p className="text-xs text-muted-foreground">(sin llamadas LLM)</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="px-1 text-left">turn</th>
            <th className="px-1 text-left">model</th>
            <th className="px-1 text-left">status</th>
            <th className="px-1 text-right">latency</th>
            <th className="px-1 text-right">attempt</th>
            <th className="px-1 text-left">prompt v.</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="px-1">{c.turn_index}</td>
              <td className="px-1 font-mono">
                {c.model_provider}/{c.model_id}
              </td>
              <td className="px-1">
                <span
                  className={
                    c.status === "success"
                      ? "text-emerald-600"
                      : "text-destructive"
                  }
                >
                  {c.status}
                </span>
              </td>
              <td className="px-1 text-right">{c.latency_ms} ms</td>
              <td className="px-1 text-right">{c.attempt_number}</td>
              <td className="px-1">{c.prompt_version ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ChatSessionViewerProps {
  feedbackId: string;
}

export function ChatSessionViewer({
  feedbackId,
}: ChatSessionViewerProps): ReactElement | null {
  const bindings = useFeedbackBindings();
  const query = useQuery({
    queryKey: ["feedback-chat-session", feedbackId],
    queryFn: () => fetchChatSession(bindings, feedbackId),
    staleTime: 30_000,
  });

  // Legacy multipart feedback (no chat session) — hide block entirely.
  if (query.isSuccess && query.data === null) {
    return null;
  }

  return (
    <section className="rounded-md border p-3 space-y-3">
      <h3 className="text-sm font-medium">Chat session</h3>
      {query.isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : null}
      {query.isError ? (
        <p className="text-xs text-destructive">
          No pudimos cargar la conversación: {String(query.error)}
        </p>
      ) : null}
      {query.isSuccess && query.data ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>mode={query.data.mode}</span>
            <span>status={query.data.status}</span>
            {query.data.detected_language ? (
              <span>lang={query.data.detected_language}</span>
            ) : null}
            <span>turns={query.data.calls.length}</span>
          </div>

          {query.data.synthesis_json ? (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-foreground">
                Synthesis
              </summary>
              <div className="mt-2">
                <SynthesisBlock synthesis={query.data.synthesis_json} />
              </div>
            </details>
          ) : null}

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-foreground">
              Transcript ({query.data.messages.length} mensajes)
            </summary>
            <div className="mt-2">
              <TranscriptBlock messages={query.data.messages} />
            </div>
          </details>

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-foreground">
              LLM call audit ({query.data.calls.length})
            </summary>
            <div className="mt-2">
              <CallsBlock calls={query.data.calls} />
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
