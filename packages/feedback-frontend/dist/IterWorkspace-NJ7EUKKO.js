import {
  AssumptionCard,
  EditableSpecPanel,
  modelLatencyHint,
  useIterRunStream
} from "./chunk-4DXAUH2U.js";
import {
  Button,
  Textarea,
  abandonIterSession,
  editIterVersionMarkdown,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  listIterAssumptions,
  listIterVersions,
  resolveIterAssumption,
  useFeedbackBindings
} from "./chunk-QB73WXKP.js";

// src/iter/IterWorkspace.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function IterWorkspace({ sessionId, onClose }) {
  const bindings = useFeedbackBindings();
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ["iter-session", sessionId],
    queryFn: () => getIterSession(bindings, sessionId)
  });
  const versions = useQuery({
    queryKey: ["iter-versions", sessionId],
    queryFn: () => listIterVersions(bindings, sessionId),
    enabled: !!session.data
  });
  const assumptions = useQuery({
    queryKey: ["iter-assumptions", sessionId],
    queryFn: () => listIterAssumptions(bindings, sessionId),
    enabled: !!session.data?.current_iteration_id
  });
  const stream = useIterRunStream(bindings, sessionId);
  const resolveMutation = useMutation({
    mutationFn: ({
      assumptionId,
      body
    }) => resolveIterAssumption(bindings, assumptionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  });
  const finalizeMutation = useMutation({
    mutationFn: () => finalizeIterSession(bindings, sessionId),
    onSuccess: (pkg) => {
      qc.setQueryData(["iter-package", sessionId], pkg);
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    }
  });
  const abandonMutation = useMutation({
    mutationFn: () => abandonIterSession(bindings, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
    }
  });
  const pkgQuery = useQuery({
    queryKey: ["iter-package", sessionId],
    queryFn: () => getIterPackage(bindings, sessionId),
    enabled: session.data?.status === "finalized"
  });
  const editMarkdownMutation = useMutation({
    mutationFn: ({
      versionId,
      markdown
    }) => editIterVersionMarkdown(bindings, sessionId, versionId, {
      output_markdown: markdown
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
    }
  });
  useEffect(() => {
    if (stream.state.status === "done" && stream.state.versionId) {
      qc.invalidateQueries({ queryKey: ["iter-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-versions", sessionId] });
      qc.invalidateQueries({ queryKey: ["iter-assumptions", sessionId] });
    }
  }, [stream.state.status, stream.state.versionId, qc, sessionId]);
  const latestVersion = useMemo(() => _pickLatest(versions.data ?? []), [versions.data]);
  const isStreaming = stream.state.status === "running";
  const renderedMarkdown = isStreaming ? "" : latestVersion?.output_markdown ?? "";
  const userFacingAssumptions = (assumptions.data ?? []).filter((a) => a.kind !== "technical");
  const openAssumptionCount = userFacingAssumptions.filter((a) => a.status === "open").length;
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
  const needsReviewIteration = !!latestVersion && openAssumptionCount === 0 && latestResolvedAt > 0 && latestResolvedAt > latestVersionAt;
  const canFinalize = !!latestVersion && openAssumptionCount === 0 && !needsReviewIteration;
  const totalAssumptions = userFacingAssumptions.length;
  const resolvedAssumptions = totalAssumptions - openAssumptionCount;
  const progress = totalAssumptions > 0 ? Math.round(resolvedAssumptions / totalAssumptions * 100) : 0;
  const [tab, setTab] = useState("document");
  const [seenAssumptionsBadge, setSeenAssumptionsBadge] = useState(false);
  useEffect(() => {
    if (!seenAssumptionsBadge && openAssumptionCount > 0 && tab === "document") {
    }
  }, [openAssumptionCount, tab, seenAssumptionsBadge]);
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-[60] flex flex-col bg-background text-foreground", children: [
    /* @__PURE__ */ jsx(
      Header,
      {
        session: session.data,
        onClose,
        onAbandon: () => abandonMutation.mutate(),
        terminal: session.data?.status === "finalized" || session.data?.status === "abandoned",
        progress,
        resolvedCount: resolvedAssumptions,
        totalCount: totalAssumptions,
        streaming: isStreaming,
        streamSection: stream.state.activeSection
      }
    ),
    /* @__PURE__ */ jsx(
      TabBar,
      {
        tab,
        onChange: (t) => {
          setTab(t);
          if (t === "assumptions") setSeenAssumptionsBadge(true);
        },
        openAssumptionCount,
        totalAssumptionCount: totalAssumptions,
        versionCount: (versions.data ?? []).length
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [
      tab === "document" && /* @__PURE__ */ jsx(
        DocumentTab,
        {
          markdown: renderedMarkdown,
          streaming: isStreaming,
          activeSection: stream.state.activeSection,
          latestVersion,
          sessionStatus: session.data?.status,
          streamStatus: stream.state.status,
          streamErrorCode: stream.state.errorCode,
          streamErrorMessage: stream.state.errorMessage,
          onFirstRun: () => stream.start({ user_message: "", restructure_allowed: false }),
          onSaveEdit: async (next) => {
            if (!latestVersion) return;
            await editMarkdownMutation.mutateAsync({
              versionId: latestVersion.id,
              markdown: next
            });
          },
          saving: editMarkdownMutation.isPending,
          modelHint: modelLatencyHint(_resolveDisplayModel(session.data))
        }
      ),
      tab === "assumptions" && /* @__PURE__ */ jsx(
        AssumptionsTab,
        {
          items: assumptions.data ?? [],
          onResolve: (assumptionId, body) => resolveMutation.mutateAsync({ assumptionId, body }),
          disabled: session.data?.status === "finalized" || session.data?.status === "abandoned"
        }
      ),
      tab === "activity" && /* @__PURE__ */ jsx(ActivityTab, { versions: versions.data ?? [] })
    ] }),
    /* @__PURE__ */ jsx(
      Footer,
      {
        session: session.data,
        package: pkgQuery.data,
        openAssumptions: openAssumptionCount,
        streamRunning: stream.state.status === "running",
        canFinalize,
        needsReviewIteration,
        onRun: (payload) => stream.start(payload),
        onFinalize: () => finalizeMutation.mutateAsync(),
        finalizing: finalizeMutation.isPending
      }
    )
  ] });
}
function Header(props) {
  return /* @__PURE__ */ jsxs("header", { className: "flex items-center gap-3 border-b bg-card px-4 py-2 text-sm", children: [
    /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Iterate with AI" }),
    /* @__PURE__ */ jsx("span", { className: "rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground", children: props.session?.status ?? "loading" }),
    /* @__PURE__ */ jsxs("span", { className: "hidden text-xs text-muted-foreground md:inline", children: [
      "model: ",
      _resolveDisplayModel(props.session)
    ] }),
    props.streaming && /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5 text-xs text-primary", children: [
      /* @__PURE__ */ jsx(Loader2, { className: "h-3 w-3 animate-spin" }),
      props.streamSection ? `Writing ${props.streamSection.replace("_", " ")}\u2026` : "AI is thinking\u2026"
    ] }),
    props.totalCount > 0 && /* @__PURE__ */ jsxs("div", { className: "ml-2 hidden items-center gap-2 md:flex", children: [
      /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground", children: [
        props.resolvedCount,
        "/",
        props.totalCount,
        " resolved"
      ] }),
      /* @__PURE__ */ jsx("div", { className: "h-1.5 w-24 overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsx(
        "div",
        {
          className: "h-full rounded-full bg-primary transition-all",
          style: { width: `${props.progress}%` }
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "ml-auto flex items-center gap-2", children: [
      !props.terminal && props.onAbandon && /* @__PURE__ */ jsx(Button, { size: "sm", variant: "ghost", onClick: props.onAbandon, children: "Discard session" }),
      props.onClose && /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: props.onClose, children: "Close" })
    ] })
  ] });
}
function TabBar(props) {
  const tabs = [
    { key: "document", label: "Document", badge: null },
    {
      key: "assumptions",
      label: "Assumptions",
      badge: props.totalAssumptionCount > 0 ? `${props.openAssumptionCount}/${props.totalAssumptionCount}` : null
    },
    {
      key: "activity",
      label: "Activity",
      badge: props.versionCount > 0 ? `v${props.versionCount}` : null
    }
  ];
  return /* @__PURE__ */ jsx("div", { className: "flex items-center gap-1 border-b bg-card px-3", role: "tablist", children: tabs.map((t) => {
    const active = props.tab === t.key;
    return /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": active,
        onClick: () => props.onChange(t.key),
        className: `flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`,
        children: [
          t.label,
          t.badge && /* @__PURE__ */ jsx(
            "span",
            {
              className: `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`,
              children: t.badge
            }
          )
        ]
      },
      t.key
    );
  }) });
}
function DocumentTab(props) {
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto flex w-full max-w-[1400px] flex-row gap-6 p-4 lg:p-6", children: [
    props.markdown && !props.streaming && /* @__PURE__ */ jsx(DocumentTOC, { markdown: props.markdown }),
    /* @__PURE__ */ jsxs("main", { className: "flex flex-1 flex-col", children: [
      !props.latestVersion && props.streamStatus === "idle" && /* @__PURE__ */ jsx(FirstRunCard, { busy: false, onRun: props.onFirstRun }),
      /* @__PURE__ */ jsx(
        EditableSpecPanel,
        {
          markdown: props.markdown,
          streaming: props.streaming,
          activeSection: props.activeSection,
          editable: !!props.latestVersion && !props.streaming && props.sessionStatus !== "finalized" && props.sessionStatus !== "abandoned",
          onSaveEdit: props.onSaveEdit,
          saving: props.saving,
          modelHint: props.modelHint
        }
      ),
      props.streamStatus === "error" && /* @__PURE__ */ jsx(ErrorBanner, { code: props.streamErrorCode, message: props.streamErrorMessage })
    ] })
  ] });
}
function DocumentTOC({ markdown }) {
  const headings = useMemo(() => {
    const out = [];
    for (const raw of markdown.split("\n")) {
      const m = /^(#{1,2})\s+(.+?)\s*$/.exec(raw);
      if (!m) continue;
      const level = m[1]?.length === 1 ? 1 : 2;
      const text = (m[2] ?? "").replace(/[*_`]/g, "").trim();
      if (!text) continue;
      const id = `iter-toc-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
      out.push({ level, text, id });
    }
    return out;
  }, [markdown]);
  if (headings.length < 2) return null;
  return /* @__PURE__ */ jsx("aside", { className: "hidden w-56 shrink-0 lg:block", children: /* @__PURE__ */ jsxs("div", { className: "sticky top-2", children: [
    /* @__PURE__ */ jsx("h4", { className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: "On this page" }),
    /* @__PURE__ */ jsx("ul", { className: "space-y-1 text-sm", children: headings.map((h) => /* @__PURE__ */ jsx("li", { className: h.level === 2 ? "ml-3 text-xs text-muted-foreground" : "", children: /* @__PURE__ */ jsx(
      "a",
      {
        href: `#${h.id}`,
        className: "block rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground",
        onClick: (e) => {
          e.preventDefault();
          document.getElementById(h.id)?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        },
        children: h.text
      }
    ) }, h.id)) })
  ] }) });
}
function AssumptionsTab(props) {
  return /* @__PURE__ */ jsx("div", { className: "mx-auto w-full max-w-[1600px] p-4 lg:p-6", children: /* @__PURE__ */ jsx(AssumptionsGrid, { items: props.items, onResolve: props.onResolve, disabled: props.disabled }) });
}
function ActivityTab({ versions }) {
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto w-full max-w-[1100px] p-4 lg:p-6", children: [
    /* @__PURE__ */ jsx("h3", { className: "mb-3 text-sm font-semibold", children: "Iteration history" }),
    /* @__PURE__ */ jsx(ActivityTimeline, { versions })
  ] });
}
function Footer(props) {
  const [msg, setMsg] = useState("");
  const [restructure, setRestructure] = useState(false);
  const status = props.session?.status;
  if (status === "finalized") {
    return /* @__PURE__ */ jsx("footer", { className: "border-t bg-card px-4 py-3 text-sm", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Session finalized." }),
      props.package?.presigned_zip_url && /* @__PURE__ */ jsx("a", { href: props.package.presigned_zip_url, className: "text-primary underline", download: true, children: "Download package ZIP" })
    ] }) });
  }
  if (status === "abandoned") {
    return /* @__PURE__ */ jsx("footer", { className: "border-t bg-card px-4 py-3 text-sm text-muted-foreground", children: "Session abandoned." });
  }
  const runDisabled = props.streamRunning || props.openAssumptions > 0 && status !== "draft" && !props.needsReviewIteration;
  const finalizeBlocked = !props.session?.current_iteration_id || props.finalizing || props.streamRunning;
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
  return /* @__PURE__ */ jsxs("footer", { className: "space-y-2 border-t bg-card px-4 py-3", children: [
    props.needsReviewIteration && /* @__PURE__ */ jsxs("div", { className: "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200", children: [
      /* @__PURE__ */ jsx("p", { className: "font-semibold", children: "All assumptions resolved." }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Add a comment below if you want, then press ",
        /* @__PURE__ */ jsx("strong", { children: "Run iteration" }),
        " so the AI rewrites the working document with your answers baked in. Once you review that version, you can finalize."
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      Textarea,
      {
        value: msg,
        onChange: (e) => setMsg(e.target.value),
        placeholder: props.needsReviewIteration ? "Optional: any extra notes for the next iteration" : "What should change in the next iteration?",
        rows: 2,
        disabled: props.streamRunning
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: restructure,
            onChange: (e) => setRestructure(e.target.checked),
            disabled: props.streamRunning
          }
        ),
        "Allow restructuring (may remove prior content)"
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "ml-auto flex gap-2", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            disabled: runDisabled,
            onClick: () => {
              props.onRun({
                user_message: msg,
                restructure_allowed: restructure
              });
              setMsg("");
            },
            children: props.needsReviewIteration ? "Run iteration (review)" : "Run iteration"
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "secondary",
            disabled: finalizeBlocked,
            onClick: onFinalizeClick,
            title: !props.session?.current_iteration_id ? "Generate a version first" : props.canFinalize ? "Finalize and produce the package" : "Finalize anyway (you'll be asked to confirm)",
            children: "Finalize"
          }
        )
      ] })
    ] }),
    props.openAssumptions > 0 && status !== "draft" && /* @__PURE__ */ jsxs("p", { className: "text-xs text-amber-700", children: [
      "Resolve all ",
      props.openAssumptions,
      " open assumption(s) before iterating."
    ] }),
    showFinalizeWarning && /* @__PURE__ */ jsx(
      FinalizeWarningModal,
      {
        openAssumptions: props.openAssumptions,
        needsReviewIteration: props.needsReviewIteration,
        hasAnyVersion: !!props.session?.current_iteration_id,
        onConfirm: confirmFinalize,
        onCancel: cancelFinalize
      }
    )
  ] });
}
function FinalizeWarningModal(props) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) el.showModal();
    const onCancel = (e) => {
      e.preventDefault();
      props.onCancel();
    };
    el.addEventListener("cancel", onCancel);
    return () => {
      el.removeEventListener("cancel", onCancel);
      if (el.open) el.close();
    };
  }, [props.onCancel]);
  return /* @__PURE__ */ jsxs(
    "dialog",
    {
      ref: dialogRef,
      className: "z-[80] max-w-md rounded-lg border bg-card p-5 shadow-lg backdrop:bg-black/40",
      "aria-labelledby": "iter-finalize-warning-title",
      children: [
        /* @__PURE__ */ jsx(
          "h2",
          {
            id: "iter-finalize-warning-title",
            className: "mb-2 text-base font-semibold text-amber-900 dark:text-amber-200",
            children: "Finalize without completing review?"
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "The dev team interprets the package as the source of truth. If you finalize now, the following items aren't fully clarified:" }),
        /* @__PURE__ */ jsxs("ul", { className: "mt-3 list-disc space-y-1 pl-5 text-sm", children: [
          props.openAssumptions > 0 && /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: props.openAssumptions }),
            " assumption",
            props.openAssumptions === 1 ? " is" : "s are",
            " still open and will be packaged as",
            " ",
            /* @__PURE__ */ jsx("em", { children: "unresolved" }),
            "."
          ] }),
          props.needsReviewIteration && /* @__PURE__ */ jsx("li", { children: "You haven't run a review iteration since resolving assumptions, so the working document doesn't reflect your answers yet." }),
          !props.hasAnyVersion && /* @__PURE__ */ jsx("li", { children: "The session has no version yet \u2014 there's nothing to package." })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-muted-foreground", children: "You can still finalize \u2014 useful when you'd rather hand off a partial spec than block on perfection. The dev team can ask follow-ups." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-5 flex justify-end gap-2", children: [
          /* @__PURE__ */ jsx(Button, { variant: "outline", size: "sm", onClick: props.onCancel, children: "Cancel \u2014 I'll keep iterating" }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "destructive",
              size: "sm",
              onClick: props.onConfirm,
              disabled: !props.hasAnyVersion,
              children: "Finalize anyway"
            }
          )
        ] })
      ]
    }
  );
}
function ActivityTimeline({ versions }) {
  if (!versions.length) {
    return /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "No iterations yet." });
  }
  return /* @__PURE__ */ jsx("ol", { className: "space-y-2", children: versions.map((v) => /* @__PURE__ */ jsxs("li", { className: "rounded border bg-card p-2 text-xs", children: [
    /* @__PURE__ */ jsxs("div", { className: "font-semibold", children: [
      "v",
      v.version_number
    ] }),
    /* @__PURE__ */ jsx("div", { className: "text-muted-foreground", children: new Date(v.created_at).toLocaleString() }),
    v.user_message && /* @__PURE__ */ jsx("div", { className: "mt-1 text-foreground/80 line-clamp-2", children: v.user_message }),
    v.restructure_allowed && /* @__PURE__ */ jsx("span", { className: "mt-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-900", children: "restructure" })
  ] }, v.id)) });
}
var _KIND_BAND = {
  technical: {
    name: "Technical",
    band: "border-l-blue-400 bg-blue-50/40 dark:bg-blue-900/10"
  },
  business: {
    name: "Business",
    band: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10"
  },
  ux: {
    name: "UX",
    band: "border-l-violet-400 bg-violet-50/40 dark:bg-violet-900/10"
  },
  scope: {
    name: "Scope",
    band: "border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10"
  }
};
var _KIND_ORDER = ["ux", "business", "scope"];
function AssumptionsGrid(props) {
  if (!props.items.length) {
    return /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground", children: "No assumptions on the current version yet." });
  }
  const userFacingOpen = props.items.filter((a) => a.status === "open" && a.kind !== "technical");
  const userFacingDone = props.items.filter((a) => a.status !== "open" && a.kind !== "technical");
  const internalNotes = props.items.filter((a) => a.kind === "technical");
  const grouped = {
    technical: [],
    ux: [],
    business: [],
    scope: []
  };
  for (const a of userFacingOpen) grouped[a.kind].push(a);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    _KIND_ORDER.map((kind) => {
      const items = grouped[kind];
      if (!items.length) return null;
      const meta = _KIND_BAND[kind];
      const dotColor = (meta.band.split(" ")[0] ?? "").replace("border-l-", "bg-");
      return /* @__PURE__ */ jsxs("section", { children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-1.5 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: `inline-block h-2 w-2 rounded-full ${dotColor}` }),
          /* @__PURE__ */ jsx("h4", { className: "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: meta.name }),
          /* @__PURE__ */ jsx("span", { className: "rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground", children: items.length })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: items.map((a) => /* @__PURE__ */ jsx("div", { className: `rounded-md border-l-4 ${meta.band} [&>div]:border-l-0`, children: /* @__PURE__ */ jsx(
          AssumptionCard,
          {
            assumption: a,
            disabled: props.disabled,
            onResolve: (body) => props.onResolve(a.id, body)
          }
        ) }, a.id)) })
      ] }, kind);
    }),
    userFacingDone.length > 0 && /* @__PURE__ */ jsxs("details", { className: "rounded border bg-muted/40 p-3", open: true, children: [
      /* @__PURE__ */ jsxs("summary", { className: "cursor-pointer text-xs font-semibold", children: [
        "Resolved (",
        userFacingDone.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: userFacingDone.map((a) => {
        const meta = _KIND_BAND[a.kind];
        return /* @__PURE__ */ jsx("div", { className: `rounded-md border-l-4 ${meta.band} [&>div]:border-l-0`, children: /* @__PURE__ */ jsx(
          AssumptionCard,
          {
            assumption: a,
            disabled: props.disabled,
            onResolve: (body) => props.onResolve(a.id, body)
          }
        ) }, a.id);
      }) })
    ] }),
    internalNotes.length > 0 && /* @__PURE__ */ jsxs("details", { className: "rounded border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-900/10", children: [
      /* @__PURE__ */ jsxs("summary", { className: "cursor-pointer text-xs font-semibold text-blue-900 dark:text-blue-200", children: [
        "AI-internal notes (",
        internalNotes.length,
        ") \u2014 no action required"
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-[11px] text-muted-foreground", children: "These are notes the AI is leaving for the downstream developer agent that will read your finalized package. They describe implementation details (architecture, code patterns, framework choices) that you wouldn't typically know \u2014 they ship with the package automatically." }),
      /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-2", children: internalNotes.map((a) => /* @__PURE__ */ jsxs(
        "li",
        {
          className: "rounded border border-blue-200 bg-white/60 p-2 text-xs dark:border-blue-900/50 dark:bg-blue-950/20",
          children: [
            /* @__PURE__ */ jsx("div", { className: "font-medium text-foreground/90", children: a.statement }),
            a.rationale && /* @__PURE__ */ jsx("div", { className: "mt-1 text-muted-foreground", children: a.rationale })
          ]
        },
        a.id
      )) })
    ] })
  ] });
}
function FirstRunCard({ busy, onRun }) {
  return /* @__PURE__ */ jsxs("div", { className: "mb-3 rounded-md border bg-muted/40 p-4 text-sm", children: [
    /* @__PURE__ */ jsx("p", { className: "mb-2", children: "The AI will read your feedback, attachments, and technical metadata, then propose user personas, user stories, a spec, and a list of every assumption it had to make. You will resolve those assumptions before iterating again." }),
    /* @__PURE__ */ jsx(Button, { onClick: onRun, disabled: busy, children: "Generate first version" })
  ] });
}
function ErrorBanner(props) {
  return /* @__PURE__ */ jsxs("div", { className: "mt-2 rounded border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive", children: [
    /* @__PURE__ */ jsxs("div", { className: "font-semibold", children: [
      "Error: ",
      props.code
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs", children: props.message })
  ] });
}
function _resolveDisplayModel(session) {
  if (!session) return "(loading)";
  const isActive = session.status === "draft" || session.status === "iterating";
  if (isActive && session.current_primary_model_id) {
    return session.current_primary_model_id;
  }
  return session.last_call_model_id ?? session.model_id ?? "(none)";
}
function _pickLatest(versions) {
  if (!versions.length) return null;
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
  return sorted[0] ?? null;
}
function IterWorkspaceNamed(props) {
  return /* @__PURE__ */ jsx(IterWorkspace, { ...props });
}
var IterWorkspaceComponent = IterWorkspaceNamed;
export {
  IterWorkspace,
  IterWorkspaceComponent,
  IterWorkspace as default
};
//# sourceMappingURL=IterWorkspace-NJ7EUKKO.js.map