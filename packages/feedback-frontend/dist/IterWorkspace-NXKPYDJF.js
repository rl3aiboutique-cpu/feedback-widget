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
  newIdempotencyKey,
  resolveIterAssumption,
  runIterationStream,
  useFeedbackBindings
} from "./chunk-6R2CBXYH.js";

// src/iter/IterWorkspace.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef as useRef2, useState as useState3 } from "react";

// src/iter/AssumptionCard.tsx
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var _KIND_BADGE = {
  technical: "bg-blue-100 text-blue-900",
  business: "bg-amber-100 text-amber-900",
  ux: "bg-violet-100 text-violet-900",
  scope: "bg-emerald-100 text-emerald-900"
};
var _STATUS_BADGE = {
  open: "bg-yellow-100 text-yellow-900",
  confirmed: "bg-green-100 text-green-900",
  corrected: "bg-blue-100 text-blue-900",
  irrelevant: "bg-gray-100 text-gray-700"
};
function AssumptionCard({ assumption, onResolve, disabled }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reopen, setReopen] = useState(false);
  const isOpen = assumption.status === "open" || reopen;
  const click = async (status, user_response) => {
    setBusy(true);
    try {
      await onResolve({ status, user_response });
      setEditing(false);
      setText("");
      setReopen(false);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "rounded-md border bg-card p-3 text-sm shadow-xs", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center gap-2", children: [
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `inline-block rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide ${_KIND_BADGE[assumption.kind]}`,
          children: assumption.kind
        }
      ),
      /* @__PURE__ */ jsx(
        "span",
        {
          className: `inline-block rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide ${_STATUS_BADGE[assumption.status]}`,
          children: assumption.status
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "ml-auto text-[11px] text-muted-foreground", children: [
        Math.round(Number(assumption.confidence) * 100),
        "%"
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mb-1 font-medium leading-snug", children: assumption.statement }),
    /* @__PURE__ */ jsx("p", { className: "mb-2 text-[12px] leading-snug text-muted-foreground", children: assumption.rationale }),
    /* @__PURE__ */ jsx("p", { className: "mb-2 font-mono text-[10px] text-muted-foreground/80", children: assumption.slot_key }),
    assumption.status === "corrected" && assumption.user_response && /* @__PURE__ */ jsxs("div", { className: "mb-2 rounded bg-muted p-2 text-[12px]", children: [
      /* @__PURE__ */ jsx("div", { className: "mb-1 font-semibold", children: "Your correction:" }),
      assumption.user_response
    ] }),
    assumption.status !== "open" && !reopen && !disabled && /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: () => setReopen(true),
        className: "mb-2 text-[11px] font-medium text-primary hover:underline",
        children: "\u270E Change my answer"
      }
    ),
    isOpen && !editing && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx(Button, { size: "sm", disabled: busy || disabled, onClick: () => click("confirmed"), children: "Confirm" }),
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          variant: "outline",
          disabled: busy || disabled,
          onClick: () => setEditing(true),
          children: "Correct"
        }
      ),
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          variant: "ghost",
          disabled: busy || disabled,
          onClick: () => click("irrelevant"),
          children: "Mark irrelevant"
        }
      )
    ] }),
    isOpen && editing && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx(
        Textarea,
        {
          value: text,
          onChange: (e) => setText(e.target.value),
          placeholder: "What's the correct answer?",
          rows: 3
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            size: "sm",
            disabled: busy || disabled || !text.trim(),
            onClick: () => click("corrected", text.trim()),
            children: "Save correction"
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            size: "sm",
            variant: "ghost",
            disabled: busy,
            onClick: () => {
              setEditing(false);
              setText("");
            },
            children: "Cancel"
          }
        )
      ] })
    ] })
  ] });
}

