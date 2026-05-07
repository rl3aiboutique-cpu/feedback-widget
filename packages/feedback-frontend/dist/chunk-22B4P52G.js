import {
  Button,
  Textarea,
  newIdempotencyKey,
  runIterationStream
} from "./chunk-QB73WXKP.js";

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
function AssumptionCard({ assumption, onResolve, onSkip, disabled }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [reopen, setReopen] = useState(false);
  const isOpen = assumption.status === "open" || reopen;
  const hasOptions = !!assumption.options && assumption.options.length > 0;
  const click = async (status, user_response) => {
    setBusy(true);
    try {
      await onResolve({ status, user_response });
      setEditing(false);
      setText("");
      setSelectedOption(null);
      setReopen(false);
    } finally {
      setBusy(false);
    }
  };
  const submitSelectedOption = async () => {
    if (!selectedOption) return;
    await click("corrected", selectedOption);
  };
  const skip = async () => {
    if (!onSkip) return;
    setBusy(true);
    try {
      await onSkip();
      setEditing(false);
      setText("");
      setSelectedOption(null);
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
    /* @__PURE__ */ jsx("p", { className: "sr-only", "aria-label": "Internal correlation key, hidden from view", children: assumption.slot_key }),
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
    isOpen && hasOptions && !editing && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs("fieldset", { className: "space-y-1", children: [
        /* @__PURE__ */ jsx("legend", { className: "sr-only", children: "Choose one option" }),
        assumption.options?.map((opt) => /* @__PURE__ */ jsxs(
          "label",
          {
            className: "flex items-start gap-2 rounded border border-input bg-background p-2 text-[12px] hover:bg-accent",
            children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "radio",
                  name: `asm-${assumption.id}`,
                  className: "mt-0.5",
                  value: opt,
                  checked: selectedOption === opt,
                  onChange: () => setSelectedOption(opt),
                  disabled: busy || disabled
                }
              ),
              /* @__PURE__ */ jsx("span", { className: "leading-snug", children: opt })
            ]
          },
          opt
        ))
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            size: "sm",
            disabled: busy || disabled || !selectedOption,
            onClick: submitSelectedOption,
            children: "Save answer"
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            size: "sm",
            variant: "outline",
            disabled: busy || disabled,
            onClick: () => setEditing(true),
            children: "Other\u2026"
          }
        ),
        onSkip && /* @__PURE__ */ jsx(
          Button,
          {
            size: "sm",
            variant: "ghost",
            disabled: busy || disabled,
            onClick: skip,
            title: "I can't answer this \u2014 let the AI infer from context.",
            children: "Skip"
          }
        )
      ] })
    ] }),
    isOpen && !hasOptions && !editing && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
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
      ),
      onSkip && /* @__PURE__ */ jsx(
        Button,
        {
          size: "sm",
          variant: "ghost",
          disabled: busy || disabled,
          onClick: skip,
          title: "I can't answer this \u2014 let the AI infer from context.",
          children: "Skip"
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

// src/iter/specSectionState.ts
var SPEC_SECTION_ORDER = ["personas", "user_stories", "spec", "diagram"];
var SECTION_PATTERN = {
  personas: /^#{1,6}\s+Personas\b/i,
  user_stories: /^#{1,6}\s+User\s+Stories\b/i,
  spec: /^#{1,6}\s+Spec\b/i,
  diagram: /^#{1,6}\s+Diagram\b/i
};
var SECTION_LABEL = {
  personas: "Personas",
  user_stories: "User Stories",
  spec: "Spec",
  diagram: "Diagram"
};
var SECTION_SKELETON_HEIGHT_EM = {
  personas: 8,
  user_stories: 14,
  spec: 24,
  diagram: 6
};
var _INITIAL_SECTION_STATES = {
  personas: { status: "pending", markdown: "" },
  user_stories: { status: "pending", markdown: "" },
  spec: { status: "pending", markdown: "" },
  diagram: { status: "pending", markdown: "" }
};
function splitMarkdownByH2(markdown) {
  const out = {
    personas: { status: "done", markdown: "" },
    user_stories: { status: "done", markdown: "" },
    spec: { status: "done", markdown: "" },
    diagram: { status: "done", markdown: "" }
  };
  if (!markdown.trim()) return out;
  const lines = markdown.split("\n");
  const sectionStart = {};
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    for (const key of SPEC_SECTION_ORDER) {
      if (sectionStart[key] !== void 0) continue;
      if (SECTION_PATTERN[key].test(line)) {
        sectionStart[key] = li;
      }
    }
  }
  for (let i = 0; i < SPEC_SECTION_ORDER.length; i++) {
    const key = SPEC_SECTION_ORDER[i];
    if (key === void 0) continue;
    const start = sectionStart[key];
    if (start === void 0) continue;
    let end = lines.length;
    for (let j = i + 1; j < SPEC_SECTION_ORDER.length; j++) {
      const nextKey = SPEC_SECTION_ORDER[j];
      if (nextKey === void 0) continue;
      const nextStart = sectionStart[nextKey];
      if (nextStart !== void 0) {
        end = nextStart;
        break;
      }
    }
    out[key] = {
      status: "done",
      markdown: lines.slice(start, end).join("\n").trim()
    };
  }
  return out;
}
function spliceSectionInMarkdown(fullMd, sectionKey, newSliceMd) {
  const lines = fullMd.split("\n");
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_PATTERN[sectionKey].test(lines[i] ?? "")) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    return `${fullMd.trim()}

${newSliceMd.trim()}
`;
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    let hit = false;
    for (const k of SPEC_SECTION_ORDER) {
      if (k === sectionKey) continue;
      if (SECTION_PATTERN[k].test(line)) {
        endIdx = i;
        hit = true;
        break;
      }
    }
    if (hit) break;
  }
  const before = lines.slice(0, startIdx).join("\n");
  const after = lines.slice(endIdx).join("\n");
  const beforeBlock = before.trim() ? `${before.trim()}

` : "";
  const afterBlock = after.trim() ? `

${after.trim()}` : "";
  return `${beforeBlock}${newSliceMd.trim()}${afterBlock}
`;
}

