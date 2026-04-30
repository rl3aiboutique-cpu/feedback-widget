import {
  Button,
  Input,
  MyTicketsPanel,
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
  SubmitFeedbackError,
  Textarea,
  captureElementScreenshot,
  capturePageScreenshot,
  cn,
  redactBundle,
  useFeedbackAdapter
} from "./chunk-W3G7PIWA.js";

// src/FeedbackPanel.tsx
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
function Label({
  className,
  ...props
}) {
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
      adapter.toast.error(
        t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) })
      );
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
        adapter.toast.error(
          t("feedback.attachments.bad_type", { name: file.name })
        );
        continue;
      }
      accepted.push(file);
    }
    if (truncated) {
      adapter.toast.error(
        t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) })
      );
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
    /* @__PURE__ */ jsxs(
      Label,
      {
        htmlFor: "feedback-attachments",
        title: t("feedback.attachments.hint"),
        children: [
          t("feedback.attachments.label"),
          /* @__PURE__ */ jsx2(
            "span",
            {
              className: "ml-1 cursor-help text-[11px] text-muted-foreground",
              "aria-label": t("feedback.attachments.hint"),
              children: "\u24D8"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      "div",
      {
        onClick: () => inputRef.current?.click(),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        },
        onDragOver,
        onDragLeave,
        onDrop,
        role: "button",
        tabIndex: 0,
        "aria-label": t("feedback.attachments.dropzone"),
        className: `cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors
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
        /* @__PURE__ */ jsxs2(
          Label,
          {
            htmlFor: "feedback-title",
            title: t("feedback.field.title_hint"),
            children: [
              t("feedback.field.title"),
              /* @__PURE__ */ jsx3(_RequiredMark, {})
            ]
          }
        ),
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

// src/FeedbackPanel.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [values, setValues] = useState2(() => ({
    ...EMPTY_FORM
  }));
  const [mode, setMode] = useState2(locked ? "element" : "page");
  const [submitting, setSubmitting] = useState2(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState2(open);
  const [tab, setTab] = useState2("submit");
  useEffect2(() => {
    if (open) setHasOpenedOnce(true);
  }, [open]);
  useEffect2(() => {
    if (!open && hasOpenedOnce && !locked) {
      const id = setTimeout(() => {
        setValues({ ...EMPTY_FORM });
        setMode("page");
        setSubmitting(false);
      }, 200);
      return () => clearTimeout(id);
    }
    return void 0;
  }, [open, hasOpenedOnce, locked]);
  useEffect2(() => {
    if (locked) setMode("element");
  }, [locked]);
  const [fieldErrors, setFieldErrors] = useState2({});
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
      bounding_box: {
        x: locked.info.bounding_box.x,
        y: locked.info.bounding_box.y,
        w: locked.info.bounding_box.w,
        h: locked.info.bounding_box.h
      }
    };
  }, [locked]);
  const validate = () => {
    if (!values.type) {
      return { ok: false, reason: "type" };
    }
    if (!values.title.trim()) {
      return { ok: false, reason: "title" };
    }
    if (!values.description.trim()) {
      return { ok: false, reason: "description" };
    }
    return { ok: true };
  };
  const captureScreenshot = async () => {
    const opts = {
      redactionSelectors: adapter.getDefaultRedactionSelectors()
    };
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
  const onSubmit = async () => {
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
      const message = t("feedback.toast_error_required_field", {
        field: fieldLabel
      });
      setFieldErrors({ [reason]: message });
      adapter.toast.error(message);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
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
      const payloadJson = JSON.stringify(payload);
      const payloadBytes = new Blob([payloadJson]).size;
      const screenshotBytes = shot?.blob.size ?? 0;
      const attachmentBytes = values.attachments.reduce(
        (sum, f) => sum + f.size,
        0
      );
      console.info("[feedback] submit", {
        payloadBytes,
        screenshotBytes,
        attachmentBytes,
        attachmentCount: values.attachments.length,
        totalBytes: payloadBytes + screenshotBytes + attachmentBytes
      });
      const created = await adapter.submitFeedback(
        payloadJson,
        shot?.blob ?? null,
        values.attachments
      );
      const link = adapter.getDeepLinkToFeedback(created.id);
      const ticketLabel = created.ticket_code || created.id.slice(0, 8);
      adapter.toast.success(
        t("feedback.toast_success", { id: ticketLabel }),
        {
          url: link,
          actionLabel: t("feedback.toast_success_link")
        }
      );
      onOpenChange(false);
    } catch (err) {
      if (err instanceof SubmitFeedbackError && err.status === 429) {
        const seconds = err.retryAfter ?? "?";
        adapter.toast.error(
          t("feedback.toast_error_429", { seconds: String(seconds) })
        );
      } else {
        adapter.toast.error(t("feedback.toast_error_generic"));
      }
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsx4(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs3(
    SheetContent,
    {
      side: "right",
      className: "w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto",
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs3(SheetHeader, { children: [
          /* @__PURE__ */ jsxs3(SheetTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx4(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx4("span", { children: t("feedback.panel_title") })
          ] }),
          /* @__PURE__ */ jsx4(SheetDescription, { children: t("feedback.panel_description") })
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: "px-4 mt-4 space-y-4", children: [
          /* @__PURE__ */ jsxs3(
            "div",
            {
              className: "grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium",
              role: "tablist",
              children: [
                /* @__PURE__ */ jsx4(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "aria-selected": tab === "submit",
                    onClick: () => setTab("submit"),
                    className: `px-3 py-1.5 rounded transition-colors ${tab === "submit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
                    "data-feedback-id": "feedback.tab.submit",
                    children: t("feedback.tab.submit")
                  }
                ),
                /* @__PURE__ */ jsx4(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "aria-selected": tab === "mine",
                    onClick: () => setTab("mine"),
                    className: `px-3 py-1.5 rounded transition-colors ${tab === "mine" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`,
                    "data-feedback-id": "feedback.tab.mine",
                    children: t("feedback.tab.mine")
                  }
                )
              ]
            }
          ),
          tab === "mine" ? /* @__PURE__ */ jsx4(MyTicketsPanel, {}) : null,
          tab === "submit" ? /* @__PURE__ */ jsxs3(Fragment2, { children: [
            /* @__PURE__ */ jsxs3("div", { className: "rounded-md border border-input p-3 space-y-2", children: [
              /* @__PURE__ */ jsx4("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: t("feedback.mode_label") }),
              /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-2", children: [
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
                )
              ] }),
              mode === "element" && locked ? /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between rounded-md bg-primary/10 px-2 py-1 text-xs", children: [
                /* @__PURE__ */ jsx4("span", { className: "font-mono truncate", children: locked.info.selector }),
                /* @__PURE__ */ jsx4(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      onClearLocked();
                      setMode("page");
                    },
                    className: "text-primary underline-offset-4 hover:underline ml-2",
                    "data-feedback-id": "feedback.clear_element",
                    children: t("feedback.clear_element")
                  }
                )
              ] }) : null
            ] }),
            /* @__PURE__ */ jsx4(
              FeedbackForm,
              {
                values,
                onChange: setValues,
                errors: fieldErrors
              }
            )
          ] }) : null,
          /* @__PURE__ */ jsxs3(
            "a",
            {
              href: "https://rl3.dev",
              target: "_blank",
              rel: "noreferrer",
              className: "flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
              "aria-label": t("feedback.powered_by_aria"),
              children: [
                /* @__PURE__ */ jsx4(Rl3Mark, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsxs3("span", { children: [
                  t("feedback.powered_by"),
                  " ",
                  /* @__PURE__ */ jsx4("strong", { className: "font-semibold", children: "RL3" })
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs3(SheetFooter, { className: "mt-6", children: [
          /* @__PURE__ */ jsx4(
            Button,
            {
              variant: "outline",
              onClick: () => onOpenChange(false),
              disabled: submitting,
              "data-feedback-id": "feedback.cancel",
              children: t("feedback.cancel")
            }
          ),
          tab === "submit" ? /* @__PURE__ */ jsx4(
            Button,
            {
              type: "button",
              onClick: onSubmit,
              disabled: submitting || !values.type,
              "data-feedback-id": "feedback.submit",
              children: submitting ? t("feedback.submitting") : t("feedback.submit")
            }
          ) : null
        ] })
      ]
    }
  ) });
}
var FeedbackPanel_default = FeedbackPanel;
export {
  FeedbackPanel,
  FeedbackPanel_default as default
};
//# sourceMappingURL=FeedbackPanel-UJJKJYYI.js.map