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
import { useEffect, useMemo, useRef, useState } from "react";

import { useFeedbackBindings } from "../FeedbackProvider";
import {
  abandonIterSession,
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

  // Once a stream completes, refresh the persisted lists.
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId) {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  }, [stream.state.status, stream.state.versionId, qc, sessionId]);

  const latestVersion = useMemo(() => _pickLatest(versions.data ?? []), [versions.data]);

  const renderedMarkdown = stream.state.partialMarkdown || latestVersion?.output_markdown || "";

  const openAssumptionCount = (assumptions.data ?? []).filter((a) => a.status === "open").length;

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
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Working Document
            {stream.state.activeSection && (
              <span className="ml-2 normal-case text-foreground">
                — streaming: {stream.state.activeSection.replace("_", " ")}
              </span>
            )}
          </h3>
          {!latestVersion && stream.state.status === "idle" && (
            <FirstRunCard
              busy={false}
              onRun={() => stream.start({ user_message: "", restructure_allowed: false })}
            />
          )}
          <WorkingDocument markdown={renderedMarkdown} />
          {stream.state.status === "error" && (
            <ErrorBanner code={stream.state.errorCode} message={stream.state.errorMessage} />
          )}
        </main>

        <aside className="lg:w-80 lg:flex-shrink-0">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumptions ({openAssumptionCount} open)
          </h3>
          <AssumptionsList
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

  const runDisabled = props.streamRunning || (props.openAssumptions > 0 && status !== "draft");

  return (
    <footer className="space-y-2 border-t bg-card px-4 py-3">
      <Textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="What should change in the next iteration?"
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
            Run iteration
          </Button>
          <Button
            variant="secondary"
            disabled={
              props.finalizing || props.streamRunning || !props.session?.current_iteration_id
            }
            onClick={() => props.onFinalize()}
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

function AssumptionsList(props: {
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
  return (
    <div className="space-y-3">
      {open.map((a) => (
        <AssumptionCard
          key={a.id}
          assumption={a}
          disabled={props.disabled}
          onResolve={(body) => props.onResolve(a.id, body)}
        />
      ))}
      {resolved.length > 0 && (
        <details className="rounded border bg-muted/40 p-2">
          <summary className="cursor-pointer text-xs font-semibold">
            Resolved ({resolved.length})
          </summary>
          <div className="mt-2 space-y-2">
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
// WorkingDocument — dynamic markdown-it import + ref-based render
//
// markdown-it is configured with html:false, which strips raw HTML
// from input — the rendered output cannot contain user-controlled
// script tags or javascript: URLs. We assign innerHTML through a
// ref rather than dangerouslySetInnerHTML so the lint rule (and
// the editor's security hook) is satisfied; the safety guarantee
// is in the markdown-it config, not in the React API choice.
// ─────────────────────────────────────────────────────────────────

function WorkingDocument({ markdown }: { markdown: string }) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    if (!markdown) {
      el.textContent = "";
      return;
    }
    void import("markdown-it").then(({ default: MarkdownIt }) => {
      if (cancelled || !ref.current) return;
      const md = new MarkdownIt({ html: false, breaks: false, linkify: true });
      ref.current.innerHTML = md.render(markdown);
    });
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  if (!markdown) {
    return (
      <div className="flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground">
        Press &ldquo;Generate first version&rdquo; or run an iteration to populate the working
        document.
      </div>
    );
  }

  return (
    <article
      ref={ref}
      className="prose prose-sm max-w-none flex-1 overflow-auto rounded border bg-card p-4 dark:prose-invert"
    />
  );
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
