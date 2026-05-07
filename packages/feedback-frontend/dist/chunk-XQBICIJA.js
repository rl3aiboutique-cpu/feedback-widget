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
var _INIT = {
  status: "idle",
  partialMarkdown: "",
  activeSection: null,
  versionId: null,
  versionNumber: null,
  errorCode: null,
  errorMessage: null,
  providerFallback: null
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
    case "provider_fallback":
      return {
        ...cur,
        providerFallback: {
          fromModel: ev.from_model,
          toModel: ev.to_model,
          reason: ev.reason
        }
      };
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
import { useState as useState4 } from "react";
import { Fragment, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var _DEFAULT_TEXTAREA_MIN_H = "min-h-[28rem]";
var _DEFAULT_EMPTY_MSG = 'Press "Generate first version" or run an iteration to populate the working document.';
function EditableSpecPanel(props) {
  const [editing, setEditing] = useState4(false);
  const [draft, setDraft] = useState4("");
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
    return /* @__PURE__ */ jsx3(
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
    return /* @__PURE__ */ jsx3("div", { className: "flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground", children: props.emptyStateMessage ?? _DEFAULT_EMPTY_MSG });
  }
  const textareaMinH = props.textareaMinHeightClass ?? _DEFAULT_TEXTAREA_MIN_H;
  return /* @__PURE__ */ jsxs3("div", { className: "flex flex-1 flex-col", children: [
    /* @__PURE__ */ jsxs3("div", { className: "mb-2 flex items-center justify-end gap-2", children: [
      !editing && props.editable && /* @__PURE__ */ jsxs3(Button, { size: "sm", variant: "outline", onClick: startEditing, title: "Editar el documento", children: [
        /* @__PURE__ */ jsx3(Pencil, { className: "h-3 w-3" }),
        " Editar"
      ] }),
      editing && /* @__PURE__ */ jsxs3(Fragment, { children: [
        /* @__PURE__ */ jsxs3(Button, { size: "sm", variant: "outline", onClick: cancelEditing, disabled: props.saving, children: [
          /* @__PURE__ */ jsx3(X, { className: "h-3 w-3" }),
          " Cancelar"
        ] }),
        /* @__PURE__ */ jsxs3(Button, { size: "sm", onClick: save, disabled: props.saving || !draft.trim(), children: [
          /* @__PURE__ */ jsx3(Save, { className: "h-3 w-3" }),
          props.saving ? "Guardando\u2026" : "Guardar"
        ] })
      ] })
    ] }),
    editing ? /* @__PURE__ */ jsx3(
      Textarea,
      {
        value: draft,
        onChange: (e) => setDraft(e.target.value),
        rows: 28,
        className: `flex-1 ${textareaMinH} font-mono text-xs`
      }
    ) : /* @__PURE__ */ jsx3(RenderedMarkdown, { markdown: props.markdown })
  ] });
}

export {
  AssumptionCard,
  useIterRunStream,
  modelLatencyHint,
  EditableSpecPanel
};
//# sourceMappingURL=chunk-XQBICIJA.js.map