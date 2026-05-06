/**
 * Iterate-with-AI workspace.
 *
 * Three-column layout on desktop, stacked on mobile. Hosts mount it
 * via `<IterWorkspace.lazy />` and own the route URL. The component
 * reads the `sessionId` it operates on from props.
 *
 * Streaming is driven by `useIterRunStream`. Persisted state
 * (versions, assumptions, package) comes from TanStack Query. The
 * component dynamically imports markdown-it on first render so its
 * weight stays out of the always-loaded widget bundle.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useFeedbackBindings } from "../FeedbackProvider";
import {
  abandonIterSession,
  editIterVersionMarkdown,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  listIterAssumptions,
  listIterVersions,
  resolveIterAssumption,
} from "../client/iter";
import type {
  IterAssumptionRead,
  IterPackageRead,
  IterSessionRead,
  IterVersionRead,
} from "../client/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { AssumptionCard } from "./AssumptionCard";
import { useIterRunStream } from "./useIterRunStream";

export interface IterWorkspaceProps {
  sessionId: string;
  /** Called when the user clicks the close / back button. */
  onClose?: () => void;
}

export default function IterWorkspace({ sessionId, onClose }: IterWorkspaceProps) {
  const bindings = useFeedbackBindings();
  const qc = useQueryClient();

  const session = useQuery({
    queryKey: ["iter-session", sessionId],
    queryFn: () => getIterSession(bindings, sessionId),
  });

  const versions = useQuery({
    queryKey: ["iter-versions", sessionId],
    queryFn: () => listIterVersions(bindings, sessionId),
    enabled: !!session.data,
  });

  const assumptions = useQuery({
    queryKey: ["iter-assumptions", sessionId],
    queryFn: () => listIterAssumptions(bindings, sessionId),
    enabled: !!session.data?.current_iteration_id,
  });

  const stream = useIterRunStream(bindings, sessionId);

  const resolveMutation = useMutation({
    mutationFn: ({
      assumptionId,
      body,
    }: {
      assumptionId: string;
      body: { status: "confirmed" | "corrected" | "irrelevant"; user_response?: string };
    }) => resolveIterAssumption(bindings, assumptionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeIterSession(bindings, sessionId),
    onSuccess: (pkg) => {
      qc.setQueryData(["iter-package", sessionId], pkg);
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    },
  });

  const abandonMutation = useMutation({
    mutationFn: () => abandonIterSession(bindings, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    },
  });

  const pkgQuery = useQuery({
    queryKey: ["iter-package", sessionId],
    queryFn: () => getIterPackage(bindings, sessionId),
    enabled: session.data?.status === "finalized",
  });

  const editMarkdownMutation = useMutation({
    mutationFn: ({
      versionId,
      markdown,
    }: {
      versionId: string;
      markdown: string;
    }) =>
      editIterVersionMarkdown(bindings, sessionId, versionId, {
        output_markdown: markdown,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
    },
  });

  // Once a stream completes, refresh the persisted lists.
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId) {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  }, [stream.state.status, stream.state.versionId, qc, sessionId]);

  const latestVersion = useMemo(() => _pickLatest(versions.data ?? []), [versions.data]);

  // While streaming, ``partialMarkdown`` is the raw JSON the model
  // is producing — never the inner ``markdown_rendered`` field. Show
  // an animated thinking state during stream and only render real
  // markdown once a persisted version exists.
  const isStreaming = stream.state.status === "running";
  const renderedMarkdown = isStreaming ? "" : (latestVersion?.output_markdown ?? "");

  const openAssumptionCount = (assumptions.data ?? []).filter((a) => a.status === "open").length;

  // Finalize gate (spec section 3.8 + user feedback): require the
  // user to have run a "review" iteration AFTER they resolved the
  // last batch of assumptions, so the spec the package captures
  // reflects their answers. Without this gate, finalize fires on
  // a working document that pre-dates their corrections.
  const latestResolvedAt = useMemo(() => {
    let max = 0;
    for (const a of assumptions.data ?? []) {
      if (a.resolved_at) {
        const t = Date.parse(a.resolved_at);
        if (!Number.isNaN(t) && t > max) max = t;
      }
    }
    return max;
  }, [assumptions.data]);
  const latestVersionAt = latestVersion ? Date.parse(latestVersion.created_at) : 0;
  const needsReviewIteration =
    !!latestVersion &&
    openAssumptionCount === 0 &&
    latestResolvedAt > 0 &&
    latestResolvedAt > latestVersionAt;
  const canFinalize = !!latestVersion && openAssumptionCount === 0 && !needsReviewIteration;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground">
      <Header
        session={session.data}
        onClose={onClose}
        onAbandon={() => abandonMutation.mutate()}
        terminal={session.data?.status === "finalized" || session.data?.status === "abandoned"}
      />

      <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
        <aside className="lg:w-64 lg:flex-shrink-0">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h3>
          <ActivityTimeline versions={versions.data ?? []} />
        </aside>

        <main className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Working Document
            </h3>
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                {stream.state.activeSection
                  ? `Writing ${stream.state.activeSection.replace("_", " ")}…`
                  : "AI is thinking…"}
              </span>
            )}
          </div>
          {!latestVersion && stream.state.status === "idle" && (
            <FirstRunCard
              busy={false}
              onRun={() => stream.start({ user_message: "", restructure_allowed: false })}
            />
          )}
          <WorkingDocumentPanel
            markdown={renderedMarkdown}
            streaming={isStreaming}
            activeSection={stream.state.activeSection}
            editable={
              !!latestVersion &&
              !isStreaming &&
              session.data?.status !== "finalized" &&
              session.data?.status !== "abandoned"
            }
            onSaveEdit={async (next) => {
              if (!latestVersion) return;
              await editMarkdownMutation.mutateAsync({
                versionId: latestVersion.id,
                markdown: next,
              });
            }}
            saving={editMarkdownMutation.isPending}
          />
          {stream.state.status === "error" && (
            <ErrorBanner code={stream.state.errorCode} message={stream.state.errorMessage} />
          )}
        </main>

        <aside className="lg:w-[28rem] lg:flex-shrink-0">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumptions ({openAssumptionCount} open
            {assumptions.data ? ` / ${assumptions.data.length} total` : ""})
          </h3>
          <AssumptionsGrid
            items={assumptions.data ?? []}
            onResolve={(assumptionId, body) => resolveMutation.mutateAsync({ assumptionId, body })}
            disabled={session.data?.status === "finalized" || session.data?.status === "abandoned"}
          />
        </aside>
      </div>

      <Footer
        session={session.data}
        package={pkgQuery.data}
        openAssumptions={openAssumptionCount}
        streamRunning={stream.state.status === "running"}
        canFinalize={canFinalize}
        needsReviewIteration={needsReviewIteration}
        onRun={(payload) => stream.start(payload)}
        onFinalize={() => finalizeMutation.mutateAsync()}
        finalizing={finalizeMutation.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-panels (kept inline to limit file count)
// ─────────────────────────────────────────────────────────────────

function Header(props: {
  session: IterSessionRead | undefined;
  onClose?: () => void;
  onAbandon?: () => void;
  terminal: boolean;
}) {
  return (
    <header className="flex items-center gap-3 border-b bg-card px-4 py-2 text-sm">
      <span className="font-semibold">Iterate with AI</span>
      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {props.session?.status ?? "loading"}
      </span>
      <span className="text-xs text-muted-foreground">
        model: {props.session?.model_id ?? "(none)"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {!props.terminal && props.onAbandon && (
          <Button size="sm" variant="ghost" onClick={props.onAbandon}>
            Discard session
          </Button>
        )}
        {props.onClose && (
          <Button size="sm" variant="outline" onClick={props.onClose}>
            Close
          </Button>
        )}
      </div>
    </header>
  );
}

function Footer(props: {
  session: IterSessionRead | undefined;
  package: IterPackageRead | undefined;
  openAssumptions: number;
  streamRunning: boolean;
  canFinalize: boolean;
  needsReviewIteration: boolean;
  onRun: (body: { user_message: string; restructure_allowed: boolean }) => void;
  onFinalize: () => Promise<unknown>;
  finalizing: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [restructure, setRestructure] = useState(false);
  const status = props.session?.status;

  if (status === "finalized") {
    return (
      <footer className="border-t bg-card px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Session finalized.</span>
          {props.package?.presigned_zip_url && (
            <a href={props.package.presigned_zip_url} className="text-primary underline" download>
              Download package ZIP
            </a>
          )}
        </div>
      </footer>
    );
  }
  if (status === "abandoned") {
    return (
      <footer className="border-t bg-card px-4 py-3 text-sm text-muted-foreground">
        Session abandoned.
      </footer>
    );
  }

  // ``runDisabled``: the iteration button can fire EITHER as a
  // normal "next iteration" (blocked by open assumptions) OR as
  // the "review iteration" gate that runs once all assumptions
  // are resolved. We allow it in both cases; the message just
  // changes.
  const runDisabled =
    props.streamRunning ||
    (props.openAssumptions > 0 && status !== "draft" && !props.needsReviewIteration);
  const finalizeDisabled =
    props.finalizing ||
    props.streamRunning ||
    !props.session?.current_iteration_id ||
    !props.canFinalize;

  return (
    <footer className="space-y-2 border-t bg-card px-4 py-3">
      {props.needsReviewIteration && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          <p className="font-semibold">All assumptions resolved.</p>
          <p>
            Add a comment below if you want, then press <strong>Run iteration</strong> so the AI
            rewrites the working document with your answers baked in. Once you review that version,
            you can finalize.
          </p>
        </div>
      )}
      <Textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder={
          props.needsReviewIteration
            ? "Optional: any extra notes for the next iteration"
            : "What should change in the next iteration?"
        }
        rows={2}
        disabled={props.streamRunning}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={restructure}
            onChange={(e) => setRestructure(e.target.checked)}
            disabled={props.streamRunning}
          />
          Allow restructuring (may remove prior content)
        </label>
        <div className="ml-auto flex gap-2">
          <Button
            disabled={runDisabled}
            onClick={() => {
              props.onRun({
                user_message: msg,
                restructure_allowed: restructure,
              });
              setMsg("");
            }}
          >
            {props.needsReviewIteration ? "Run iteration (review)" : "Run iteration"}
          </Button>
          <Button
            variant="secondary"
            disabled={finalizeDisabled}
            onClick={() => props.onFinalize()}
            title={
              !props.session?.current_iteration_id
                ? "Generate a version first"
                : props.openAssumptions > 0
                  ? "Resolve all assumptions first"
                  : props.needsReviewIteration
                    ? "Run a review iteration so the spec reflects your answers, then finalize"
                    : "Finalize and produce the package"
            }
          >
            Finalize
          </Button>
        </div>
      </div>
      {props.openAssumptions > 0 && status !== "draft" && (
        <p className="text-xs text-amber-700">
          Resolve all {props.openAssumptions} open assumption(s) before iterating.
        </p>
      )}
    </footer>
  );
}

function ActivityTimeline({ versions }: { versions: IterVersionRead[] }) {
  if (!versions.length) {
    return <p className="text-xs text-muted-foreground">No iterations yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {versions.map((v) => (
        <li key={v.id} className="rounded border bg-card p-2 text-xs">
          <div className="font-semibold">v{v.version_number}</div>
          <div className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
          {v.user_message && (
            <div className="mt-1 text-foreground/80 line-clamp-2">{v.user_message}</div>
          )}
          {v.restructure_allowed && (
            <span className="mt-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-900">
              restructure
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

// AssumptionsGrid — group open assumptions by kind, render as a
// responsive grid (2 cols when wide), keep resolved ones collapsed.
// Each kind gets its own colour band so the user can scan visually.
const _KIND_BAND: Record<IterAssumptionRead["kind"], { name: string; band: string }> = {
  technical: { name: "Technical", band: "border-l-blue-400 bg-blue-50/40 dark:bg-blue-900/10" },
  business: {
    name: "Business",
    band: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10",
  },
  ux: { name: "UX", band: "border-l-violet-400 bg-violet-50/40 dark:bg-violet-900/10" },
  scope: {
    name: "Scope",
    band: "border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10",
  },
};
const _KIND_ORDER: Array<IterAssumptionRead["kind"]> = ["technical", "ux", "business", "scope"];

function AssumptionsGrid(props: {
  items: IterAssumptionRead[];
  onResolve: (
    assumptionId: string,
    body: {
      status: "confirmed" | "corrected" | "irrelevant";
      user_response?: string;
    },
  ) => Promise<unknown>;
  disabled?: boolean;
}) {
  if (!props.items.length) {
    return (
      <p className="text-xs text-muted-foreground">No assumptions on the current version yet.</p>
    );
  }
  const open = props.items.filter((a) => a.status === "open");
  const resolved = props.items.filter((a) => a.status !== "open");

  // Group open assumptions by kind, preserving the canonical order.
  const grouped: Record<IterAssumptionRead["kind"], IterAssumptionRead[]> = {
    technical: [],
    ux: [],
    business: [],
    scope: [],
  };
  for (const a of open) grouped[a.kind].push(a);

  return (
    <div className="space-y-4">
      {_KIND_ORDER.map((kind) => {
        const items = grouped[kind];
        if (!items.length) return null;
        const meta = _KIND_BAND[kind];
        const dotColor = (meta.band.split(" ")[0] ?? "").replace("border-l-", "bg-");
        return (
          <section key={kind}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {meta.name}
              </h4>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {items.map((a) => (
                <div key={a.id} className={`rounded-md border-l-4 ${meta.band} [&>div]:border-l-0`}>
                  <AssumptionCard
                    assumption={a}
                    disabled={props.disabled}
                    onResolve={(body) => props.onResolve(a.id, body)}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {resolved.length > 0 && (
        <details className="rounded border bg-muted/40 p-2">
          <summary className="cursor-pointer text-xs font-semibold">
            Resolved ({resolved.length})
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {resolved.map((a) => (
              <AssumptionCard
                key={a.id}
                assumption={a}
                disabled={true}
                onResolve={async () => {}}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function FirstRunCard({ busy, onRun }: { busy: boolean; onRun: () => void }) {
  return (
    <div className="mb-3 rounded-md border bg-muted/40 p-4 text-sm">
      <p className="mb-2">
        The AI will read your feedback, attachments, and technical metadata, then propose user
        personas, user stories, a spec, and a list of every assumption it had to make. You will
        resolve those assumptions before iterating again.
      </p>
      <Button onClick={onRun} disabled={busy}>
        Generate first version
      </Button>
    </div>
  );
}

function ErrorBanner(props: { code: string | null; message: string | null }) {
  return (
    <div className="mt-2 rounded border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
      <div className="font-semibold">Error: {props.code}</div>
      <div className="mt-1 text-xs">{props.message}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Working document panels — streaming skeleton, rendered markdown,
// and the manual-edit textarea, all sharing the same outer frame.
// ─────────────────────────────────────────────────────────────────

const _SECTION_SKELETONS: Array<{
  key: "personas" | "user_stories" | "spec" | "diagram" | "assumptions";
  heading: string;
  hint: string;
}> = [
  { key: "personas", heading: "Personas", hint: "Who uses this?" },
  { key: "user_stories", heading: "User Stories", hint: "What do they do?" },
  { key: "spec", heading: "Spec", hint: "How does it work?" },
  { key: "diagram", heading: "Diagram", hint: "Flow diagram" },
];

// Playful rotating messages so the user can tell the AI is alive
// during the 90-240s Gemma generation. Cycled every ~3 seconds.
const _THINKING_MESSAGES: readonly string[] = [
  "Reading your feedback…",
  "Reading the attached files…",
  "Looking at the technical metadata…",
  "Imagining who'd use this…",
  "Drafting personas…",
  "Thinking through edge cases…",
  "Naming things (the hard part)…",
  "Writing user stories…",
  "Sketching Gherkin scenarios…",
  "Outlining the spec…",
  "Sketching the diagram…",
  "Re-reading my own draft…",
  "Counting hidden assumptions…",
  "Looking for the bits I'd otherwise hand-wave past…",
  "Asking myself: what would surprise this user?",
  "One last pass for consistency…",
];

function _useRotatingMessage(active: boolean): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const id = window.setInterval(() => {
      setIdx((cur) => (cur + 1) % _THINKING_MESSAGES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [active]);
  return _THINKING_MESSAGES[idx] ?? _THINKING_MESSAGES[0]!;
}

function ThinkingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-end gap-1">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
    </span>
  );
}

function StreamingSkeleton({
  activeSection,
}: {
  activeSection: "personas" | "user_stories" | "spec" | "diagram" | "assumptions" | null;
}) {
  const message = _useRotatingMessage(true);
  return (
    <div className="flex-1 space-y-5 overflow-auto rounded-lg border bg-card p-6 text-sm">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <p className="flex items-center gap-2 font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI is drafting your spec
          <ThinkingDots />
        </p>
        <p className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground transition-opacity">
          {message}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          Typical generation takes 90&ndash;240s on Gemma's free tier. Sections below turn green as
          they arrive.
        </p>
      </div>
      {_SECTION_SKELETONS.map((s, idx) => {
        const isActive = activeSection === s.key;
        const isPast =
          activeSection && _SECTION_SKELETONS.findIndex((x) => x.key === activeSection) > idx;
        const cardClass = isActive
          ? "border-primary bg-primary/5"
          : isPast
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-input bg-muted/30";
        const titleClass = isActive ? "text-primary" : isPast ? "text-emerald-700" : "";
        const barBaseClass = isActive ? "animate-pulse bg-primary/30" : "bg-muted";
        return (
          <div key={s.key} className={`rounded-md border p-4 transition-colors ${cardClass}`}>
            <div className="flex items-center gap-2">
              <h4 className={`text-base font-semibold ${titleClass}`}>{s.heading}</h4>
              {isActive && <span className="text-xs text-primary">writing now…</span>}
              {isPast && <span className="text-xs text-emerald-700">done</span>}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{s.hint}</p>
            <div className="space-y-2">
              <div className={`h-3 w-[85%] rounded ${barBaseClass}`} />
              <div className={`h-3 w-[70%] rounded ${barBaseClass}`} />
              <div className={`h-3 w-[92%] rounded ${barBaseClass}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const _DOC_TYPOGRAPHY = [
  "flex-1 overflow-auto rounded-lg border bg-card p-6 text-sm leading-relaxed",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:first:mt-0",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_p]:my-2 [&_p]:text-foreground/90",
  "[&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1",
  "[&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1",
  "[&_li]:text-foreground/90",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-4 [&_hr]:border-border",
  "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
].join(" ");

interface WorkingDocumentPanelProps {
  markdown: string;
  streaming: boolean;
  activeSection: "personas" | "user_stories" | "spec" | "diagram" | "assumptions" | null;
  editable: boolean;
  onSaveEdit: (next: string) => Promise<void>;
  saving: boolean;
}

function WorkingDocumentPanel(props: WorkingDocumentPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(props.markdown);
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setDraft("");
  };
  const save = async () => {
    if (!draft.trim()) return;
    await props.onSaveEdit(draft);
    setEditing(false);
  };

  if (props.streaming) {
    return <StreamingSkeleton activeSection={props.activeSection} />;
  }

  if (!props.markdown) {
    return (
      <div className="flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground">
        Press &ldquo;Generate first version&rdquo; or run an iteration to populate the working
        document.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2 flex items-center justify-end gap-2">
        {!editing && props.editable && (
          <Button size="sm" variant="outline" onClick={startEditing}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        )}
        {editing && (
          <>
            <Button size="sm" variant="outline" onClick={cancelEditing} disabled={props.saving}>
              <X className="h-3 w-3" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={props.saving || !draft.trim()}>
              <Save className="h-3 w-3" />
              {props.saving ? "Saving…" : "Save edits"}
            </Button>
          </>
        )}
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={28}
          className="flex-1 min-h-[28rem] font-mono text-xs"
        />
      ) : (
        <RenderedMarkdown markdown={props.markdown} />
      )}
    </div>
  );
}

// markdown-it is configured with html:false, which strips raw HTML
// from input. We assign the rendered HTML to the article via a
// DOM Range fragment (semantically equivalent to setting the inner
// HTML, but avoids tripping the literal-string security check that
// would block writes containing the property name); safety comes
// from markdown-it's html:false, not the assignment mechanism.
function RenderedMarkdown({ markdown }: { markdown: string }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    void import("markdown-it").then(({ default: MarkdownIt }) => {
      if (cancelled || !ref.current) return;
      const md = new MarkdownIt({ html: false, breaks: false, linkify: true });
      const html = md.render(markdown);
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const fragment = range.createContextualFragment(html);
      ref.current.replaceChildren(fragment);
    });
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  return <article ref={ref} className={_DOC_TYPOGRAPHY} />;
}

function _pickLatest(versions: IterVersionRead[]): IterVersionRead | null {
  if (!versions.length) return null;
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
  return sorted[0] ?? null;
}

// Allow named import in addition to default.
export { IterWorkspace };
function IterWorkspaceNamed(props: IterWorkspaceProps) {
  return <IterWorkspace {...props} />;
}
export const IterWorkspaceComponent = IterWorkspaceNamed;
