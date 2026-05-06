import {
  Badge,
  CommentThread,
  Input,
  Rl3Mark,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  captureElementScreenshot,
  capturePageScreenshot
} from "./chunk-UAYBADBI.js";
import {
  AssumptionCard,
  useIterRunStream
} from "./chunk-ETJUIC5W.js";
import {
  Button,
  SubmitFeedbackError,
  Textarea,
  abandonIterSession,
  cn,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  listIterAssumptions,
  listIterVersions,
  redactBundle,
  resolveIterAssumption,
  startIterSession,
  useFeedbackAdapter,
  useFeedbackBindings,
  useMyFeedbackQuery
} from "./chunk-RUMDEDKD.js";

// src/Canvas.tsx
import { ChevronDown, ChevronUp, Sparkles as Sparkles2 } from "lucide-react";
import { useCallback, useEffect as useEffect3, useRef as useRef2, useState as useState4 } from "react";

// src/Compose.tsx
import { Send, Sparkles } from "lucide-react";
import { useEffect as useEffect2, useMemo as useMemo2, useState as useState2 } from "react";

// src/capture/breadcrumbs.ts
var _buffer = [];
function getBreadcrumbs() {
  return [..._buffer];
}

// src/capture/consoleWrap.ts
var _buffer2 = [];
function getConsoleTail() {
  return [..._buffer2];
}

// src/capture/networkWrap.ts
var _buffer3 = [];
function getNetworkTail() {
  return [..._buffer3];
}

// src/capture/metadata.ts
function buildMetadataBundle(args) {
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "";
  const viewport = typeof window !== "undefined" ? {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio
  } : { w: 0, h: 0, dpr: 1 };
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform ?? "" : "";
  const locale = typeof navigator !== "undefined" ? navigator.language : "";
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  })();
  const raw = {
    url,
    route_name: args.routeName,
    viewport,
    user_agent: ua,
    platform,
    locale,
    timezone,
    app_version: args.appVersion,
    git_commit_sha: args.gitSha,
    current_user: args.user ? { id: args.user.id, email: args.user.email, role: args.user.role } : null,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    console_tail: getConsoleTail(),
    network_tail: getNetworkTail(),
    breadcrumbs: getBreadcrumbs(),
    selected_element: args.selectedElement,
    feature_flags: args.featureFlags ?? {}
  };
  return redactBundle(raw);
}

// src/ui/label.tsx
import * as LabelPrimitive from "@radix-ui/react-label";
import { jsx } from "react/jsx-runtime";
function Label({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    LabelPrimitive.Root,
    {
      "data-slot": "label",
      className: cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      ),
      ...props
    }
  );
}

// src/forms/AttachmentsField.tsx
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var MAX_ATTACHMENTS = 5;
var MAX_BYTES = 10 * 1024 * 1024;
var ALLOWED_MIMES = /* @__PURE__ */ new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/x-ndjson"
]);
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".log",
  ".md",
  ".json",
  ".ndjson"
]);
var ACCEPT_ATTR = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".log",
  ".md",
  ".json",
  ".ndjson",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "application/x-ndjson"
].join(",");
function _formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function _isImage(file) {
  return file.type.startsWith("image/");
}
function _hasAllowedExtension(filename) {
  const lower = filename.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}