// src/iter/useIterRunStream.ts
import { useCallback, useRef, useState as useState2 } from "react";
var _INIT = {
  status: "idle",
  partialMarkdown: "",
  activeSection: null,
  versionId: null,
  versionNumber: null,
  errorCode: null,
  errorMessage: null
};
function useIterRunStream(bindings, sessionId) {
  const [state, setState] = useState2(_INIT);
  const abortRef = useRef(null);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(_INIT);
  }, []);
  const start = useCallback(
    async (body) => {
      reset();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ ..._INIT, status: "running" });
      try {
        await runIterationStream({
          bindings,
          sessionId,
          body,
          idempotencyKey: newIdempotencyKey(),
          signal: ctrl.signal,
          onEvent: (ev) => {
            setState((cur) => _reduce(cur, ev));
          }
        });
        setState((cur) => cur.status === "running" ? { ...cur, status: "done" } : cur);
      } catch (err) {
        const apiErr = err;
        setState((cur) => ({
          ...cur,
          status: "error",
          errorCode: String(apiErr?.status ?? "network"),
          errorMessage: String(apiErr?.detail ?? apiErr?.message ?? err)
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [bindings, sessionId, reset]
  );
  return { state, start, reset };
}
function _reduce(cur, ev) {
  switch (ev.type) {
    case "token":
      return { ...cur, partialMarkdown: cur.partialMarkdown + ev.chunk };
    case "section":
      return { ...cur, activeSection: ev.section };
    case "done":
      return {
        ...cur,
        status: "done",
        versionId: ev.version_id,
        versionNumber: ev.version_number
      };
    case "error":
      return {
        ...cur,
        status: "error",
        errorCode: ev.error_code,
        errorMessage: ev.message
      };
    case "heartbeat":
      return cur;
    default:
      return cur;
  }
}

// src/iter/IterWorkspace.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
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
  const openAssumptionCount = (assumptions.data ?? []).filter((a) => a.status === "open").length;
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
  const totalAssumptions = (assumptions.data ?? []).length;
  const resolvedAssumptions = totalAssumptions - openAssumptionCount;
  const progress = totalAssumptions > 0 ? Math.round(resolvedAssumptions / totalAssumptions * 100) : 0;
  const [tab, setTab] = useState3("document");
  const [seenAssumptionsBadge, setSeenAssumptionsBadge] = useState3(false);
  useEffect(() => {
    if (!seenAssumptionsBadge && openAssumptionCount > 0 && tab === "document") {
    }
  }, [openAssumptionCount, tab, seenAssumptionsBadge]);
  return /* @__PURE__ */ jsxs2("div", { className: "fixed inset-0 z-[60] flex flex-col bg-background text-foreground", children: [
    /* @__PURE__ */ jsx2(
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
    /* @__PURE__ */ jsx2(
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
    /* @__PURE__ */ jsxs2("div", { className: "flex-1 min-h-0 overflow-y-auto", children: [
      tab === "document" && /* @__PURE__ */ jsx2(
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
          saving: editMarkdownMutation.isPending
        }
      ),
      tab === "assumptions" && /* @__PURE__ */ jsx2(
        AssumptionsTab,
        {
          items: assumptions.data ?? [],
          onResolve: (assumptionId, body) => resolveMutation.mutateAsync({ assumptionId, body }),
          disabled: session.data?.status === "finalized" || session.data?.status === "abandoned"
        }
      ),
      tab === "activity" && /* @__PURE__ */ jsx2(ActivityTab, { versions: versions.data ?? [] })
    ] }),
    /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsxs2("header", { className: "flex items-center gap-3 border-b bg-card px-4 py-2 text-sm", children: [
    /* @__PURE__ */ jsx2("span", { className: "font-semibold", children: "Iterate with AI" }),
    /* @__PURE__ */ jsx2("span", { className: "rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground", children: props.session?.status ?? "loading" }),
    /* @__PURE__ */ jsxs2("span", { className: "hidden text-xs text-muted-foreground md:inline", children: [
      "model: ",
      props.session?.model_id ?? "(none)"
    ] }),
    props.streaming && /* @__PURE__ */ jsxs2("span", { className: "flex items-center gap-1.5 text-xs text-primary", children: [
      /* @__PURE__ */ jsx2(Loader2, { className: "h-3 w-3 animate-spin" }),
      props.streamSection ? `Writing ${props.streamSection.replace("_", " ")}\u2026` : "AI is thinking\u2026"
    ] }),
    props.totalCount > 0 && /* @__PURE__ */ jsxs2("div", { className: "ml-2 hidden items-center gap-2 md:flex", children: [
      /* @__PURE__ */ jsxs2("span", { className: "text-xs text-muted-foreground", children: [
        props.resolvedCount,
        "/",
        props.totalCount,
        " resolved"
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "h-1.5 w-24 overflow-hidden rounded-full bg-muted", children: /* @__PURE__ */ jsx2(
        "div",
        {
          className: "h-full rounded-full bg-primary transition-all",
          style: { width: `${props.progress}%` }
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "ml-auto flex items-center gap-2", children: [
      !props.terminal && props.onAbandon && /* @__PURE__ */ jsx2(Button, { size: "sm", variant: "ghost", onClick: props.onAbandon, children: "Discard session" }),
      props.onClose && /* @__PURE__ */ jsx2(Button, { size: "sm", variant: "outline", onClick: props.onClose, children: "Close" })
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
  return /* @__PURE__ */ jsx2("div", { className: "flex items-center gap-1 border-b bg-card px-3", role: "tablist", children: tabs.map((t) => {
    const active = props.tab === t.key;
    return /* @__PURE__ */ jsxs2(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": active,
        onClick: () => props.onChange(t.key),
        className: `flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`,
        children: [
          t.label,
          t.badge && /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsxs2("div", { className: "mx-auto flex w-full max-w-[1400px] flex-row gap-6 p-4 lg:p-6", children: [
    props.markdown && !props.streaming && /* @__PURE__ */ jsx2(DocumentTOC, { markdown: props.markdown }),
    /* @__PURE__ */ jsxs2("main", { className: "flex flex-1 flex-col", children: [
      !props.latestVersion && props.streamStatus === "idle" && /* @__PURE__ */ jsx2(FirstRunCard, { busy: false, onRun: props.onFirstRun }),
      /* @__PURE__ */ jsx2(
        WorkingDocumentPanel,
        {
          markdown: props.markdown,
          streaming: props.streaming,
          activeSection: props.activeSection,
          editable: !!props.latestVersion && !props.streaming && props.sessionStatus !== "finalized" && props.sessionStatus !== "abandoned",
          onSaveEdit: props.onSaveEdit,
          saving: props.saving
        }
      ),
      props.streamStatus === "error" && /* @__PURE__ */ jsx2(ErrorBanner, { code: props.streamErrorCode, message: props.streamErrorMessage })
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
  return /* @__PURE__ */ jsx2("aside", { className: "hidden w-56 shrink-0 lg:block", children: /* @__PURE__ */ jsxs2("div", { className: "sticky top-2", children: [
    /* @__PURE__ */ jsx2("h4", { className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: "On this page" }),
    /* @__PURE__ */ jsx2("ul", { className: "space-y-1 text-sm", children: headings.map((h) => /* @__PURE__ */ jsx2("li", { className: h.level === 2 ? "ml-3 text-xs text-muted-foreground" : "", children: /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsx2("div", { className: "mx-auto w-full max-w-[1600px] p-4 lg:p-6", children: /* @__PURE__ */ jsx2(AssumptionsGrid, { items: props.items, onResolve: props.onResolve, disabled: props.disabled }) });
}
function ActivityTab({ versions }) {
  return /* @__PURE__ */ jsxs2("div", { className: "mx-auto w-full max-w-[1100px] p-4 lg:p-6", children: [
    /* @__PURE__ */ jsx2("h3", { className: "mb-3 text-sm font-semibold", children: "Iteration history" }),
    /* @__PURE__ */ jsx2(ActivityTimeline, { versions })
  ] });
}
function Footer(props) {
  const [msg, setMsg] = useState3("");
  const [restructure, setRestructure] = useState3(false);
  const status = props.session?.status;
  if (status === "finalized") {
    return /* @__PURE__ */ jsx2("footer", { className: "border-t bg-card px-4 py-3 text-sm", children: /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx2("span", { className: "font-semibold", children: "Session finalized." }),
      props.package?.presigned_zip_url && /* @__PURE__ */ jsx2("a", { href: props.package.presigned_zip_url, className: "text-primary underline", download: true, children: "Download package ZIP" })
    ] }) });
  }
  if (status === "abandoned") {
    return /* @__PURE__ */ jsx2("footer", { className: "border-t bg-card px-4 py-3 text-sm text-muted-foreground", children: "Session abandoned." });
  }
  const runDisabled = props.streamRunning || props.openAssumptions > 0 && status !== "draft" && !props.needsReviewIteration;
  const finalizeDisabled = props.finalizing || props.streamRunning || !props.session?.current_iteration_id || !props.canFinalize;
  return /* @__PURE__ */ jsxs2("footer", { className: "space-y-2 border-t bg-card px-4 py-3", children: [
    props.needsReviewIteration && /* @__PURE__ */ jsxs2("div", { className: "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200", children: [
      /* @__PURE__ */ jsx2("p", { className: "font-semibold", children: "All assumptions resolved." }),
      /* @__PURE__ */ jsxs2("p", { children: [
        "Add a comment below if you want, then press ",
        /* @__PURE__ */ jsx2("strong", { children: "Run iteration" }),
        " so the AI rewrites the working document with your answers baked in. Once you review that version, you can finalize."
      ] })
    ] }),
    /* @__PURE__ */ jsx2(
      Textarea,
      {
        value: msg,
        onChange: (e) => setMsg(e.target.value),
        placeholder: props.needsReviewIteration ? "Optional: any extra notes for the next iteration" : "What should change in the next iteration?",
        rows: 2,
        disabled: props.streamRunning
      }
    ),
    /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsxs2("label", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [
        /* @__PURE__ */ jsx2(
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
      /* @__PURE__ */ jsxs2("div", { className: "ml-auto flex gap-2", children: [
        /* @__PURE__ */ jsx2(
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
        /* @__PURE__ */ jsx2(
          Button,
          {
            variant: "secondary",
            disabled: finalizeDisabled,
            onClick: () => props.onFinalize(),
            title: !props.session?.current_iteration_id ? "Generate a version first" : props.openAssumptions > 0 ? "Resolve all assumptions first" : props.needsReviewIteration ? "Run a review iteration so the spec reflects your answers, then finalize" : "Finalize and produce the package",
            children: "Finalize"
          }
        )
      ] })
    ] }),
    props.openAssumptions > 0 && status !== "draft" && /* @__PURE__ */ jsxs2("p", { className: "text-xs text-amber-700", children: [
      "Resolve all ",
      props.openAssumptions,
      " open assumption(s) before iterating."
    ] })
  ] });
}
function ActivityTimeline({ versions }) {
  if (!versions.length) {
    return /* @__PURE__ */ jsx2("p", { className: "text-xs text-muted-foreground", children: "No iterations yet." });
  }
  return /* @__PURE__ */ jsx2("ol", { className: "space-y-2", children: versions.map((v) => /* @__PURE__ */ jsxs2("li", { className: "rounded border bg-card p-2 text-xs", children: [
    /* @__PURE__ */ jsxs2("div", { className: "font-semibold", children: [
      "v",
      v.version_number
    ] }),
    /* @__PURE__ */ jsx2("div", { className: "text-muted-foreground", children: new Date(v.created_at).toLocaleString() }),
    v.user_message && /* @__PURE__ */ jsx2("div", { className: "mt-1 text-foreground/80 line-clamp-2", children: v.user_message }),
    v.restructure_allowed && /* @__PURE__ */ jsx2("span", { className: "mt-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-900", children: "restructure" })
  ] }, v.id)) });
}
var _KIND_BAND = {
  technical: { name: "Technical", band: "border-l-blue-400 bg-blue-50/40 dark:bg-blue-900/10" },
  business: {
    name: "Business",
    band: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10"
  },
  ux: { name: "UX", band: "border-l-violet-400 bg-violet-50/40 dark:bg-violet-900/10" },
  scope: {
    name: "Scope",
    band: "border-l-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10"
  }
};
var _KIND_ORDER = ["technical", "ux", "business", "scope"];
function AssumptionsGrid(props) {
  if (!props.items.length) {
    return /* @__PURE__ */ jsx2("p", { className: "text-xs text-muted-foreground", children: "No assumptions on the current version yet." });
  }
  const open = props.items.filter((a) => a.status === "open");
  const resolved = props.items.filter((a) => a.status !== "open");
  const grouped = {
    technical: [],
    ux: [],
    business: [],
    scope: []
  };
  for (const a of open) grouped[a.kind].push(a);
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-4", children: [
    _KIND_ORDER.map((kind) => {
      const items = grouped[kind];
      if (!items.length) return null;
      const meta = _KIND_BAND[kind];
      const dotColor = (meta.band.split(" ")[0] ?? "").replace("border-l-", "bg-");
      return /* @__PURE__ */ jsxs2("section", { children: [
        /* @__PURE__ */ jsxs2("div", { className: "mb-1.5 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx2("span", { className: `inline-block h-2 w-2 rounded-full ${dotColor}` }),
          /* @__PURE__ */ jsx2("h4", { className: "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", children: meta.name }),
          /* @__PURE__ */ jsx2("span", { className: "rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground", children: items.length })
        ] }),
        /* @__PURE__ */ jsx2("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: items.map((a) => /* @__PURE__ */ jsx2("div", { className: `rounded-md border-l-4 ${meta.band} [&>div]:border-l-0`, children: /* @__PURE__ */ jsx2(
          AssumptionCard,
          {
            assumption: a,
            disabled: props.disabled,
            onResolve: (body) => props.onResolve(a.id, body)
          }
        ) }, a.id)) })
      ] }, kind);
    }),
    resolved.length > 0 && /* @__PURE__ */ jsxs2("details", { className: "rounded border bg-muted/40 p-3", open: true, children: [
      /* @__PURE__ */ jsxs2("summary", { className: "cursor-pointer text-xs font-semibold", children: [
        "Resolved (",
        resolved.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: resolved.map((a) => {
        const meta = _KIND_BAND[a.kind];
        return /* @__PURE__ */ jsx2("div", { className: `rounded-md border-l-4 ${meta.band} [&>div]:border-l-0`, children: /* @__PURE__ */ jsx2(
          AssumptionCard,
          {
            assumption: a,
            disabled: props.disabled,
            onResolve: (body) => props.onResolve(a.id, body)
          }
        ) }, a.id);
      }) })
    ] })
  ] });
}
function FirstRunCard({ busy, onRun }) {
  return /* @__PURE__ */ jsxs2("div", { className: "mb-3 rounded-md border bg-muted/40 p-4 text-sm", children: [
    /* @__PURE__ */ jsx2("p", { className: "mb-2", children: "The AI will read your feedback, attachments, and technical metadata, then propose user personas, user stories, a spec, and a list of every assumption it had to make. You will resolve those assumptions before iterating again." }),
    /* @__PURE__ */ jsx2(Button, { onClick: onRun, disabled: busy, children: "Generate first version" })
  ] });
}
function ErrorBanner(props) {
  return /* @__PURE__ */ jsxs2("div", { className: "mt-2 rounded border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive", children: [
    /* @__PURE__ */ jsxs2("div", { className: "font-semibold", children: [
      "Error: ",
      props.code
    ] }),
    /* @__PURE__ */ jsx2("div", { className: "mt-1 text-xs", children: props.message })
  ] });
}
var _SECTION_SKELETONS = [
  { key: "personas", heading: "Personas", hint: "Who uses this?" },
  { key: "user_stories", heading: "User Stories", hint: "What do they do?" },
  { key: "spec", heading: "Spec", hint: "How does it work?" },
  { key: "diagram", heading: "Diagram", hint: "Flow diagram" }
];
var _THINKING_MESSAGES = [
  "Reading your feedback\u2026",
  "Reading the attached files\u2026",
  "Looking at the technical metadata\u2026",
  "Imagining who'd use this\u2026",
  "Drafting personas\u2026",
  "Thinking through edge cases\u2026",
  "Naming things (the hard part)\u2026",
  "Writing user stories\u2026",
  "Sketching Gherkin scenarios\u2026",
  "Outlining the spec\u2026",
  "Sketching the diagram\u2026",
  "Re-reading my own draft\u2026",
  "Counting hidden assumptions\u2026",
  "Looking for the bits I'd otherwise hand-wave past\u2026",
  "Asking myself: what would surprise this user?",
  "One last pass for consistency\u2026"
];
function _useRotatingMessage(active) {
  const [idx, setIdx] = useState3(0);
  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const id = window.setInterval(() => {
      setIdx((cur) => (cur + 1) % _THINKING_MESSAGES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [active]);
  return _THINKING_MESSAGES[idx] ?? _THINKING_MESSAGES[0];
}
function ThinkingDots() {
  return /* @__PURE__ */ jsxs2("span", { "aria-hidden": "true", className: "inline-flex items-end gap-1", children: [
    /* @__PURE__ */ jsx2("span", { className: "inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" }),
    /* @__PURE__ */ jsx2("span", { className: "inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" }),
    /* @__PURE__ */ jsx2("span", { className: "inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" })
  ] });
}
function StreamingSkeleton({
  activeSection
}) {
  const message = _useRotatingMessage(true);
  return /* @__PURE__ */ jsxs2("div", { className: "flex-1 space-y-5 overflow-auto rounded-lg border bg-card p-6 text-sm", children: [
    /* @__PURE__ */ jsxs2("div", { className: "rounded-md border border-primary/30 bg-primary/5 p-4", children: [
      /* @__PURE__ */ jsxs2("p", { className: "flex items-center gap-2 font-medium text-primary", children: [
        /* @__PURE__ */ jsx2(Loader2, { className: "h-4 w-4 animate-spin" }),
        "AI is drafting your spec",
        /* @__PURE__ */ jsx2(ThinkingDots, {})
      ] }),
      /* @__PURE__ */ jsx2("p", { className: "mt-1 min-h-[1.25rem] text-xs text-muted-foreground transition-opacity", children: message }),
      /* @__PURE__ */ jsx2("p", { className: "mt-2 text-[11px] text-muted-foreground/80", children: "Typical generation takes 90\u2013240s on Gemma's free tier. Sections below turn green as they arrive." })
    ] }),
    _SECTION_SKELETONS.map((s, idx) => {
      const isActive = activeSection === s.key;
      const isPast = activeSection && _SECTION_SKELETONS.findIndex((x) => x.key === activeSection) > idx;
      const cardClass = isActive ? "border-primary bg-primary/5" : isPast ? "border-emerald-200 bg-emerald-50/40" : "border-input bg-muted/30";
      const titleClass = isActive ? "text-primary" : isPast ? "text-emerald-700" : "";
      const barBaseClass = isActive ? "animate-pulse bg-primary/30" : "bg-muted";
      return /* @__PURE__ */ jsxs2("div", { className: `rounded-md border p-4 transition-colors ${cardClass}`, children: [
        /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx2("h4", { className: `text-base font-semibold ${titleClass}`, children: s.heading }),
          isActive && /* @__PURE__ */ jsx2("span", { className: "text-xs text-primary", children: "writing now\u2026" }),
          isPast && /* @__PURE__ */ jsx2("span", { className: "text-xs text-emerald-700", children: "done" })
        ] }),
        /* @__PURE__ */ jsx2("p", { className: "mb-3 text-xs text-muted-foreground", children: s.hint }),
        /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx2("div", { className: `h-3 w-[85%] rounded ${barBaseClass}` }),
          /* @__PURE__ */ jsx2("div", { className: `h-3 w-[70%] rounded ${barBaseClass}` }),
          /* @__PURE__ */ jsx2("div", { className: `h-3 w-[92%] rounded ${barBaseClass}` })
        ] })
      ] }, s.key);
    })
  ] });
}
var _DOC_TYPOGRAPHY = [
  "flex-1 overflow-auto rounded-lg border bg-card p-6 text-sm leading-relaxed shadow-sm",
  // H1 — gradient bar to give each top-level section visual weight.
  "[&_h1]:relative [&_h1]:scroll-mt-4 [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:first:mt-0",
  "[&_h1]:border-b [&_h1]:border-primary/20",
  "[&_h1]:bg-gradient-to-r [&_h1]:from-primary/5 [&_h1]:to-transparent [&_h1]:px-3 [&_h1]:py-2 [&_h1]:rounded",
  "[&_h2]:scroll-mt-4 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h2]:border-l-4 [&_h2]:border-primary/40 [&_h2]:pl-3",
  "[&_h3]:scroll-mt-4 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground/90",
  "[&_p]:my-2 [&_p]:text-foreground/90",
  "[&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1",
  "[&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1",
  "[&_li]:text-foreground/90",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-primary",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-slate-50 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre]:shadow-inner dark:[&_pre]:bg-slate-900/40",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:py-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-6 [&_hr]:border-border",
  "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1"
].join(" ");
function WorkingDocumentPanel(props) {
  const [editing, setEditing] = useState3(false);
  const [draft, setDraft] = useState3("");
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
    return /* @__PURE__ */ jsx2(StreamingSkeleton, { activeSection: props.activeSection });
  }
  if (!props.markdown) {
    return /* @__PURE__ */ jsx2("div", { className: "flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground", children: "Press \u201CGenerate first version\u201D or run an iteration to populate the working document." });
  }
  return /* @__PURE__ */ jsxs2("div", { className: "flex flex-1 flex-col", children: [
    /* @__PURE__ */ jsxs2("div", { className: "mb-2 flex items-center justify-end gap-2", children: [
      !editing && props.editable && /* @__PURE__ */ jsxs2(Button, { size: "sm", variant: "outline", onClick: startEditing, children: [
        /* @__PURE__ */ jsx2(Pencil, { className: "h-3 w-3" }),
        " Edit"
      ] }),
      editing && /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsxs2(Button, { size: "sm", variant: "outline", onClick: cancelEditing, disabled: props.saving, children: [
          /* @__PURE__ */ jsx2(X, { className: "h-3 w-3" }),
          " Cancel"
        ] }),
        /* @__PURE__ */ jsxs2(Button, { size: "sm", onClick: save, disabled: props.saving || !draft.trim(), children: [
          /* @__PURE__ */ jsx2(Save, { className: "h-3 w-3" }),
          props.saving ? "Saving\u2026" : "Save edits"
        ] })
      ] })
    ] }),
    editing ? /* @__PURE__ */ jsx2(
      Textarea,
      {
        value: draft,
        onChange: (e) => setDraft(e.target.value),
        rows: 28,
        className: "flex-1 min-h-[28rem] font-mono text-xs"
      }
    ) : /* @__PURE__ */ jsx2(RenderedMarkdown, { markdown: props.markdown })
  ] });
}
function RenderedMarkdown({ markdown }) {
  const ref = useRef2(null);
  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    void import("markdown-it").then(({ default: MarkdownIt }) => {
      if (cancelled || !ref.current) return;
      const md = new MarkdownIt({ html: false, breaks: false, linkify: true });
      const defaultHeadingOpen = md.renderer.rules.heading_open ?? null;
      md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
        const inline = tokens[idx + 1];
        const text = inline?.children ? inline.children.map((c) => c.content).join("") : "";
        const id = `iter-toc-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
        const token = tokens[idx];
        if (token) token.attrSet("id", id);
        return defaultHeadingOpen ? defaultHeadingOpen(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
      };
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
  return /* @__PURE__ */ jsx2("article", { ref, className: _DOC_TYPOGRAPHY });
}
function _pickLatest(versions) {
  if (!versions.length) return null;
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
  return sorted[0] ?? null;
}
function IterWorkspaceNamed(props) {
  return /* @__PURE__ */ jsx2(IterWorkspace, { ...props });
}
var IterWorkspaceComponent = IterWorkspaceNamed;
export {
  IterWorkspace,
  IterWorkspaceComponent,
  IterWorkspace as default
};
//# sourceMappingURL=IterWorkspace-NXKPYDJF.js.map