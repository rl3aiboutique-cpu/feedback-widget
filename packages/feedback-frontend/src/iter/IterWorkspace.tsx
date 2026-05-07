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
import { Loader2 } from "lucide-react";
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
import { EditableSpecPanel } from "./EditableSpecPanel";
import { modelLatencyHint as _modelLatencyHint } from "./markdownView";
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
      body: {
        status: "confirmed" | "corrected" | "irrelevant";
        user_response?: string;
      };
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

  // User-facing assumptions (kind in business|ux|scope) are the only
  // ones that block iteration / finalize. ``kind === "technical"`` is
  // reserved for notes the AI is making for the downstream consumer
  // (architecture, code patterns, framework choices) — the user can't
  // reasonably answer those, so we surface them in a separate
  // "AI-internal notes" pane and never gate the workflow on them.
  const userFacingAssumptions = (assumptions.data ?? []).filter((a) => a.kind !== "technical");
  const openAssumptionCount = userFacingAssumptions.filter((a) => a.status === "open").length;

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

  // Total / resolved counts for the progress rail in the header.
  // We only count user-facing assumptions because the user has no
  // action to take on AI-internal technical notes.
  const totalAssumptions = userFacingAssumptions.length;
  const resolvedAssumptions = totalAssumptions - openAssumptionCount;
  const progress =
    totalAssumptions > 0 ? Math.round((resolvedAssumptions / totalAssumptions) * 100) : 0;

  // Tab the user is currently on. Default to Document; auto-flip
  // to Assumptions when an assumption-rich version lands so the
  // user notices the cards.
  const [tab, setTab] = useState<"document" | "assumptions" | "activity">("document");
  const [seenAssumptionsBadge, setSeenAssumptionsBadge] = useState(false);
  useEffect(() => {
    if (!seenAssumptionsBadge && openAssumptionCount > 0 && tab === "document") {
      // Show the unread badge on the Assumptions tab; user clicks
      // when they want to engage. We don't auto-switch tabs.
    }
  }, [openAssumptionCount, tab, seenAssumptionsBadge]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground">
      <Header
        session={session.data}
        onClose={onClose}
        onAbandon={() => abandonMutation.mutate()}
        terminal={session.data?.status === "finalized" || session.data?.status === "abandoned"}
        progress={progress}
        resolvedCount={resolvedAssumptions}
        totalCount={totalAssumptions}
        streaming={isStreaming}
        streamSection={stream.state.activeSection}
      />

      <TabBar
        tab={tab}
        onChange={(t) => {
          setTab(t);
          if (t === "assumptions") setSeenAssumptionsBadge(true);
        }}
        openAssumptionCount={openAssumptionCount}
        totalAssumptionCount={totalAssumptions}
        versionCount={(versions.data ?? []).length}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "document" && (
          <DocumentTab
            markdown={renderedMarkdown}
            streaming={isStreaming}
            activeSection={stream.state.activeSection}
            latestVersion={latestVersion}
            sessionStatus={session.data?.status}
            streamStatus={stream.state.status}
            streamErrorCode={stream.state.errorCode}
            streamErrorMessage={stream.state.errorMessage}
            onFirstRun={() => stream.start({ user_message: "", restructure_allowed: false })}
            onSaveEdit={async (next) => {
              if (!latestVersion) return;
              await editMarkdownMutation.mutateAsync({
                versionId: latestVersion.id,
                markdown: next,
              });
            }}
            saving={editMarkdownMutation.isPending}
            modelHint={_modelLatencyHint(_resolveDisplayModel(session.data))}
          />
        )}
        {tab === "assumptions" && (
          <AssumptionsTab
            items={assumptions.data ?? []}
            onResolve={(assumptionId, body) => resolveMutation.mutateAsync({ assumptionId, body })}
            disabled={session.data?.status === "finalized" || session.data?.status === "abandoned"}
          />
        )}
        {tab === "activity" && <ActivityTab versions={versions.data ?? []} />}
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
  progress: number;
  resolvedCount: number;
  totalCount: number;
  streaming: boolean;
  streamSection: "personas" | "user_stories" | "spec" | "diagram" | "assumptions" | null;
}) {
  return (
    <header className="flex items-center gap-3 border-b bg-card px-4 py-2 text-sm">
      <span className="font-semibold">Iterate with AI</span>
      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        {props.session?.status ?? "loading"}
      </span>
      <span className="hidden text-xs text-muted-foreground md:inline">
        model: {_resolveDisplayModel(props.session)}
      </span>
      {props.streaming && (
        <span className="flex items-center gap-1.5 text-xs text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          {props.streamSection
            ? `Writing ${props.streamSection.replace("_", " ")}…`
            : "AI is thinking…"}
        </span>
      )}
      {props.totalCount > 0 && (
        <div className="ml-2 hidden items-center gap-2 md:flex">
          <span className="text-xs text-muted-foreground">
            {props.resolvedCount}/{props.totalCount} resolved
          </span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${props.progress}%` }}
            />
          </div>
        </div>
      )}
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

function TabBar(props: {
  tab: "document" | "assumptions" | "activity";
  onChange: (next: "document" | "assumptions" | "activity") => void;
  openAssumptionCount: number;
  totalAssumptionCount: number;
  versionCount: number;
}) {
  const tabs: Array<{
    key: "document" | "assumptions" | "activity";
    label: string;
    badge: string | null;
  }> = [
    { key: "document", label: "Document", badge: null },
    {
      key: "assumptions",
      label: "Assumptions",
      badge:
        props.totalAssumptionCount > 0
          ? `${props.openAssumptionCount}/${props.totalAssumptionCount}`
          : null,
    },
    {
      key: "activity",
      label: "Activity",
      badge: props.versionCount > 0 ? `v${props.versionCount}` : null,
    },
  ];
  return (
    <div className="flex items-center gap-1 border-b bg-card px-3" role="tablist">
      {tabs.map((t) => {
        const active = props.tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => props.onChange(t.key)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.badge && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface DocumentTabProps {
  markdown: string;
  streaming: boolean;
  activeSection: "personas" | "user_stories" | "spec" | "diagram" | "assumptions" | null;
  latestVersion: IterVersionRead | null;
  sessionStatus: IterSessionRead["status"] | undefined;
  streamStatus: "idle" | "running" | "done" | "error";
  streamErrorCode: string | null;
  streamErrorMessage: string | null;
  onFirstRun: () => void;
  onSaveEdit: (next: string) => Promise<void>;
  saving: boolean;
  modelHint: string;
}

function DocumentTab(props: DocumentTabProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-row gap-6 p-4 lg:p-6">
      {props.markdown && !props.streaming && <DocumentTOC markdown={props.markdown} />}
      <main className="flex flex-1 flex-col">
        {!props.latestVersion && props.streamStatus === "idle" && (
          <FirstRunCard busy={false} onRun={props.onFirstRun} />
        )}
        <EditableSpecPanel
          markdown={props.markdown}
          streaming={props.streaming}
          activeSection={props.activeSection}
          editable={
            !!props.latestVersion &&
            !props.streaming &&
            props.sessionStatus !== "finalized" &&
            props.sessionStatus !== "abandoned"
          }
          onSaveEdit={props.onSaveEdit}
          saving={props.saving}
          modelHint={props.modelHint}
        />
        {props.streamStatus === "error" && (
          <ErrorBanner code={props.streamErrorCode} message={props.streamErrorMessage} />
        )}
      </main>
    </div>
  );
}

function DocumentTOC({ markdown }: { markdown: string }) {
  const headings = useMemo(() => {
    const out: Array<{ level: 1 | 2; text: string; id: string }> = [];
    for (const raw of markdown.split("\n")) {
      const m = /^(#{1,2})\s+(.+?)\s*$/.exec(raw);
      if (!m) continue;
      const level = m[1]?.length === 1 ? 1 : 2;
      const text = (m[2] ?? "").replace(/[*_`]/g, "").trim();
      if (!text) continue;
      const id = `iter-toc-${text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}`;
      out.push({ level: level as 1 | 2, text, id });
    }
    return out;
  }, [markdown]);

  if (headings.length < 2) return null;

  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <div className="sticky top-2">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </h4>
        <ul className="space-y-1 text-sm">
          {headings.map((h) => (
            <li key={h.id} className={h.level === 2 ? "ml-3 text-xs text-muted-foreground" : ""}>
              <a
                href={`#${h.id}`}
                className="block rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(h.id)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function AssumptionsTab(props: {
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
  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
      <AssumptionsGrid items={props.items} onResolve={props.onResolve} disabled={props.disabled} />
    </div>
  );
}

function ActivityTab({ versions }: { versions: IterVersionRead[] }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] p-4 lg:p-6">
      <h3 className="mb-3 text-sm font-semibold">Iteration history</h3>
      <ActivityTimeline versions={versions} />
    </div>
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

  // The Finalize button stays clickable when the gates aren't
  // met; it pops a warning modal listing what isn't done so the
  // user can override (dev teams can interpret an under-spec'd
  // package, but they shouldn't have to). It only hard-disables
  // when there's literally nothing to finalize yet (no version)
  // or while another mutation is in flight.
  const finalizeBlocked =
    !props.session?.current_iteration_id || props.finalizing || props.streamRunning;
  const [showFinalizeWarning, setShowFinalizeWarning] = useState(false);

  const onFinalizeClick = () => {
    if (props.canFinalize) {
      void props.onFinalize();
      return;
    }
    setShowFinalizeWarning(true);
  };
  const confirmFinalize = () => {
    setShowFinalizeWarning(false);
    void props.onFinalize();
  };
  const cancelFinalize = () => setShowFinalizeWarning(false);

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
            disabled={finalizeBlocked}
            onClick={onFinalizeClick}
            title={
              !props.session?.current_iteration_id
                ? "Generate a version first"
                : props.canFinalize
                  ? "Finalize and produce the package"
                  : "Finalize anyway (you'll be asked to confirm)"
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
      {showFinalizeWarning && (
        <FinalizeWarningModal
          openAssumptions={props.openAssumptions}
          needsReviewIteration={props.needsReviewIteration}
          hasAnyVersion={!!props.session?.current_iteration_id}
          onConfirm={confirmFinalize}
          onCancel={cancelFinalize}
        />
      )}
    </footer>
  );
}