function _isMimeAllowed(file) {
  if (file.type && ALLOWED_MIMES.has(file.type)) return true;
  if ((file.type === "" || file.type === "application/octet-stream") && _hasAllowedExtension(file.name)) {
    return true;
  }
  return false;
}
function AttachmentsField({
  value,
  onChange,
  error
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const previews = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const f of value) {
      if (_isImage(f)) {
        map.set(f, URL.createObjectURL(f));
      }
    }
    return map;
  }, [value]);
  useEffect(() => {
    return () => {
      for (const url of previews.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previews]);
  const acceptIncoming = (files) => {
    const incoming = Array.from(files);
    const accepted = [];
    const room = MAX_ATTACHMENTS - value.length;
    if (room <= 0) {
      adapter.toast.error(t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) }));
      return;
    }
    let truncated = false;
    for (const file of incoming) {
      if (accepted.length >= room) {
        truncated = true;
        break;
      }
      if (file.size > MAX_BYTES) {
        adapter.toast.error(
          t("feedback.attachments.too_big", {
            name: file.name,
            max: "10 MB"
          })
        );
        continue;
      }
      if (!_isMimeAllowed(file)) {
        adapter.toast.error(t("feedback.attachments.bad_type", { name: file.name }));
        continue;
      }
      accepted.push(file);
    }
    if (truncated) {
      adapter.toast.error(t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) }));
    }
    if (accepted.length > 0) {
      onChange([...value, ...accepted]);
    }
  };
  const onPick = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      acceptIncoming(e.target.files);
      e.target.value = "";
    }
  };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptIncoming(e.dataTransfer.files);
    }
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const removeAt = (index) => {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  };
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs(Label, { htmlFor: "feedback-attachments", title: t("feedback.attachments.hint"), children: [
      t("feedback.attachments.label"),
      /* @__PURE__ */ jsx2(
        "span",
        {
          className: "ml-1 cursor-help text-[11px] text-muted-foreground",
          "aria-label": t("feedback.attachments.hint"),
          children: "\u24D8"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => inputRef.current?.click(),
        onDragOver,
        onDragLeave,
        onDrop,
        "aria-label": t("feedback.attachments.dropzone"),
        className: `w-full cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors
          ${dragActive ? "border-primary bg-primary/5 text-foreground" : error ? "border-destructive bg-destructive/5 text-destructive" : "border-input bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`,
        "data-feedback-id": "feedback.attachments.dropzone",
        children: [
          /* @__PURE__ */ jsx2("p", { children: t("feedback.attachments.dropzone") }),
          /* @__PURE__ */ jsx2("p", { className: "mt-1 text-[11px] text-muted-foreground", children: t("feedback.attachments.hint") }),
          /* @__PURE__ */ jsx2(
            "input",
            {
              ref: inputRef,
              id: "feedback-attachments",
              type: "file",
              multiple: true,
              accept: ACCEPT_ATTR,
              onChange: onPick,
              className: "hidden"
            }
          )
        ]
      }
    ),
    error ? /* @__PURE__ */ jsx2("p", { className: "text-xs text-destructive", children: error }) : null,
    value.length > 0 ? /* @__PURE__ */ jsx2("ul", { className: "space-y-1.5", children: value.map((file, index) => {
      const previewUrl = previews.get(file);
      return /* @__PURE__ */ jsxs(
        "li",
        {
          className: "flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-xs",
          children: [
            previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              /* @__PURE__ */ jsx2(
                "img",
                {
                  src: previewUrl,
                  alt: file.name,
                  className: "h-8 w-8 shrink-0 rounded object-cover"
                }
              )
            ) : _isImage(file) ? /* @__PURE__ */ jsx2(ImageIcon, { className: "h-4 w-4 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx2(FileText, { className: "h-4 w-4 shrink-0 text-muted-foreground" }),
            /* @__PURE__ */ jsx2("span", { className: "flex-1 truncate", children: file.name }),
            /* @__PURE__ */ jsx2("span", { className: "text-[11px] text-muted-foreground", children: _formatBytes(file.size) }),
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "button",
                onClick: () => removeAt(index),
                className: "rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                "aria-label": t("feedback.attachments.remove", {
                  name: file.name
                }),
                "data-feedback-id": "feedback.attachments.remove",
                children: /* @__PURE__ */ jsx2(X, { className: "h-3.5 w-3.5" })
              }
            )
          ]
        },
        `${file.name}-${index}`
      );
    }) }) : null
  ] });
}

// src/forms/types.ts
var TYPE_DEFS = [
  {
    key: "bug",
    labelKey: "feedback.type.bug",
    hintKey: "feedback.type.bug_hint"
  },
  {
    key: "ui",
    labelKey: "feedback.type.ui",
    hintKey: "feedback.type.ui_hint"
  },
  {
    key: "performance",
    labelKey: "feedback.type.performance",
    hintKey: "feedback.type.performance_hint"
  },
  {
    key: "new_feature",
    labelKey: "feedback.type.new_feature",
    hintKey: "feedback.type.new_feature_hint"
  },
  {
    key: "extend_feature",
    labelKey: "feedback.type.extend_feature",
    hintKey: "feedback.type.extend_feature_hint"
  },
  {
    key: "other",
    labelKey: "feedback.type.other",
    hintKey: "feedback.type.other_hint"
  }
];