// src/iter/useIterRunStream.ts
var _INIT = {
  status: "idle",
  partialMarkdown: "",
  activeSection: null,
  versionId: null,
  versionNumber: null,
  errorCode: null,
  errorMessage: null,
  providerFallback: null,
  sectionStates: _INITIAL_SECTION_STATES,
  activeModel: null,
  startedAt: null,
  completedAt: null
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
      setState({ ..._INIT, status: "running", startedAt: Date.now() });
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
        setState(
          (cur) => cur.status === "running" ? { ...cur, status: "done", completedAt: Date.now() } : cur
        );
      } catch (err) {
        const apiErr = err;
        setState((cur) => ({
          ...cur,
          status: "error",
          errorCode: String(apiErr?.status ?? "network"),
          errorMessage: String(apiErr?.detail ?? apiErr?.message ?? err),
          completedAt: Date.now()
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
    case "token": {
      const next = {
        ...cur,
        partialMarkdown: cur.partialMarkdown + ev.chunk
      };
      const active = cur.activeSection;
      if (active && SPEC_SECTION_ORDER.includes(active)) {
        const key = active;
        const prevEntry = cur.sectionStates[key];
        next.sectionStates = {
          ...cur.sectionStates,
          [key]: {
            status: "streaming",
            markdown: prevEntry.markdown + ev.chunk
          }
        };
      }
      return next;
    }
    case "section": {
      if (!SPEC_SECTION_ORDER.includes(ev.section)) {
        return cur;
      }
      const incoming = ev.section;
      const nextStates = { ...cur.sectionStates };
      if (cur.activeSection && SPEC_SECTION_ORDER.includes(cur.activeSection)) {
        const prev = cur.activeSection;
        nextStates[prev] = {
          status: "done",
          markdown: cur.sectionStates[prev].markdown
        };
      }
      nextStates[incoming] = {
        status: "streaming",
        markdown: cur.sectionStates[incoming].markdown
      };
      return { ...cur, activeSection: incoming, sectionStates: nextStates };
    }
    case "done": {
      const nextStates = { ...cur.sectionStates };
      for (const key of SPEC_SECTION_ORDER) {
        const e = cur.sectionStates[key];
        nextStates[key] = { status: "done", markdown: e.markdown };
      }
      return {
        ...cur,
        status: "done",
        versionId: ev.version_id,
        versionNumber: ev.version_number,
        sectionStates: nextStates,
        completedAt: cur.completedAt ?? Date.now()
      };
    }
    case "error":
      return {
        ...cur,
        status: "error",
        errorCode: ev.error_code,
        errorMessage: ev.message
      };
    case "heartbeat":
      return cur;
    case "provider_fallback":
      return {
        ...cur,
        providerFallback: {
          fromModel: ev.from_model,
          toModel: ev.to_model,
          reason: ev.reason
        }
      };
    case "provider_active":
      return { ...cur, activeModel: ev.model };
    default:
      return cur;
  }
}

// src/iter/DiagramPanel.tsx
import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef as useRef2, useState as useState3 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var _MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/;
function _extractMermaidSource(markdown) {
  const m = _MERMAID_FENCE_RE.exec(markdown);
  return m ? m[1]?.trim() ?? null : null;
}
var _mermaidInitPromise = null;
function _loadMermaid() {
  if (_mermaidInitPromise) return _mermaidInitPromise;
  _mermaidInitPromise = import("mermaid").then((mod) => {
    const m = mod.default;
    m.initialize({
      startOnLoad: false,
      theme: "default",
      logLevel: "fatal",
      securityLevel: "strict"
    });
    return m;
  });
  return _mermaidInitPromise;
}
var _mermaidRenderId = 0;
function DiagramPanel({ markdown, status }) {
  const [svg, setSvg] = useState3(null);
  const [renderError, setRenderError] = useState3(null);
  const containerRef = useRef2(null);
  const source = _extractMermaidSource(markdown);
  const shouldRender = status === "done" || source !== null;
  useEffect(() => {
    if (!shouldRender || !source) {
      setSvg(null);
      setRenderError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await _loadMermaid();
        const id = `iter-diagram-${++_mermaidRenderId}`;
        const { svg: rendered } = await mermaid.render(id, source);
        if (cancelled) return;
        setSvg(rendered);
        setRenderError(null);
      } catch (err) {
        if (cancelled) return;
        setSvg(null);
        setRenderError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldRender, source]);
  useEffect(() => {
    if (!containerRef.current) return;
    if (svg) {
      const range = document.createRange();
      range.selectNodeContents(containerRef.current);
      const fragment = range.createContextualFragment(svg);
      containerRef.current.replaceChildren(fragment);
    } else {
      containerRef.current.replaceChildren();
    }
  }, [svg]);
  const headerStripCls = status === "done" ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-900/10" : status === "streaming" ? "border-primary/40 bg-primary/5" : "border-input bg-muted/30";
  return /* @__PURE__ */ jsxs2(
    "section",
    {
      "aria-label": "Diagrama",
      className: [
        "rounded-md border transition-colors",
        status === "done" ? "border-emerald-200 dark:border-emerald-900/40" : status === "streaming" ? "border-primary/30" : "border-input"
      ].join(" "),
      children: [
        /* @__PURE__ */ jsxs2(
          "header",
          {
            className: `flex items-center gap-2 rounded-t-md border-b px-3 py-1.5 ${headerStripCls}`,
            children: [
              /* @__PURE__ */ jsx2(
                "h2",
                {
                  className: "font-semibold tracking-tight",
                  style: { fontSize: "clamp(0.85rem, 0.78rem + 0.3cqi, 1rem)" },
                  children: "Diagrama"
                }
              ),
              status === "streaming" ? /* @__PURE__ */ jsxs2(
                "span",
                {
                  className: "flex items-center gap-1 text-primary",
                  style: { fontSize: "0.65rem" },
                  "aria-live": "polite",
                  children: [
                    /* @__PURE__ */ jsx2(Loader2, { className: "h-3 w-3 animate-spin" }),
                    "dibujando\u2026"
                  ]
                }
              ) : null,
              status === "done" ? /* @__PURE__ */ jsxs2(
                "span",
                {
                  className: "flex items-center gap-1 text-emerald-700 dark:text-emerald-300",
                  style: { fontSize: "0.65rem" },
                  children: [
                    /* @__PURE__ */ jsx2(Check, { className: "h-3 w-3" }),
                    "listo"
                  ]
                }
              ) : null
            ]
          }
        ),
        status === "pending" ? /* @__PURE__ */ jsx2(
          "div",
          {
            "aria-hidden": "true",
            className: "flex items-center justify-center p-6 text-muted-foreground",
            style: { minHeight: "10em", fontSize: "0.7rem" },
            children: "Pendiente\u2026"
          }
        ) : status === "done" && !markdown.trim() ? (
          // v0.5.1 — match SpecSectionCard's empty-done message so the
          // green "listo" badge always corresponds to real content.
          /* @__PURE__ */ jsx2("div", { className: "p-3 italic text-muted-foreground", style: { fontSize: "0.7rem" }, children: "Esta versi\xF3n del spec no incluye un diagrama." })
        ) : svg ? /* @__PURE__ */ jsx2(
          "div",
          {
            ref: containerRef,
            className: "p-3 [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full",
            style: { minHeight: "8em" }
          }
        ) : renderError ? /* @__PURE__ */ jsxs2("div", { className: "p-3 space-y-2", children: [
          /* @__PURE__ */ jsx2("p", { className: "text-muted-foreground", style: { fontSize: "0.65rem" }, children: "No se pudo renderizar el diagrama (sintaxis Mermaid inv\xE1lida); aqu\xED est\xE1 el c\xF3digo." }),
          /* @__PURE__ */ jsx2(
            "pre",
            {
              className: "overflow-x-auto rounded border border-input bg-muted/40 p-2 font-mono text-foreground/90",
              style: { fontSize: "0.7rem" },
              children: source ?? markdown.replace(/^#{1,6}\s+Diagram\s*\n*/i, "").trim()
            }
          )
        ] }) : /* @__PURE__ */ jsx2(
          "div",
          {
            className: "flex items-center justify-center p-6 text-muted-foreground",
            style: { minHeight: "8em", fontSize: "0.7rem" },
            children: "Esperando contenido\u2026"
          }
        )
      ]
    }
  );
}

export {
  AssumptionCard,
  SPEC_SECTION_ORDER,
  SECTION_PATTERN,
  SECTION_LABEL,
  SECTION_SKELETON_HEIGHT_EM,
  splitMarkdownByH2,
  spliceSectionInMarkdown,
  useIterRunStream,
  DiagramPanel
};
//# sourceMappingURL=chunk-22B4P52G.js.map