// Modal shown when the user clicks Finalize while gates aren't met
// (open assumptions OR pending review iteration). Lists exactly
// what's not done so the override is informed, not accidental.
function FinalizeWarningModal(props: {
  openAssumptions: number;
  needsReviewIteration: boolean;
  hasAnyVersion: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Native <dialog> handles Esc-to-close + focus trap so we don't
  // need to bolt them on with onKeyDown handlers. The cancel
  // listener is the user-agent's own form of Esc.
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) el.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      props.onCancel();
    };
    el.addEventListener("cancel", onCancel);
    return () => {
      el.removeEventListener("cancel", onCancel);
      if (el.open) el.close();
    };
  }, [props.onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="z-[80] max-w-md rounded-lg border bg-card p-5 shadow-lg backdrop:bg-black/40"
      aria-labelledby="iter-finalize-warning-title"
    >
      <h2
        id="iter-finalize-warning-title"
        className="mb-2 text-base font-semibold text-amber-900 dark:text-amber-200"
      >
        Finalize without completing review?
      </h2>
      <p className="text-sm text-muted-foreground">
        The dev team interprets the package as the source of truth. If you finalize now, the
        following items aren't fully clarified:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {props.openAssumptions > 0 && (
          <li>
            <strong>{props.openAssumptions}</strong> assumption
            {props.openAssumptions === 1 ? " is" : "s are"} still open and will be packaged as{" "}
            <em>unresolved</em>.
          </li>
        )}
        {props.needsReviewIteration && (
          <li>
            You haven't run a review iteration since resolving assumptions, so the working document
            doesn't reflect your answers yet.
          </li>
        )}
        {!props.hasAnyVersion && (
          <li>The session has no version yet — there's nothing to package.</li>
        )}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        You can still finalize — useful when you'd rather hand off a partial spec than block on
        perfection. The dev team can ask follow-ups.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={props.onCancel}>
          Cancel — I'll keep iterating
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={props.onConfirm}
          disabled={!props.hasAnyVersion}
        >
          Finalize anyway
        </Button>
      </div>
    </dialog>
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
  technical: {
    name: "Technical",
    band: "border-l-blue-400 bg-blue-50/40 dark:bg-blue-900/10",
  },
  business: {
    name: "Business",
    band: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10",
  },
  ux: {
    name: "UX",
    band: "border-l-violet-400 bg-violet-50/40 dark:bg-violet-900/10",
  },
  scope: {
    name: "Scope",
    band: "border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10",
  },
};
// Technical kind is intentionally excluded from the user-facing grid;
// it ends up in the "AI-internal notes" pane below the resolved list.
const _KIND_ORDER: Array<IterAssumptionRead["kind"]> = ["ux", "business", "scope"];

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
  // Split into three buckets:
  //   userFacingOpen:  status==="open"  && kind in [ux,business,scope]  → resolve grid
  //   userFacingDone:  status!=="open"  && kind in [ux,business,scope]  → "Resolved" group
  //   internalNotes:   kind==="technical"  (any status)                  → "AI-internal notes" pane
  const userFacingOpen = props.items.filter((a) => a.status === "open" && a.kind !== "technical");
  const userFacingDone = props.items.filter((a) => a.status !== "open" && a.kind !== "technical");
  const internalNotes = props.items.filter((a) => a.kind === "technical");

  // Group open assumptions by kind, preserving the canonical order.
  const grouped: Record<IterAssumptionRead["kind"], IterAssumptionRead[]> = {
    technical: [],
    ux: [],
    business: [],
    scope: [],
  };
  for (const a of userFacingOpen) grouped[a.kind].push(a);

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      {userFacingDone.length > 0 && (
        <details className="rounded border bg-muted/40 p-3" open>
          <summary className="cursor-pointer text-xs font-semibold">
            Resolved ({userFacingDone.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {userFacingDone.map((a) => {
              const meta = _KIND_BAND[a.kind];
              return (
                <div key={a.id} className={`rounded-md border-l-4 ${meta.band} [&>div]:border-l-0`}>
                  <AssumptionCard
                    assumption={a}
                    disabled={props.disabled}
                    onResolve={(body) => props.onResolve(a.id, body)}
                  />
                </div>
              );
            })}
          </div>
        </details>
      )}
      {internalNotes.length > 0 && (
        <details className="rounded border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-900/10">
          <summary className="cursor-pointer text-xs font-semibold text-blue-900 dark:text-blue-200">
            AI-internal notes ({internalNotes.length}) — no action required
          </summary>
          <p className="mt-2 text-[11px] text-muted-foreground">
            These are notes the AI is leaving for the downstream developer agent that will read your
            finalized package. They describe implementation details (architecture, code patterns,
            framework choices) that you wouldn't typically know — they ship with the package
            automatically.
          </p>
          <ul className="mt-3 space-y-2">
            {internalNotes.map((a) => (
              <li
                key={a.id}
                className="rounded border border-blue-200 bg-white/60 p-2 text-xs dark:border-blue-900/50 dark:bg-blue-950/20"
              >
                <div className="font-medium text-foreground/90">{a.statement}</div>
                {a.rationale && <div className="mt-1 text-muted-foreground">{a.rationale}</div>}
              </li>
            ))}
          </ul>
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
// The streaming/markdown primitives live in `markdownView.tsx` since
// v0.4.1 so `IterFocusView` can reuse them; this file just composes.
// ─────────────────────────────────────────────────────────────────

// WorkingDocumentPanel moved to ./EditableSpecPanel in v0.4.4 so the
// submitter focus view can reuse the same edit-in-place pattern. This
// file just imports + composes.

// What the user should see in the workspace header for "model".
// Active sessions (still running) show the CURRENT primary model
// — what the next iteration would attempt first. Terminal sessions
// show the model that actually answered the latest call (history).
// Falls back to the session row's recorded model if neither is
// available (very old sessions before rc.12).
function _resolveDisplayModel(session: IterSessionRead | undefined): string {
  if (!session) return "(loading)";
  const isActive = session.status === "draft" || session.status === "iterating";
  if (isActive && session.current_primary_model_id) {
    return session.current_primary_model_id;
  }
  return session.last_call_model_id ?? session.model_id ?? "(none)";
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