// src/forms/FeedbackForm.tsx
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var EMPTY_FORM = {
  type: null,
  title: "",
  description: "",
  expected_outcome: "",
  attachments: []
};
var _RequiredMark = () => /* @__PURE__ */ jsx3("span", { "aria-hidden": "true", className: "ml-0.5 text-destructive", children: "*" });
function FeedbackForm({
  values,
  onChange,
  errors = {}
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const setField = (key, val) => {
    onChange({ ...values, [key]: val });
  };
  const handleTypeChange = (next) => {
    if (next === values.type) return;
    onChange({ ...values, type: next });
  };
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx3(
        Label,
        {
          htmlFor: "feedback-type",
          className: "text-xs uppercase tracking-wide text-muted-foreground",
          children: t("feedback.type_label")
        }
      ),
      /* @__PURE__ */ jsxs2(
        Select,
        {
          value: values.type ?? "",
          onValueChange: (v) => handleTypeChange(v),
          children: [
            /* @__PURE__ */ jsx3(
              SelectTrigger,
              {
                id: "feedback-type",
                "data-feedback-id": "feedback.type_select",
                "aria-required": "true",
                children: /* @__PURE__ */ jsx3(SelectValue, { placeholder: t("feedback.type_placeholder") })
              }
            ),
            /* @__PURE__ */ jsx3(SelectContent, { children: TYPE_DEFS.map((def) => /* @__PURE__ */ jsx3(
              SelectItem,
              {
                value: def.key,
                title: t(def.hintKey),
                "data-feedback-id": `feedback.type.${def.key}`,
                children: t(def.labelKey)
              },
              def.key
            )) })
          ]
        }
      )
    ] }),
    values.type ? /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs2(Label, { htmlFor: "feedback-title", title: t("feedback.field.title_hint"), children: [
          t("feedback.field.title"),
          /* @__PURE__ */ jsx3(_RequiredMark, {})
        ] }),
        /* @__PURE__ */ jsx3(
          Input,
          {
            id: "feedback-title",
            value: values.title,
            onChange: (e) => setField("title", e.target.value),
            placeholder: t("feedback.field.title_placeholder"),
            "data-feedback-id": "feedback.field.title",
            maxLength: 200,
            "aria-invalid": !!errors.title,
            "aria-required": "true",
            className: errors.title ? "border-destructive ring-1 ring-destructive" : ""
          }
        ),
        errors.title ? /* @__PURE__ */ jsx3("p", { className: "text-xs text-destructive", children: errors.title }) : null
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs2(Label, { htmlFor: "feedback-description", children: [
          t("feedback.field.description"),
          /* @__PURE__ */ jsx3(_RequiredMark, {})
        ] }),
        /* @__PURE__ */ jsx3(
          Textarea,
          {
            id: "feedback-description",
            value: values.description,
            onChange: (e) => setField("description", e.target.value),
            placeholder: t("feedback.field.description_placeholder"),
            rows: 5,
            "data-feedback-id": "feedback.field.description",
            "aria-invalid": !!errors.description,
            "aria-required": "true",
            className: errors.description ? "border-destructive ring-1 ring-destructive" : ""
          }
        ),
        errors.description ? /* @__PURE__ */ jsx3("p", { className: "text-xs text-destructive", children: errors.description }) : null
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs2(Label, { htmlFor: "feedback-expected-outcome", children: [
          t("feedback.field.expected_outcome"),
          /* @__PURE__ */ jsxs2("span", { className: "ml-1 text-[11px] text-muted-foreground", children: [
            "(",
            t("feedback.optional"),
            ")"
          ] })
        ] }),
        /* @__PURE__ */ jsx3(
          Textarea,
          {
            id: "feedback-expected-outcome",
            value: values.expected_outcome,
            onChange: (e) => setField("expected_outcome", e.target.value),
            placeholder: t("feedback.field.expected_outcome_placeholder"),
            rows: 3,
            "data-feedback-id": "feedback.field.expected_outcome"
          }
        )
      ] }),
      /* @__PURE__ */ jsx3(
        AttachmentsField,
        {
          value: values.attachments,
          onChange: (next) => setField("attachments", next),
          error: errors.attachments
        }
      ),
      /* @__PURE__ */ jsx3("p", { className: "text-[11px] text-muted-foreground", children: t("feedback.metadata_disclosure") })
    ] }) : null
  ] });
}

