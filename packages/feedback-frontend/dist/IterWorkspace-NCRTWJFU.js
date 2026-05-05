import {
  Button,
  Textarea,
  abandonIterSession,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  listIterAssumptions,
  listIterVersions,
  newIdempotencyKey,
  resolveIterAssumption,
  runIterationStream,
  useFeedbackBindings
} from "./chunk-MXDE3JO7.js";

// src/iter/IterWorkspace.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const isOpen = assumption.status === "open";
  const click = async (status, user_response) => {
    setBusy(true);
    try {
      await onResolve({ status, user_response });
      setEditing(false);
      setText("");
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
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs2("div", { className: "fixed inset-0 z-[60] flex flex-col bg-background text-foreground", children: [
    /* @__PURE__ */ jsx2(
      Header,
      {
        session: session.data,
        onClose,
        onAbandon: () => abandonMutation.mutate(),
        terminal: session.data?.status === "finalized" || session.data?.status === "abandoned"
      }
    ),
    /* @__PURE__ */ jsxs2("div", { className: "flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:flex-row", children: [
      /* @__PURE__ */ jsxs2("aside", { className: "lg:w-64 lg:flex-shrink-0", children: [
        /* @__PURE__ */ jsx2("h3", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: "Activity" }),
        /* @__PURE__ */ jsx2(ActivityTimeline, { versions: versions.data ?? [] })
      ] }),
      /* @__PURE__ */ jsxs2("main", { className: "flex flex-1 flex-col", children: [
        /* @__PURE__ */ jsxs2("h3", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
          "Working Document",
          stream.state.activeSection && /* @__PURE__ */ jsxs2("span", { className: "ml-2 normal-case text-foreground", children: [
            "\u2014 streaming: ",
            stream.state.activeSection.replace("_", " ")
          ] })
        ] }),
        !latestVersion && stream.state.status === "idle" && /* @__PURE__ */ jsx2(
          FirstRunCard,
          {
            busy: false,
            onRun: () => stream.start({ user_message: "", restructure_allowed: false })
          }
        ),
        /* @__PURE__ */ jsx2(WorkingDocument, { markdown: renderedMarkdown }),
        stream.state.status === "error" && /* @__PURE__ */ jsx2(ErrorBanner, { code: stream.state.errorCode, message: stream.state.errorMessage })
      ] }),
      /* @__PURE__ */ jsxs2("aside", { className: "lg:w-80 lg:flex-shrink-0", children: [
        /* @__PURE__ */ jsxs2("h3", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: [
          "Assumptions (",
          openAssumptionCount,
          " open)"
        ] }),
        /* @__PURE__ */ jsx2(
          AssumptionsList,
          {
            items: assumptions.data ?? [],
            onResolve: (assumptionId, body) => resolveMutation.mutateAsync({ assumptionId, body }),
            disabled: session.data?.status === "finalized" || session.data?.status === "abandoned"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx2(
      Footer,
      {
        session: session.data,
        package: pkgQuery.data,
        openAssumptions: openAssumptionCount,
        streamRunning: stream.state.status === "running",
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
    /* @__PURE__ */ jsxs2("span", { className: "text-xs text-muted-foreground", children: [
      "model: ",
      props.session?.model_id ?? "(none)"
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "ml-auto flex items-center gap-2", children: [
      !props.terminal && props.onAbandon && /* @__PURE__ */ jsx2(Button, { size: "sm", variant: "ghost", onClick: props.onAbandon, children: "Discard session" }),
      props.onClose && /* @__PURE__ */ jsx2(Button, { size: "sm", variant: "outline", onClick: props.onClose, children: "Close" })
    ] })
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
  const runDisabled = props.streamRunning || props.openAssumptions > 0 && status !== "draft";
  return /* @__PURE__ */ jsxs2("footer", { className: "space-y-2 border-t bg-card px-4 py-3", children: [
    /* @__PURE__ */ jsx2(
      Textarea,
      {
        value: msg,
        onChange: (e) => setMsg(e.target.value),
        placeholder: "What should change in the next iteration?",
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
            children: "Run iteration"
          }
        ),
        /* @__PURE__ */ jsx2(
          Button,
          {
            variant: "secondary",
            disabled: props.finalizing || props.streamRunning || !props.session?.current_iteration_id,
            onClick: () => props.onFinalize(),
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
function AssumptionsList(props) {
  if (!props.items.length) {
    return /* @__PURE__ */ jsx2("p", { className: "text-xs text-muted-foreground", children: "No assumptions on the current version yet." });
  }
  const open = props.items.filter((a) => a.status === "open");
  const resolved = props.items.filter((a) => a.status !== "open");
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-3", children: [
    open.map((a) => /* @__PURE__ */ jsx2(
      AssumptionCard,
      {
        assumption: a,
        disabled: props.disabled,
        onResolve: (body) => props.onResolve(a.id, body)
      },
      a.id
    )),
    resolved.length > 0 && /* @__PURE__ */ jsxs2("details", { className: "rounded border bg-muted/40 p-2", children: [
      /* @__PURE__ */ jsxs2("summary", { className: "cursor-pointer text-xs font-semibold", children: [
        "Resolved (",
        resolved.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx2("div", { className: "mt-2 space-y-2", children: resolved.map((a) => /* @__PURE__ */ jsx2(
        AssumptionCard,
        {
          assumption: a,
          disabled: true,
          onResolve: async () => {
          }
        },
        a.id
      )) })
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
function WorkingDocument({ markdown }) {
  const ref = useRef2(null);
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
    return /* @__PURE__ */ jsx2("div", { className: "flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground", children: "Press \u201CGenerate first version\u201D or run an iteration to populate the working document." });
  }
  return /* @__PURE__ */ jsx2(
    "article",
    {
      ref,
      className: "prose prose-sm max-w-none flex-1 overflow-auto rounded border bg-card p-4 dark:prose-invert"
    }
  );
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
//# sourceMappingURL=IterWorkspace-NCRTWJFU.js.map