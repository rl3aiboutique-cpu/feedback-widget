import {
  Button,
  Textarea,
  newIdempotencyKey,
  runIterationStream
} from "./chunk-RUMDEDKD.js";

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

export {
  AssumptionCard,
  useIterRunStream
};
//# sourceMappingURL=chunk-ETJUIC5W.js.map