// src/Compose.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function Compose({
  locked,
  onActivatePicker,
  onClearLocked,
  onSubmitted
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [values, setValues] = useState2(() => ({ ...EMPTY_FORM }));
  const [mode, setMode] = useState2(locked ? "element" : "page");
  const [submitting, setSubmitting] = useState2(false);
  const [submittingWithIter, setSubmittingWithIter] = useState2(false);
  const [fieldErrors, setFieldErrors] = useState2({});
  useEffect2(() => {
    if (locked) setMode("element");
  }, [locked]);
  useEffect2(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    const cleared = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (k === "title" && values.title.trim()) continue;
      if (k === "description" && values.description.trim()) continue;
      cleared[k] = v;
    }
    if (Object.keys(cleared).length !== Object.keys(fieldErrors).length) {
      setFieldErrors(cleared);
    }
  }, [values, fieldErrors]);
  const selectorInfo = useMemo2(() => {
    if (!locked) return null;
    return {
      selector: locked.info.selector,
      xpath: locked.info.xpath,
      bounding_box: { ...locked.info.bounding_box }
    };
  }, [locked]);
  const validate = () => {
    if (!values.type) return { ok: false, reason: "type" };
    if (!values.title.trim()) return { ok: false, reason: "title" };
    if (!values.description.trim()) return { ok: false, reason: "description" };
    return { ok: true };
  };
  const captureScreenshot = async () => {
    const opts = { redactionSelectors: adapter.getDefaultRedactionSelectors() };
    try {
      if (mode === "element" && locked?.el) {
        return await captureElementScreenshot(locked.el, opts);
      }
      return await capturePageScreenshot(opts);
    } catch {
      adapter.toast.error(t("feedback.toast_screenshot_failed"));
      return null;
    }
  };
  const onSubmit = async (opts) => {
    const thenIterate = opts?.thenIterate ?? false;
    const v = validate();
    if (!v.ok) {
      const reason = v.reason;
      const fieldLabel = (() => {
        switch (reason) {
          case "type":
            return t("feedback.type_label");
          case "title":
            return t("feedback.field.title");
          case "description":
            return t("feedback.field.description");
          default:
            return reason;
        }
      })();
      const message = t("feedback.toast_error_required_field", { field: fieldLabel });
      setFieldErrors({ [reason]: message });
      adapter.toast.error(message);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    setSubmittingWithIter(thenIterate);
    try {
      const shotPromise = (async () => {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return captureScreenshot();
      })();
      const shot = await shotPromise;
      const metadata = buildMetadataBundle({
        routeName: typeof window !== "undefined" ? window.location.pathname : null,
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        user: null,
        selectedElement: locked?.info ?? null
      });
      const payload = {
        type: values.type,
        title: values.title.trim(),
        description: values.description,
        expected_outcome: values.expected_outcome.trim() || null,
        url_captured: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "",
        route_name: typeof window !== "undefined" ? window.location.pathname : null,
        element: selectorInfo,
        metadata_bundle: metadata,
        app_version: adapter.appVersion,
        git_commit_sha: adapter.gitSha,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null
      };
      const created = await adapter.submitFeedback(
        JSON.stringify(payload),
        shot?.blob ?? null,
        values.attachments
      );
      const link = adapter.getDeepLinkToFeedback(created.id);
      const ticketLabel = created.ticket_code || created.id.slice(0, 8);
      adapter.toast.success(t("feedback.toast_success", { id: ticketLabel }), {
        url: link,
        actionLabel: t("feedback.toast_success_link")
      });
      setValues({ ...EMPTY_FORM });
      onClearLocked();
      setMode("page");
      onSubmitted(created.id, { thenIterate });
    } catch (err) {
      if (err instanceof SubmitFeedbackError && err.status === 429) {
        const seconds = err.retryAfter ?? "?";
        adapter.toast.error(t("feedback.toast_error_429", { seconds: String(seconds) }));
      } else {
        adapter.toast.error(t("feedback.toast_error_generic"));
      }
    } finally {
      setSubmitting(false);
      setSubmittingWithIter(false);
    }
  };
  return /* @__PURE__ */ jsxs3("div", { className: "rounded-md border border-input bg-background p-3 space-y-3 shadow-sm", children: [
    /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx4("span", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: t("feedback.mode_label") }),
      /* @__PURE__ */ jsx4(
        Button,
        {
          type: "button",
          variant: mode === "page" ? "default" : "outline",
          size: "sm",
          onClick: () => {
            setMode("page");
            onClearLocked();
          },
          "data-feedback-id": "feedback.mode_whole_page",
          children: t("feedback.mode_whole_page")
        }
      ),
      /* @__PURE__ */ jsx4(
        Button,
        {
          type: "button",
          variant: mode === "element" ? "default" : "outline",
          size: "sm",
          onClick: onActivatePicker,
          "data-feedback-id": "feedback.mode_select_element",
          children: t("feedback.mode_select_element")
        }
      ),
      mode === "element" && locked ? /* @__PURE__ */ jsxs3("span", { className: "ml-auto inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px]", children: [
        /* @__PURE__ */ jsx4("code", { className: "font-mono truncate max-w-[180px]", children: locked.info.selector }),
        /* @__PURE__ */ jsx4(
          "button",
          {
            type: "button",
            onClick: () => {
              onClearLocked();
              setMode("page");
            },
            className: "text-primary underline-offset-2 hover:underline",
            "data-feedback-id": "feedback.clear_element",
            children: "\u2715"
          }
        )
      ] }) : null
    ] }),
    /* @__PURE__ */ jsx4(FeedbackForm, { values, onChange: setValues, errors: fieldErrors }),
    /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap justify-end gap-2 pt-1", children: [
      /* @__PURE__ */ jsxs3(
        Button,
        {
          type: "button",
          variant: "outline",
          onClick: () => onSubmit({ thenIterate: false }),
          disabled: submitting || !values.type,
          "data-feedback-id": "feedback.submit",
          size: "sm",
          children: [
            /* @__PURE__ */ jsx4(Send, { className: "h-3.5 w-3.5" }),
            submitting && !submittingWithIter ? t("feedback.submitting") : t("feedback.submit")
          ]
        }
      ),
      /* @__PURE__ */ jsxs3(
        Button,
        {
          type: "button",
          onClick: () => onSubmit({ thenIterate: true }),
          disabled: submitting || !values.type,
          "data-feedback-id": "feedback.submit-and-iterate",
          title: "Submit the feedback and immediately open the inline AI iteration",
          size: "sm",
          children: [
            /* @__PURE__ */ jsx4(Sparkles, { className: "h-3.5 w-3.5" }),
            submitting && submittingWithIter ? "Submitting\u2026" : "Send and Iterate"
          ]
        }
      )
    ] })
  ] });
}

