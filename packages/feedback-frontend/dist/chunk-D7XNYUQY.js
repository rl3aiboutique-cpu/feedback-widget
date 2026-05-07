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

// src/iter/markdownView.tsx
import { Loader2 } from "lucide-react";
import { useEffect, useRef as useRef2, useState as useState3 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
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
function RenderedMarkdown({
  markdown,
  className
}) {
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
  return /* @__PURE__ */ jsx2("article", { ref, className: className ?? _DOC_TYPOGRAPHY });
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
  return _THINKING_MESSAGES[idx] ?? _THINKING_MESSAGES[0] ?? "Thinking\u2026";
}
function ThinkingDots() {
  return /* @__PURE__ */ jsxs2("span", { "aria-hidden": "true", className: "inline-flex items-end gap-1", children: [
    /* @__PURE__ */ jsx2("span", { className: "inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" }),
    /* @__PURE__ */ jsx2("span", { className: "inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" }),
    /* @__PURE__ */ jsx2("span", { className: "inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" })
  ] });
}
function StreamingSkeleton({
  activeSection,
  modelHint,
  roundNumber,
  maxRounds
}) {
  const message = _useRotatingMessage(true);
  const sectionLabel = activeSection ? activeSection.replace("_", " ") : null;
  const heading = roundNumber && maxRounds ? `Borrador ${roundNumber} de hasta ${maxRounds} \u2014 el AI est\xE1 ${sectionLabel ? `escribiendo ${sectionLabel}` : "leyendo tu feedback"}\u2026` : "AI is drafting your spec";
  return /* @__PURE__ */ jsxs2("div", { className: "flex-1 space-y-5 overflow-auto rounded-lg border bg-card p-6 text-sm", children: [
    /* @__PURE__ */ jsxs2("div", { className: "rounded-md border border-primary/30 bg-primary/5 p-4", children: [
      /* @__PURE__ */ jsxs2("p", { className: "flex items-center gap-2 font-medium text-primary", children: [
        /* @__PURE__ */ jsx2(Loader2, { className: "h-4 w-4 animate-spin shrink-0" }),
        /* @__PURE__ */ jsx2("span", { className: "leading-snug", children: heading }),
        /* @__PURE__ */ jsx2(ThinkingDots, {})
      ] }),
      /* @__PURE__ */ jsx2("p", { className: "mt-1 min-h-[1.25rem] text-xs text-muted-foreground transition-opacity", children: message }),
      /* @__PURE__ */ jsxs2("p", { className: "mt-2 text-[11px] text-muted-foreground/80", children: [
        modelHint,
        " Sections below turn green as they arrive."
      ] })
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
function modelLatencyHint(modelId) {
  const m = modelId.toLowerCase();
  if (m.includes("flash-lite")) return "10\u201330s typical with Flash Lite.";
  if (m.includes("flash")) return "20\u201360s typical on Flash models.";
  if (m.startsWith("gemma-3")) return "60\u2013180s typical on Gemma 3.";
  if (m.startsWith("gemma-4")) return "90\u2013240s typical on Gemma 4.";
  if (m.startsWith("gemma")) return "60\u2013240s typical on Gemma models.";
  if (m.startsWith("claude-haiku")) return "5\u201315s typical with Haiku.";
  if (m.startsWith("claude-sonnet")) return "15\u201345s typical with Sonnet.";
  if (m.startsWith("claude-opus")) return "30\u201390s typical with Opus.";
  if (m.startsWith("gpt") || m.startsWith("o1")) return "10\u201330s typical on OpenAI models.";
  return "May take a few minutes on the free tier.";
}

// src/iter/EditableSpecPanel.tsx
import { Pencil, Save, X } from "lucide-react";
import { useMemo as useMemo2, useState as useState5 } from "react";

// src/iter/DiagramPanel.tsx
import { Check, Loader2 as Loader22 } from "lucide-react";
import { useEffect as useEffect2, useRef as useRef3, useState as useState4 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
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
  const [svg, setSvg] = useState4(null);
  const [renderError, setRenderError] = useState4(null);
  const containerRef = useRef3(null);
  const source = _extractMermaidSource(markdown);
  const shouldRender = status === "done" || source !== null;
  useEffect2(() => {
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
  useEffect2(() => {
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
  return /* @__PURE__ */ jsxs3(
    "section",
    {
      "aria-label": "Diagrama",
      className: [
        "rounded-md border transition-colors",
        status === "done" ? "border-emerald-200 dark:border-emerald-900/40" : status === "streaming" ? "border-primary/30" : "border-input"
      ].join(" "),
      children: [
        /* @__PURE__ */ jsxs3(
          "header",
          {
            className: `flex items-center gap-2 rounded-t-md border-b px-3 py-1.5 ${headerStripCls}`,
            children: [
              /* @__PURE__ */ jsx3(
                "h2",
                {
                  className: "font-semibold tracking-tight",
                  style: { fontSize: "clamp(0.85rem, 0.78rem + 0.3cqi, 1rem)" },
                  children: "Diagrama"
                }
              ),
              status === "streaming" ? /* @__PURE__ */ jsxs3(
                "span",
                {
                  className: "flex items-center gap-1 text-primary",
                  style: { fontSize: "0.65rem" },
                  "aria-live": "polite",
                  children: [
                    /* @__PURE__ */ jsx3(Loader22, { className: "h-3 w-3 animate-spin" }),
                    "dibujando\u2026"
                  ]
                }
              ) : null,
              status === "done" ? /* @__PURE__ */ jsxs3(
                "span",
                {
                  className: "flex items-center gap-1 text-emerald-700 dark:text-emerald-300",
                  style: { fontSize: "0.65rem" },
                  children: [
                    /* @__PURE__ */ jsx3(Check, { className: "h-3 w-3" }),
                    "listo"
                  ]
                }
              ) : null
            ]
          }
        ),
        status === "pending" ? /* @__PURE__ */ jsx3(
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
          /* @__PURE__ */ jsx3("div", { className: "p-3 italic text-muted-foreground", style: { fontSize: "0.7rem" }, children: "Esta versi\xF3n del spec no incluye un diagrama." })
        ) : svg ? /* @__PURE__ */ jsx3(
          "div",
          {
            ref: containerRef,
            className: "p-3 [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full",
            style: { minHeight: "8em" }
          }
        ) : renderError ? /* @__PURE__ */ jsxs3("div", { className: "p-3 space-y-2", children: [
          /* @__PURE__ */ jsx3("p", { className: "text-muted-foreground", style: { fontSize: "0.65rem" }, children: "No se pudo renderizar el diagrama (sintaxis Mermaid inv\xE1lida); aqu\xED est\xE1 el c\xF3digo." }),
          /* @__PURE__ */ jsx3(
            "pre",
            {
              className: "overflow-x-auto rounded border border-input bg-muted/40 p-2 font-mono text-foreground/90",
              style: { fontSize: "0.7rem" },
              children: source ?? markdown.replace(/^#{1,6}\s+Diagram\s*\n*/i, "").trim()
            }
          )
        ] }) : /* @__PURE__ */ jsx3(
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

// src/iter/SpecSectionCard.tsx
import { Check as Check2, Loader2 as Loader23 } from "lucide-react";
import { useEffect as useEffect3, useMemo, useRef as useRef4 } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function SpecSectionCard({
  sectionKey,
  status,
  markdown
}) {
  const bodyRef = useRef4(null);
  const bodyMarkdown = useMemo(() => {
    if (!markdown) return markdown;
    const newlineIdx = markdown.indexOf("\n");
    const firstLine = newlineIdx === -1 ? markdown : markdown.slice(0, newlineIdx);
    if (SECTION_PATTERN[sectionKey].test(firstLine)) {
      return markdown.slice(newlineIdx + 1).trimStart();
    }
    return markdown;
  }, [markdown, sectionKey]);
  useEffect3(() => {
    let cancelled = false;
    if (status === "pending") return;
    const el = bodyRef.current;
    if (!el) return;
    void import("markdown-it").then(({ default: MarkdownIt }) => {
      if (cancelled || !bodyRef.current) return;
      const md = new MarkdownIt({ html: false, breaks: false, linkify: true });
      const html = md.render(bodyMarkdown);
      const range = document.createRange();
      range.selectNodeContents(bodyRef.current);
      const fragment = range.createContextualFragment(html);
      bodyRef.current.replaceChildren(fragment);
    });
    return () => {
      cancelled = true;
    };
  }, [status, bodyMarkdown]);
  const label = SECTION_LABEL[sectionKey];
  const minHeightEm = SECTION_SKELETON_HEIGHT_EM[sectionKey];
  const headerStripCls = status === "done" ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-900/10" : status === "streaming" ? "border-primary/40 bg-primary/5" : "border-input bg-muted/30";
  const cardCls = [
    "rounded-md border transition-colors",
    status === "done" ? "border-emerald-200 dark:border-emerald-900/40" : status === "streaming" ? "border-primary/30" : "border-input"
  ].join(" ");
  return /* @__PURE__ */ jsxs4(
    "section",
    {
      "aria-label": label,
      "data-section-key": sectionKey,
      id: `iter-section-${sectionKey}`,
      className: cardCls,
      style: { minHeight: `${minHeightEm}em` },
      children: [
        /* @__PURE__ */ jsxs4(
          "header",
          {
            className: `sticky top-0 z-[1] flex items-center gap-2 rounded-t-md border-b px-3 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-opacity-90 ${headerStripCls}`,
            children: [
              /* @__PURE__ */ jsx4(
                "h2",
                {
                  className: "font-semibold tracking-tight",
                  style: { fontSize: "clamp(0.85rem, 0.78rem + 0.3cqi, 1rem)" },
                  children: label
                }
              ),
              status === "streaming" ? /* @__PURE__ */ jsxs4(
                "span",
                {
                  className: "flex items-center gap-1 text-primary",
                  style: { fontSize: "0.65rem" },
                  "aria-live": "polite",
                  children: [
                    /* @__PURE__ */ jsx4(Loader23, { className: "h-3 w-3 animate-spin" }),
                    "escribiendo\u2026"
                  ]
                }
              ) : null,
              status === "done" ? /* @__PURE__ */ jsxs4(
                "span",
                {
                  className: "flex items-center gap-1 text-emerald-700 dark:text-emerald-300",
                  style: { fontSize: "0.65rem" },
                  children: [
                    /* @__PURE__ */ jsx4(Check2, { className: "h-3 w-3" }),
                    "listo"
                  ]
                }
              ) : null
            ]
          }
        ),
        status === "pending" ? /* @__PURE__ */ jsxs4(
          "div",
          {
            "aria-hidden": "true",
            className: "space-y-2 p-3",
            style: { minHeight: `${Math.max(minHeightEm - 2, 4)}em` },
            children: [
              /* @__PURE__ */ jsx4("div", { className: "h-3 w-[85%] rounded bg-muted" }),
              /* @__PURE__ */ jsx4("div", { className: "h-3 w-[70%] rounded bg-muted" }),
              /* @__PURE__ */ jsx4("div", { className: "h-3 w-[92%] rounded bg-muted" }),
              /* @__PURE__ */ jsx4("div", { className: "h-3 w-[60%] rounded bg-muted" })
            ]
          }
        ) : status === "done" && !markdown.trim() ? (
          // v0.5.1 — never claim "listo" with empty content. NN/G H1
          // (Visibility of System Status) — the status badge must
          // accurately describe what's there. If the model finished
          // and produced no text for this section, say so explicitly
          // instead of leaving an empty card under a green badge.
          /* @__PURE__ */ jsx4("div", { className: "p-3 italic text-muted-foreground", style: { fontSize: "0.7rem" }, children: "Esta versi\xF3n del spec no incluye contenido para esta secci\xF3n." })
        ) : /* @__PURE__ */ jsx4(
          "article",
          {
            ref: bodyRef,
            className: [
              // v0.5.2 — asymmetric padding: tighter top so the body
              // sits right under the header strip (was creating a
              // visible jump). Sides + bottom keep the previous
              // breathing room.
              "px-3 pb-3 pt-1 text-sm leading-relaxed",
              "[&_h1]:mt-2 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold",
              "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold",
              "[&_h3]:mt-1.5 [&_h3]:mb-1 [&_h3]:text-[0.85rem] [&_h3]:font-semibold",
              "[&_p]:my-1.5 [&_p]:text-foreground/90",
              "[&_ul]:my-1.5 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-0.5",
              "[&_ol]:my-1.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-0.5",
              "[&_li]:text-foreground/90",
              "[&_strong]:font-semibold [&_strong]:text-foreground",
              "[&_em]:italic",
              "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-primary",
              "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-slate-50 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.75rem] dark:[&_pre]:bg-slate-900/40",
              "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
              "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:py-1.5 [&_blockquote]:pl-2.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
              "[&_hr]:my-3 [&_hr]:border-border",
              "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
              status === "streaming" ? "animate-pulse-slow" : ""
            ].join(" "),
            style: { fontSize: "clamp(0.8rem, 0.75rem + 0.15cqi, 0.95rem)" }
          }
        )
      ]
    }
  );
}

// src/iter/EditableSpecPanel.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var _DEFAULT_TEXTAREA_MIN_H = "min-h-[28rem]";
var _DEFAULT_EMPTY_MSG = 'Press "Generate first version" or run an iteration to populate the working document.';
function EditableSpecPanel(props) {
  const [editing, setEditing] = useState5(false);
  const [draft, setDraft] = useState5("");
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
  const derivedSectionStates = useMemo2(() => {
    if (props.sectionStates) return props.sectionStates;
    if (props.markdown) return splitMarkdownByH2(props.markdown);
    return void 0;
  }, [props.sectionStates, props.markdown]);
  const hidden = useMemo2(
    () => new Set(props.hideSections ?? []),
    [props.hideSections]
  );
  if (props.streaming) {
    if (props.sectionStates) {
      return _renderSectionCards(props.sectionStates, hidden);
    }
    return /* @__PURE__ */ jsx5(
      StreamingSkeleton,
      {
        activeSection: props.activeSection,
        modelHint: props.modelHint,
        roundNumber: props.roundNumber,
        maxRounds: props.maxRounds
      }
    );
  }
  if (!props.markdown) {
    return /* @__PURE__ */ jsx5("div", { className: "flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground", children: props.emptyStateMessage ?? _DEFAULT_EMPTY_MSG });
  }
  const textareaMinH = props.textareaMinHeightClass ?? _DEFAULT_TEXTAREA_MIN_H;
  return /* @__PURE__ */ jsxs5("div", { className: "flex flex-1 flex-col", children: [
    /* @__PURE__ */ jsxs5("div", { className: "mb-2 flex items-center justify-end gap-2", children: [
      !editing && props.editable && /* @__PURE__ */ jsxs5(Button, { size: "sm", variant: "outline", onClick: startEditing, title: "Editar el documento", children: [
        /* @__PURE__ */ jsx5(Pencil, { className: "h-3 w-3" }),
        " Editar"
      ] }),
      editing && /* @__PURE__ */ jsxs5(Fragment, { children: [
        /* @__PURE__ */ jsxs5(Button, { size: "sm", variant: "outline", onClick: cancelEditing, disabled: props.saving, children: [
          /* @__PURE__ */ jsx5(X, { className: "h-3 w-3" }),
          " Cancelar"
        ] }),
        /* @__PURE__ */ jsxs5(Button, { size: "sm", onClick: save, disabled: props.saving || !draft.trim(), children: [
          /* @__PURE__ */ jsx5(Save, { className: "h-3 w-3" }),
          props.saving ? "Guardando\u2026" : "Guardar"
        ] })
      ] })
    ] }),
    editing ? /* @__PURE__ */ jsx5(
      Textarea,
      {
        value: draft,
        onChange: (e) => setDraft(e.target.value),
        rows: 28,
        className: `flex-1 ${textareaMinH} font-mono text-xs`
      }
    ) : derivedSectionStates ? _renderSectionCards(derivedSectionStates, hidden) : /* @__PURE__ */ jsx5(RenderedMarkdown, { markdown: props.markdown })
  ] });
}
function _renderSectionCards(states, hidden) {
  return /* @__PURE__ */ jsx5("div", { className: "flex flex-1 flex-col gap-3", children: SPEC_SECTION_ORDER.filter((k) => !hidden.has(k)).map(
    (key) => (
      // v0.5.1 — diagram is rendered as a Mermaid SVG inline,
      // right after the Spec card. Other sections render as
      // markdown cards. Keeping diagram in the spec stack (vs
      // floating it to the rail) means the user reads the spec
      // text top-down and arrives at the diagram in context.
      key === "diagram" ? /* @__PURE__ */ jsx5(DiagramPanel, { status: states[key].status, markdown: states[key].markdown }, key) : /* @__PURE__ */ jsx5(
        SpecSectionCard,
        {
          sectionKey: key,
          status: states[key].status,
          markdown: states[key].markdown
        },
        key
      )
    )
  ) });
}

export {
  AssumptionCard,
  useIterRunStream,
  modelLatencyHint,
  EditableSpecPanel
};
//# sourceMappingURL=chunk-D7XNYUQY.js.map