// src/iter/InlineIterPane.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X as X2 } from "lucide-react";
import { useMemo as useMemo3, useState as useState3 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var SKIP_MARKER = "__skip_inferred__";
function InlineIterPane({ sessionId, onClose }) {
  const bindings = useFeedbackBindings();
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ["iter-session", sessionId],
    queryFn: () => getIterSession(bindings, sessionId),
    refetchInterval: 5e3
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
  const userFacing = useMemo3(
    () => (assumptions.data ?? []).filter((a) => a.kind !== "technical"),
    [assumptions.data]
  );
  const openAssumptions = userFacing.filter((a) => a.status === "open");
  const otherAssumptions = userFacing.filter((a) => a.status !== "open");
  const focused = openAssumptions[0] ?? null;
  const remainingOpen = openAssumptions.slice(1);
  const sess = session.data;
  const status = sess?.status ?? "loading";
  const isStreaming = stream.state.status === "running";
  const isComplete = !!sess?.is_complete;
  const remainingTurns = sess?.remaining_turns ?? 0;
  const maxTurns = sess?.max_turns ?? 0;
  const usedTurns = Math.max(0, maxTurns - remainingTurns);
  const turnBudgetSpent = maxTurns > 0 && remainingTurns <= 0;
  const streamBudgetExhausted = stream.state.status === "error" && stream.state.errorCode === "turn_budget_exhausted";
  const [msg, setMsg] = useState3("");
  const handleSkip = (a) => resolveMutation.mutateAsync({
    assumptionId: a.id,
    body: { status: "irrelevant", user_response: SKIP_MARKER }
  });
  const onMarkReady = () => {
    if (openAssumptions.length === 0) {
      void finalizeMutation.mutateAsync();
      return;
    }
    void finalizeMutation.mutateAsync();
  };
  if (status === "loading") {
    return /* @__PURE__ */ jsx5("div", { className: "rounded-md border border-input bg-card p-3 text-xs text-muted-foreground", children: "Loading iter session\u2026" });
  }
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: "rounded-md border border-primary/30 bg-card p-3 space-y-3 text-xs",
      "data-feedback-id": "iter.inline-pane",
      children: [
        /* @__PURE__ */ jsxs4("header", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx5("span", { className: "font-semibold", children: "Iterate with AI" }),
          maxTurns > 0 && /* @__PURE__ */ jsxs4("span", { className: "rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground", children: [
            "Round ",
            Math.min(usedTurns + (isStreaming ? 1 : 0), maxTurns),
            " of ",
            maxTurns
          ] }),
          isStreaming && /* @__PURE__ */ jsxs4("span", { className: "flex items-center gap-1 text-[11px] text-primary", children: [
            /* @__PURE__ */ jsx5(Loader2, { className: "h-3 w-3 animate-spin" }),
            " writing\u2026"
          ] }),
          isComplete && /* @__PURE__ */ jsx5("span", { className: "rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-900", children: "Spec ready" }),
          onClose && /* @__PURE__ */ jsxs4(
            Button,
            {
              size: "sm",
              variant: "ghost",
              onClick: onClose,
              className: "ml-auto h-6 px-2 text-[11px]",
              children: [
                /* @__PURE__ */ jsx5(X2, { className: "h-3 w-3" }),
                " Close"
              ]
            }
          )
        ] }),
        isComplete && sess?.completion_reason && /* @__PURE__ */ jsxs4("p", { className: "rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900", children: [
          /* @__PURE__ */ jsx5("strong", { className: "font-semibold", children: "Why ready: " }),
          sess.completion_reason
        ] }),
        focused ? /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx5(
            AssumptionCard,
            {
              assumption: focused,
              disabled: status === "finalized" || status === "abandoned",
              onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: focused.id, body }),
              onSkip: () => handleSkip(focused)
            }
          ),
          remainingOpen.length > 0 && /* @__PURE__ */ jsxs4("details", { className: "rounded border bg-muted/40 p-2", children: [
            /* @__PURE__ */ jsxs4("summary", { className: "cursor-pointer font-medium", children: [
              "More to review (",
              remainingOpen.length,
              ")"
            ] }),
            /* @__PURE__ */ jsx5("div", { className: "mt-2 space-y-2", children: remainingOpen.map((a) => /* @__PURE__ */ jsx5(
              AssumptionCard,
              {
                assumption: a,
                disabled: status === "finalized" || status === "abandoned",
                onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: a.id, body }),
                onSkip: () => handleSkip(a)
              },
              a.id
            )) })
          ] })
        ] }) : status !== "finalized" && status !== "abandoned" ? /* @__PURE__ */ jsx5("p", { className: "text-muted-foreground", children: versions.data?.length ? "All assumptions on this round are resolved. Run another iteration to refresh the spec, or mark it ready if you're happy with it." : "Run the first iteration to see the AI's draft and any assumptions it needs you to confirm." }) : null,
        otherAssumptions.length > 0 && /* @__PURE__ */ jsxs4("details", { className: "rounded border bg-muted/40 p-2", children: [
          /* @__PURE__ */ jsxs4("summary", { className: "cursor-pointer font-medium", children: [
            "Resolved (",
            otherAssumptions.length,
            ")"
          ] }),
          /* @__PURE__ */ jsx5("div", { className: "mt-2 space-y-2", children: otherAssumptions.map((a) => /* @__PURE__ */ jsx5(
            AssumptionCard,
            {
              assumption: a,
              disabled: status === "finalized" || status === "abandoned",
              onResolve: (body) => resolveMutation.mutateAsync({ assumptionId: a.id, body }),
              onSkip: () => handleSkip(a)
            },
            a.id
          )) })
        ] }),
        (stream.state.errorMessage || streamBudgetExhausted) && stream.state.status === "error" && /* @__PURE__ */ jsx5("div", { className: "rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900", children: streamBudgetExhausted ? "You've used all the iteration rounds for this spec. Mark it ready or abandon the session." : stream.state.errorMessage }),
        status === "finalized" && pkgQuery.data?.presigned_zip_url && /* @__PURE__ */ jsx5(
          "a",
          {
            href: pkgQuery.data.presigned_zip_url,
            download: true,
            className: "inline-block text-primary underline",
            children: "Download package ZIP"
          }
        ),
        status !== "finalized" && status !== "abandoned" && /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
          !turnBudgetSpent && !isComplete && /* @__PURE__ */ jsx5(
            Textarea,
            {
              value: msg,
              onChange: (e) => setMsg(e.target.value),
              placeholder: "Optional: anything else for the next iteration?",
              rows: 2,
              disabled: isStreaming
            }
          ),
          /* @__PURE__ */ jsxs4("div", { className: "flex flex-wrap items-center gap-2", children: [
            !turnBudgetSpent && !isComplete && /* @__PURE__ */ jsx5(
              Button,
              {
                size: "sm",
                disabled: isStreaming || openAssumptions.length > 0,
                onClick: () => {
                  stream.start({ user_message: msg, restructure_allowed: false });
                  setMsg("");
                },
                title: openAssumptions.length > 0 ? "Resolve the open assumption(s) first" : "Run the next iteration",
                children: isStreaming ? "Running\u2026" : "Run iteration"
              }
            ),
            /* @__PURE__ */ jsx5(
              Button,
              {
                size: "sm",
                variant: turnBudgetSpent || isComplete ? "default" : "secondary",
                onClick: onMarkReady,
                disabled: !sess?.current_iteration_id || finalizeMutation.isPending || isStreaming,
                title: "Finalize the spec and produce the developer package",
                children: finalizeMutation.isPending ? "Marking ready\u2026" : "Mark ready"
              }
            ),
            /* @__PURE__ */ jsx5(
              Button,
              {
                size: "sm",
                variant: "ghost",
                onClick: () => abandonMutation.mutate(),
                disabled: abandonMutation.isPending || isStreaming,
                className: "text-muted-foreground",
                children: "Abandon"
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/Canvas.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function statusVariant(s) {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}
function humanStatus(s) {
  switch (s) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Closed (won't fix)";
    default:
      return s;
  }
}
function Canvas({ locked, onActivatePicker, onClearLocked }) {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);
  const [expandedId, setExpandedId] = useState4(null);
  const [iterByFeedback, setIterByFeedback] = useState4({});
  const [iterStartingId, setIterStartingId] = useState4(null);
  const [iterError, setIterError] = useState4(null);
  const cardRefs = useRef2({});
  const openIter = useCallback(
    async (feedbackId) => {
      setIterStartingId(feedbackId);
      setIterError(null);
      try {
        const session = await startIterSession(bindings, { feedback_id: feedbackId });
        setIterByFeedback((prev) => ({ ...prev, [feedbackId]: session.id }));
        setExpandedId(feedbackId);
      } catch (err) {
        const e = err;
        setIterError(e.detail ?? e.message ?? String(err));
      } finally {
        setIterStartingId(null);
      }
    },
    [bindings]
  );
  const handleSubmitted = useCallback(
    (feedbackId, opts) => {
      void query.refetch();
      setExpandedId(feedbackId);
      setTimeout(() => {
        cardRefs.current[feedbackId]?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 250);
      if (opts.thenIterate) {
        void openIter(feedbackId);
      }
    },
    [openIter, query]
  );
  useEffect3(() => {
    const known = new Set((query.data ?? []).map((r) => r.id));
    setIterByFeedback((prev) => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) if (known.has(k)) next[k] = v;
      return next;
    });
  }, [query.data]);
  return /* @__PURE__ */ jsxs5("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx6("div", { className: "sticky top-0 z-10 -mx-4 bg-background/95 px-4 pt-2 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80", children: /* @__PURE__ */ jsx6(
      Compose,
      {
        locked,
        onActivatePicker,
        onClearLocked,
        onSubmitted: handleSubmitted
      }
    ) }),
    query.isLoading ? /* @__PURE__ */ jsx6("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.loading") }) : query.isError ? /* @__PURE__ */ jsx6("p", { className: "text-sm text-destructive", children: t("feedback.mine.error") }) : (query.data ?? []).length === 0 ? /* @__PURE__ */ jsx6("p", { className: "text-sm text-muted-foreground", children: t("feedback.mine.empty") }) : /* @__PURE__ */ jsx6("ul", { className: "space-y-2", children: (query.data ?? []).map((r) => {
      const recentlyResolved = r.status === "done";
      const isOpen = expandedId === r.id;
      const iterSessionId = iterByFeedback[r.id] ?? null;
      return /* @__PURE__ */ jsx6(
        "li",
        {
          ref: (el) => {
            cardRefs.current[r.id] = el;
          },
          children: /* @__PURE__ */ jsxs5(
            "div",
            {
              className: `rounded-md border ${recentlyResolved ? "border-primary bg-primary/5" : "border-input"}`,
              children: [
                /* @__PURE__ */ jsxs5("div", { className: "w-full p-2 text-sm flex flex-col gap-1 hover:bg-accent rounded-md", children: [
                  /* @__PURE__ */ jsxs5("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxs5(
                      "button",
                      {
                        type: "button",
                        onClick: () => setExpandedId(isOpen ? null : r.id),
                        className: "flex flex-1 items-center gap-2 text-left",
                        "aria-expanded": isOpen,
                        "aria-controls": `ticket-detail-${r.id}`,
                        "data-feedback-id": "feedback.canvas.row",
                        children: [
                          /* @__PURE__ */ jsx6("code", { className: "font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0", children: r.ticket_code || "\u2014" }),
                          /* @__PURE__ */ jsx6(Badge, { variant: statusVariant(r.status), className: "shrink-0", children: humanStatus(r.status) }),
                          /* @__PURE__ */ jsx6("span", { className: "truncate flex-1 font-medium", children: r.title }),
                          isOpen ? /* @__PURE__ */ jsx6(ChevronUp, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsx6(ChevronDown, { className: "h-3.5 w-3.5 shrink-0 text-muted-foreground" })
                        ]
                      }
                    ),
                    !iterSessionId && /* @__PURE__ */ jsxs5(
                      Button,
                      {
                        type: "button",
                        size: "sm",
                        variant: "default",
                        onClick: (e) => {
                          e.stopPropagation();
                          void openIter(r.id);
                        },
                        disabled: iterStartingId === r.id,
                        className: "shrink-0",
                        "data-feedback-id": "feedback.canvas.iterate",
                        title: "Iterate with AI",
                        children: [
                          /* @__PURE__ */ jsx6(Sparkles2, { className: "h-3.5 w-3.5" }),
                          iterStartingId === r.id ? "Opening\u2026" : "Iterate"
                        ]
                      }
                    )
                  ] }),
                  recentlyResolved && !isOpen ? /* @__PURE__ */ jsx6("span", { className: "text-[11px] text-primary", children: t("feedback.mine.action_hint") }) : null
                ] }),
                isOpen ? /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    id: `ticket-detail-${r.id}`,
                    className: "border-t border-input px-3 py-3 space-y-3 text-xs",
                    children: [
                      r.created_at ? /* @__PURE__ */ jsx6("p", { className: "text-muted-foreground", children: t("feedback.mine.submitted_at", {
                        date: r.created_at.slice(0, 16).replace("T", " ")
                      }) }) : null,
                      /* @__PURE__ */ jsxs5("section", { children: [
                        /* @__PURE__ */ jsx6("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.field.description") }),
                        /* @__PURE__ */ jsx6("p", { className: "whitespace-pre-wrap", children: r.description || /* @__PURE__ */ jsx6("span", { className: "italic text-muted-foreground", children: t("feedback.mine.no_description") }) })
                      ] }),
                      r.expected_outcome ? /* @__PURE__ */ jsxs5("section", { children: [
                        /* @__PURE__ */ jsx6("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.field.expected_outcome") }),
                        /* @__PURE__ */ jsx6("p", { className: "whitespace-pre-wrap", children: r.expected_outcome })
                      ] }) : null,
                      r.triage_note ? /* @__PURE__ */ jsxs5("section", { className: "rounded bg-muted/50 p-2", children: [
                        /* @__PURE__ */ jsx6("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.mine.triage_note") }),
                        /* @__PURE__ */ jsx6("p", { className: "whitespace-pre-wrap", children: r.triage_note })
                      ] }) : null,
                      r.attachments && r.attachments.length > 0 ? /* @__PURE__ */ jsxs5("section", { children: [
                        /* @__PURE__ */ jsx6("h4", { className: "font-semibold text-foreground mb-1", children: t("feedback.mine.attachments", {
                          count: String(r.attachments.length)
                        }) }),
                        /* @__PURE__ */ jsx6("ul", { className: "space-y-1.5", children: r.attachments.map((a) => {
                          const isImage = a.content_type.startsWith("image/");
                          const label = a.filename ?? a.kind;
                          return /* @__PURE__ */ jsxs5(
                            "li",
                            {
                              className: "flex items-center gap-2 rounded border border-input bg-background p-1.5",
                              children: [
                                isImage && a.presigned_url ? /* @__PURE__ */ jsx6(
                                  "a",
                                  {
                                    href: a.presigned_url,
                                    target: "_blank",
                                    rel: "noreferrer",
                                    className: "shrink-0",
                                    children: /* @__PURE__ */ jsx6(
                                      "img",
                                      {
                                        src: a.presigned_url,
                                        alt: label,
                                        className: "h-10 w-10 rounded object-cover",
                                        loading: "lazy"
                                      }
                                    )
                                  }
                                ) : null,
                                /* @__PURE__ */ jsx6("span", { className: "flex-1 truncate font-mono", children: label }),
                                /* @__PURE__ */ jsxs5("span", { className: "text-muted-foreground shrink-0", children: [
                                  (a.byte_size / 1024).toFixed(1),
                                  " KB"
                                ] }),
                                a.presigned_url ? /* @__PURE__ */ jsx6(
                                  "a",
                                  {
                                    href: a.presigned_url,
                                    target: "_blank",
                                    rel: "noreferrer",
                                    className: "shrink-0 text-primary hover:underline",
                                    children: t("feedback.mine.open")
                                  }
                                ) : null
                              ]
                            },
                            a.id
                          );
                        }) })
                      ] }) : null,
                      /* @__PURE__ */ jsx6(CommentThread, { feedbackId: r.id }),
                      iterSessionId ? /* @__PURE__ */ jsx6(
                        InlineIterPane,
                        {
                          sessionId: iterSessionId,
                          onClose: () => {
                            setIterByFeedback((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            });
                          }
                        }
                      ) : /* @__PURE__ */ jsxs5(
                        Button,
                        {
                          size: "sm",
                          onClick: () => openIter(r.id),
                          disabled: iterStartingId === r.id,
                          "data-feedback-id": "feedback.canvas.iterate-inline",
                          children: [
                            /* @__PURE__ */ jsx6(Sparkles2, { className: "h-3.5 w-3.5" }),
                            iterStartingId === r.id ? "Opening\u2026" : "Iterate with AI"
                          ]
                        }
                      ),
                      iterError && iterStartingId === null ? /* @__PURE__ */ jsx6("p", { className: "text-xs text-destructive", children: iterError }) : null
                    ]
                  }
                ) : null
              ]
            }
          )
        },
        r.id
      );
    }) })
  ] });
}

// src/FeedbackPanel.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  return /* @__PURE__ */ jsx7(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs6(
    SheetContent,
    {
      side: "right",
      className: "w-full sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-[560px] overflow-y-auto",
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs6(SheetHeader, { children: [
          /* @__PURE__ */ jsxs6(SheetTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx7(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx7("span", { children: t("feedback.panel_title") })
          ] }),
          /* @__PURE__ */ jsx7(SheetDescription, { children: t("feedback.panel_description") })
        ] }),
        /* @__PURE__ */ jsxs6("div", { className: "px-4 mt-4", children: [
          /* @__PURE__ */ jsx7(
            Canvas,
            {
              locked,
              onActivatePicker,
              onClearLocked
            }
          ),
          /* @__PURE__ */ jsxs6(
            "a",
            {
              href: "https://rl3.dev",
              target: "_blank",
              rel: "noreferrer",
              className: "mt-4 flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
              "aria-label": t("feedback.powered_by_aria"),
              children: [
                /* @__PURE__ */ jsx7(Rl3Mark, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsxs6("span", { children: [
                  t("feedback.powered_by"),
                  " ",
                  /* @__PURE__ */ jsx7("strong", { className: "font-semibold", children: "RL3" })
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx7(SheetFooter, { className: "mt-4", children: /* @__PURE__ */ jsx7(
          Button,
          {
            variant: "outline",
            onClick: () => onOpenChange(false),
            "data-feedback-id": "feedback.cancel",
            children: t("feedback.cancel")
          }
        ) })
      ]
    }
  ) });
}
var FeedbackPanel_default = FeedbackPanel;
export {
  FeedbackPanel,
  FeedbackPanel_default as default
};
//# sourceMappingURL=FeedbackPanel-WBHVTDKN.js.map