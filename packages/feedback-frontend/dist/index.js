import {
  Badge,
  Button,
  FeedbackProvider,
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
  SheetHeader,
  SheetTitle,
  SubmitFeedbackError,
  Textarea,
  cn,
  createAdapter,
  describeElement,
  useDeleteFeedbackMutation,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig,
  useFeedbackDetailQuery,
  useFeedbackListQuery,
  useMyPendingActionCount,
  useUpdateFeedbackStatusMutation
} from "./chunk-2ALMQ6BZ.js";

// src/version.ts
var VERSION = "0.1.0";

// src/hooks/useCanTriageFeedback.ts
function useCanTriageFeedback() {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const user = adapter.useCurrentUser();
  if (!user) return false;
  const allowed = (bindings.triageRoles && bindings.triageRoles.length > 0 ? bindings.triageRoles : ["MASTER_ADMIN"]).map((r) => r.toUpperCase());
  return allowed.includes(user.role.toUpperCase());
}

// src/admin/FeedbackTriagePage.tsx
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

// src/ui/table.tsx
import { jsx } from "react/jsx-runtime";
function Table({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "table-container",
      className: "relative w-full overflow-x-auto rounded-lg border",
      children: /* @__PURE__ */ jsx(
        "table",
        {
          "data-slot": "table",
          className: cn("w-full caption-bottom text-sm", className),
          ...props
        }
      )
    }
  );
}
function TableHeader({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "thead",
    {
      "data-slot": "table-header",
      className: cn("bg-muted/50 [&_tr]:border-b", className),
      ...props
    }
  );
}
function TableBody({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "tbody",
    {
      "data-slot": "table-body",
      className: cn("[&_tr:last-child]:border-0", className),
      ...props
    }
  );
}
function TableRow({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "tr",
    {
      "data-slot": "table-row",
      className: cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      ),
      ...props
    }
  );
}
function TableHead({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "th",
    {
      "data-slot": "table-head",
      className: cn(
        "text-muted-foreground h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      ),
      ...props
    }
  );
}
function TableCell({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "td",
    {
      "data-slot": "table-cell",
      className: cn(
        "px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      ),
      ...props
    }
  );
}

// src/admin/FeedbackTriagePage.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var TYPE_VALUES = [
  "bug",
  "new_feature",
  "extend_feature",
  "new_user_story",
  "question",
  "ux_polish",
  "performance",
  "data_issue"
];
var ADMIN_STATUS_VALUES = [
  "new",
  "triaged",
  "in_progress",
  "done",
  "wont_fix"
];
var ALL_STATUS_VALUES = [
  ...ADMIN_STATUS_VALUES,
  "accepted_by_user",
  "rejected_by_user"
];
function statusVariant(s) {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix" || s === "rejected_by_user") return "destructive";
  return "outline";
}
function FeedbackTriagePage() {
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const isAdmin = user?.role === "MASTER_ADMIN";
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(
    "all"
  );
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const list = useFeedbackListQuery({
    type: typeFilter === "all" ? null : typeFilter,
    status: statusFilter === "all" ? null : statusFilter,
    q,
    page: 1,
    pageSize: 50
  });
  const detail = useFeedbackDetailQuery(openId);
  const patchStatus = useUpdateFeedbackStatusMutation();
  const remove = useDeleteFeedbackMutation();
  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  if (!isAdmin) {
    return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx2("h1", { className: "text-2xl font-semibold", children: "Feedback" }),
      /* @__PURE__ */ jsx2("p", { className: "text-muted-foreground", children: "Only MASTER_ADMIN can see the triage queue." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx2("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("h1", { className: "flex items-center gap-3 text-2xl font-semibold", children: [
        /* @__PURE__ */ jsx2(Rl3Mark, { className: "h-7 w-7 shrink-0" }),
        /* @__PURE__ */ jsx2("span", { children: "RL3 Feedback \u2014 triage" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "text-sm text-muted-foreground", children: [
        list.data?.count ?? 0,
        " total \xB7 Filter by type, status, or title."
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end gap-3 rounded-md border p-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-48", children: [
        /* @__PURE__ */ jsx2("label", { className: "block text-xs text-muted-foreground mb-1", children: "Type" }),
        /* @__PURE__ */ jsxs(
          Select,
          {
            value: typeFilter,
            onValueChange: (v) => setTypeFilter(v),
            children: [
              /* @__PURE__ */ jsx2(SelectTrigger, { children: /* @__PURE__ */ jsx2(SelectValue, {}) }),
              /* @__PURE__ */ jsxs(SelectContent, { children: [
                /* @__PURE__ */ jsx2(SelectItem, { value: "all", children: "All" }),
                TYPE_VALUES.map((t) => /* @__PURE__ */ jsx2(SelectItem, { value: t, children: t }, t))
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-48", children: [
        /* @__PURE__ */ jsx2("label", { className: "block text-xs text-muted-foreground mb-1", children: "Status" }),
        /* @__PURE__ */ jsxs(
          Select,
          {
            value: statusFilter,
            onValueChange: (v) => setStatusFilter(v),
            children: [
              /* @__PURE__ */ jsx2(SelectTrigger, { children: /* @__PURE__ */ jsx2(SelectValue, {}) }),
              /* @__PURE__ */ jsxs(SelectContent, { children: [
                /* @__PURE__ */ jsx2(SelectItem, { value: "all", children: "All" }),
                ALL_STATUS_VALUES.map((s) => /* @__PURE__ */ jsx2(SelectItem, { value: s, children: s }, s))
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-48", children: [
        /* @__PURE__ */ jsx2("label", { className: "block text-xs text-muted-foreground mb-1", children: "Search title" }),
        /* @__PURE__ */ jsx2(
          Input,
          {
            value: q,
            onChange: (e) => setQ(e.target.value),
            placeholder: "\u2026"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx2("div", { className: "rounded-md border", children: /* @__PURE__ */ jsxs(Table, { children: [
      /* @__PURE__ */ jsx2(TableHeader, { children: /* @__PURE__ */ jsxs(TableRow, { children: [
        /* @__PURE__ */ jsx2(TableHead, { className: "w-32", children: "Ticket" }),
        /* @__PURE__ */ jsx2(TableHead, { className: "w-32", children: "Date" }),
        /* @__PURE__ */ jsx2(TableHead, { className: "w-32", children: "Type" }),
        /* @__PURE__ */ jsx2(TableHead, { className: "w-32", children: "Status" }),
        /* @__PURE__ */ jsx2(TableHead, { children: "Title" }),
        /* @__PURE__ */ jsx2(TableHead, { className: "w-48", children: "Route" })
      ] }) }),
      /* @__PURE__ */ jsx2(TableBody, { children: list.isLoading ? /* @__PURE__ */ jsx2(TableRow, { children: /* @__PURE__ */ jsx2(
        TableCell,
        {
          colSpan: 6,
          className: "text-center text-muted-foreground py-6",
          children: "Loading\u2026"
        }
      ) }) : rows.length === 0 ? /* @__PURE__ */ jsx2(TableRow, { children: /* @__PURE__ */ jsx2(
        TableCell,
        {
          colSpan: 6,
          className: "text-center text-muted-foreground py-6",
          children: "No matching feedback."
        }
      ) }) : rows.map((row) => /* @__PURE__ */ jsxs(
        TableRow,
        {
          className: "cursor-pointer hover:bg-accent",
          onClick: () => setOpenId(row.id),
          children: [
            /* @__PURE__ */ jsxs(TableCell, { className: "font-mono text-xs", children: [
              row.ticket_code || "\u2014",
              row.parent_ticket_code ? /* @__PURE__ */ jsxs("div", { className: "text-[10px] text-muted-foreground", children: [
                "\u21B3 ",
                row.parent_ticket_code
              ] }) : null
            ] }),
            /* @__PURE__ */ jsx2(TableCell, { className: "text-xs text-muted-foreground", children: row.created_at?.slice(0, 16) ?? "" }),
            /* @__PURE__ */ jsx2(TableCell, { children: /* @__PURE__ */ jsx2(Badge, { variant: "outline", children: row.type }) }),
            /* @__PURE__ */ jsx2(TableCell, { children: /* @__PURE__ */ jsx2(Badge, { variant: statusVariant(row.status), children: row.status }) }),
            /* @__PURE__ */ jsx2(TableCell, { className: "font-medium", children: row.title }),
            /* @__PURE__ */ jsx2(TableCell, { className: "text-xs text-muted-foreground truncate max-w-48", children: row.route_name ?? "\u2014" })
          ]
        },
        row.id
      )) })
    ] }) }),
    /* @__PURE__ */ jsx2(
      Sheet,
      {
        open: !!openId,
        onOpenChange: (open) => {
          if (!open) setOpenId(null);
        },
        children: /* @__PURE__ */ jsxs(
          SheetContent,
          {
            side: "right",
            className: "w-full sm:max-w-2xl overflow-y-auto",
            children: [
              /* @__PURE__ */ jsxs(SheetHeader, { children: [
                /* @__PURE__ */ jsxs(SheetTitle, { className: "flex items-center gap-2", children: [
                  detail.data?.ticket_code ? /* @__PURE__ */ jsx2("span", { className: "font-mono text-xs px-1.5 py-0.5 rounded bg-muted shrink-0", children: detail.data.ticket_code }) : null,
                  /* @__PURE__ */ jsx2("span", { className: "truncate", children: detail.data?.title ?? "" })
                ] }),
                /* @__PURE__ */ jsx2(SheetDescription, { children: detail.data ? /* @__PURE__ */ jsxs("span", { className: "text-xs space-y-0.5 block", children: [
                  /* @__PURE__ */ jsxs("span", { children: [
                    detail.data.type,
                    " \xB7 ",
                    detail.data.created_at?.slice(0, 16),
                    " ",
                    "\xB7 ",
                    detail.data.url_captured
                  ] }),
                  detail.data.parent_ticket_code ? /* @__PURE__ */ jsxs("span", { className: "block text-primary", children: [
                    "\u21B3 Linked to ",
                    detail.data.parent_ticket_code
                  ] }) : null,
                  detail.data.follow_up_email ? /* @__PURE__ */ jsxs("span", { className: "block", children: [
                    "Follow-up: ",
                    detail.data.follow_up_email
                  ] }) : null
                ] }) : "Loading\u2026" })
              ] }),
              detail.data ? /* @__PURE__ */ jsx2(
                DetailBody,
                {
                  data: detail.data,
                  onChangeStatus: (status, note) => {
                    patchStatus.mutate(
                      { id: detail.data.id, status, triage_note: note },
                      {
                        onSuccess: () => adapter.toast.success("Status updated"),
                        onError: (err) => adapter.toast.error(`Could not update: ${String(err)}`)
                      }
                    );
                  },
                  onDelete: () => {
                    remove.mutate(detail.data.id, {
                      onSuccess: () => {
                        adapter.toast.success("Feedback deleted");
                        setOpenId(null);
                      },
                      onError: (err) => adapter.toast.error(`Could not delete: ${String(err)}`)
                    });
                  },
                  busy: patchStatus.isPending || remove.isPending
                }
              ) : null
            ]
          }
        )
      }
    )
  ] });
}
function DetailBody({
  data,
  onChangeStatus,
  onDelete,
  busy
}) {
  const adapter = useFeedbackAdapter();
  const [status, setStatus] = useState(data.status);
  const [note, setNote] = useState(data.triage_note ?? "");
  const screenshot = data.attachments?.[0]?.presigned_url ?? null;
  return /* @__PURE__ */ jsxs("div", { className: "px-4 mt-4 space-y-5", children: [
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx2("h3", { className: "text-sm font-medium mb-1", children: "Description" }),
      /* @__PURE__ */ jsx2("pre", { className: "whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border", children: data.description })
    ] }),
    Object.keys(data.type_fields ?? {}).length > 0 ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx2("h3", { className: "text-sm font-medium mb-1", children: "Type-specific fields" }),
      /* @__PURE__ */ jsx2("dl", { className: "rounded-md border divide-y", children: Object.entries(data.type_fields).map(([k, v]) => /* @__PURE__ */ jsxs("div", { className: "flex p-2 text-sm", children: [
        /* @__PURE__ */ jsx2("dt", { className: "w-44 text-muted-foreground", children: k }),
        /* @__PURE__ */ jsx2("dd", { className: "flex-1 whitespace-pre-wrap", children: String(v) })
      ] }, k)) })
    ] }) : null,
    data.persona ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx2("h3", { className: "text-sm font-medium mb-1", children: "Persona" }),
      /* @__PURE__ */ jsx2("pre", { className: "whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border", children: data.persona })
    ] }) : null,
    (data.linked_user_stories?.length ?? 0) > 0 ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx2("h3", { className: "text-sm font-medium mb-1", children: "Linked user stories" }),
      /* @__PURE__ */ jsx2("ul", { className: "space-y-2", children: data.linked_user_stories.map((s, i) => {
        const story = s;
        return /* @__PURE__ */ jsxs("li", { className: "rounded-md border p-2 text-sm", children: [
          /* @__PURE__ */ jsx2("div", { className: "font-medium", children: String(story.story ?? "") }),
          story.priority ? /* @__PURE__ */ jsx2(Badge, { variant: "outline", className: "mt-1", children: String(story.priority) }) : null,
          story.acceptance_criteria ? /* @__PURE__ */ jsx2("pre", { className: "whitespace-pre-wrap text-xs text-muted-foreground mt-1", children: String(story.acceptance_criteria) }) : null
        ] }, i);
      }) })
    ] }) : null,
    screenshot ? /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx2("h3", { className: "text-sm font-medium mb-1", children: "Screenshot" }),
      /* @__PURE__ */ jsx2("a", { href: screenshot, target: "_blank", rel: "noreferrer", children: /* @__PURE__ */ jsx2(
        "img",
        {
          src: screenshot,
          alt: "Screenshot",
          className: "w-full rounded-md border",
          loading: "lazy"
        }
      ) })
    ] }) : null,
    /* @__PURE__ */ jsxs("details", { className: "text-xs", children: [
      /* @__PURE__ */ jsx2("summary", { className: "cursor-pointer font-medium text-foreground", children: "Technical metadata (redacted)" }),
      /* @__PURE__ */ jsx2("pre", { className: "whitespace-pre-wrap rounded-md bg-muted/50 p-3 border mt-2 max-h-96 overflow-auto", children: JSON.stringify(data.metadata_bundle, null, 2) })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "rounded-md border p-3 space-y-3", children: [
      /* @__PURE__ */ jsx2("h3", { className: "text-sm font-medium", children: "Triage" }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx2("span", { className: "text-xs text-muted-foreground w-28", children: "Status" }),
        /* @__PURE__ */ jsxs(
          Select,
          {
            value: status,
            onValueChange: (v) => setStatus(v),
            children: [
              /* @__PURE__ */ jsx2(SelectTrigger, { className: "flex-1", children: /* @__PURE__ */ jsx2(SelectValue, {}) }),
              /* @__PURE__ */ jsx2(SelectContent, { children: ADMIN_STATUS_VALUES.map((s) => /* @__PURE__ */ jsx2(SelectItem, { value: s, children: s }, s)) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx2("span", { className: "block text-xs text-muted-foreground mb-1", children: "Triage note" }),
        /* @__PURE__ */ jsx2(
          Textarea,
          {
            rows: 3,
            value: note,
            onChange: (e) => setNote(e.target.value),
            placeholder: "Why this status, what was done\u2026"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsx2(
          Button,
          {
            type: "button",
            onClick: () => onChangeStatus(status, note || void 0),
            disabled: busy,
            children: "Save status"
          }
        ),
        /* @__PURE__ */ jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            "data-feedback-id": "feedback.triage.download",
            onClick: async () => {
              try {
                const { blob, filename } = await adapter.downloadFeedbackBundle(
                  data.id
                );
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                adapter.toast.success(`Downloaded ${filename}`);
              } catch (err) {
                adapter.toast.error(`Could not download: ${String(err)}`);
              }
            },
            disabled: busy,
            children: [
              /* @__PURE__ */ jsx2(Download, { className: "mr-1 h-3.5 w-3.5" }),
              "Download .zip"
            ]
          }
        ),
        /* @__PURE__ */ jsx2(
          Button,
          {
            type: "button",
            variant: "destructive",
            onClick: () => {
              if (window.confirm(
                "Delete this feedback? This removes the row + attachment."
              )) {
                onDelete();
              }
            },
            disabled: busy,
            children: "Delete"
          }
        )
      ] })
    ] })
  ] });
}

// src/FeedbackButton.tsx
import { lazy, Suspense, useCallback, useEffect as useEffect2, useState as useState3 } from "react";

// src/ElementSelector.tsx
import { useEffect, useRef, useState as useState2 } from "react";
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var MIN_HIGHLIGHT_SIZE = 8;
function _isInsideWidget(el) {
  return Boolean(el.closest('[data-feedback-widget-root="true"]'));
}
function _accessibleName(el) {
  const aria = el.getAttribute("aria-label");
  if (aria) return aria;
  const title = el.getAttribute("title");
  if (title) return title;
  if (el instanceof HTMLElement && el.innerText) {
    return el.innerText.trim().slice(0, 60);
  }
  return el.tagName.toLowerCase();
}
function ElementSelector({
  onLock,
  onCancel
}) {
  const [rect, setRect] = useState2(null);
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentRef = useRef(null);
  useEffect(() => {
    if (typeof document === "undefined") return void 0;
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !(el instanceof HTMLElement) || _isInsideWidget(el)) {
        currentRef.current = null;
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < MIN_HIGHLIGHT_SIZE || r.height < MIN_HIGHLIGHT_SIZE) {
        currentRef.current = null;
        setRect(null);
        return;
      }
      currentRef.current = el;
      setRect({
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        label: `${el.tagName.toLowerCase()} \xB7 ${_accessibleName(el)}`
      });
    };
    const onClick = (e) => {
      const target = currentRef.current;
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        onLock(target);
      } else {
        onCancel();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onLock, onCancel]);
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      "data-feedback-widget-root": "true",
      role: "dialog",
      "aria-label": t("feedback.element_selector_active"),
      "aria-live": "polite",
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 2147483645,
        pointerEvents: "none"
      },
      children: [
        /* @__PURE__ */ jsx3(
          "div",
          {
            style: {
              position: "fixed",
              left: "50%",
              top: 16,
              transform: "translateX(-50%)",
              background: "#1E40AF",
              color: "#ffffff",
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 6px 16px rgba(0,0,0,0.25)"
            },
            children: t("feedback.element_selector_hint")
          }
        ),
        rect ? /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx3(
            "div",
            {
              style: {
                position: "fixed",
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                border: "2px solid #1E40AF",
                borderRadius: 4,
                boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.35)",
                transition: "all 80ms ease-out"
              }
            }
          ),
          /* @__PURE__ */ jsx3(
            "div",
            {
              style: {
                position: "fixed",
                left: rect.x,
                top: Math.max(0, rect.y - 26),
                background: "#1E40AF",
                color: "#ffffff",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                maxWidth: 360,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              },
              children: rect.label
            }
          )
        ] }) : null
      ]
    }
  );
}

// src/FeedbackButton.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var FeedbackPanelLazy = lazy(() => import("./FeedbackPanel-3KIGK4TV.js"));
var POSITION_CLASSES = {
  bottom_right: "bottom-24 right-6",
  bottom_left: "bottom-24 left-6",
  top_right: "top-6 right-6",
  top_left: "top-6 left-6"
};
function FeedbackButton() {
  const config = useFeedbackConfig();
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [open, setOpen] = useState3(false);
  const [pickerActive, setPickerActive] = useState3(false);
  const [locked, setLocked] = useState3(null);
  const [initialParentTicket, setInitialParentTicket] = useState3(
    null
  );
  const handlePickerLock = useCallback((el) => {
    setLocked({ el, info: describeElement(el) });
    setPickerActive(false);
    setOpen(true);
  }, []);
  const handlePickerCancel = useCallback(() => {
    setPickerActive(false);
    setOpen(true);
  }, []);
  const handleActivatePicker = useCallback(() => {
    setPickerActive(true);
    setOpen(false);
  }, []);
  const handleClearLocked = useCallback(() => {
    setLocked(null);
  }, []);
  useEffect2(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const parent = params.get("parent");
    if (!parent || !/^FB-\d{4}-\d{4}$/.test(parent)) return;
    setInitialParentTicket(parent);
    setOpen(true);
    params.delete("parent");
    const cleanQuery = params.toString();
    const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "");
    window.history.replaceState(null, "", cleanUrl + window.location.hash);
  }, []);
  const pendingCount = useMyPendingActionCount();
  if (!config.enabled) return null;
  const cornerClass = POSITION_CLASSES[config.position] ?? POSITION_CLASSES.bottom_right;
  const accentStyle = config.brandPrimaryHex ? { "--feedback-brand": config.brandPrimaryHex } : void 0;
  return /* @__PURE__ */ jsxs3("div", { "data-feedback-widget-root": "true", children: [
    /* @__PURE__ */ jsxs3(
      "button",
      {
        type: "button",
        onClick: () => setOpen(true),
        "aria-label": t("feedback.open_button"),
        title: pendingCount > 0 ? t("feedback.open_button_with_pending", {
          count: String(pendingCount)
        }) : t("feedback.open_button"),
        "data-feedback-id": "feedback.open_button",
        className: `fixed z-[2147483640] flex items-center gap-2 rounded-full pl-2 pr-4 py-1.5 shadow-lg
                    bg-background border border-input text-foreground hover:bg-accent
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    focus-visible:ring-offset-2 transition-all hover:scale-[1.02] hover:shadow-xl
                    ${cornerClass}`,
        style: accentStyle,
        children: [
          /* @__PURE__ */ jsxs3("span", { className: "relative", children: [
            /* @__PURE__ */ jsx4(Rl3Mark, { className: "h-7 w-7 shrink-0" }),
            pendingCount > 0 ? /* @__PURE__ */ jsx4(
              "span",
              {
                "aria-hidden": "true",
                className: "absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background",
                children: pendingCount > 9 ? "9+" : pendingCount
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsx4("span", { className: "text-sm font-semibold", children: t("feedback.button_label") })
        ]
      }
    ),
    open || pickerActive ? /* @__PURE__ */ jsx4(Suspense, { fallback: null, children: /* @__PURE__ */ jsx4(
      FeedbackPanelLazy,
      {
        open: open && !pickerActive,
        onOpenChange: (v) => {
          setOpen(v);
          if (!v) setInitialParentTicket(null);
        },
        locked,
        onActivatePicker: handleActivatePicker,
        onClearLocked: handleClearLocked,
        initialParentTicket,
        onScreenshotCaptured: (_) => {
        }
      }
    ) }) : null,
    pickerActive ? /* @__PURE__ */ jsx4(
      ElementSelector,
      {
        onLock: handlePickerLock,
        onCancel: handlePickerCancel
      }
    ) : null
  ] });
}
var FeedbackButton_default = FeedbackButton;

// src/public/FeedbackActionPage.tsx
import { useEffect as useEffect3, useState as useState4 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function FeedbackActionPage({
  action,
  token,
  onSubmitFollowUp
}) {
  const adapter = useFeedbackAdapter();
  const [phase, setPhase] = useState4(
    token ? { kind: "loading" } : { kind: "missing_token" }
  );
  useEffect3(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await adapter.consumeActionToken(
          token,
          action
        );
        if (!cancelled) setPhase({ kind: "success", result });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "This link is no longer valid.";
        setPhase({ kind: "error", message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [action, token, adapter]);
  return /* @__PURE__ */ jsx5("div", { className: "min-h-screen flex items-center justify-center bg-background p-4", children: /* @__PURE__ */ jsxs4("div", { className: "w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4", children: [
    /* @__PURE__ */ jsxs4("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx5(Rl3Mark, { className: "h-6 w-6" }),
      /* @__PURE__ */ jsx5("h1", { className: "text-lg font-semibold", children: "RL3 Feedback" })
    ] }),
    phase.kind === "missing_token" ? /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx5("h2", { className: "text-base font-medium", children: "Missing token" }),
      /* @__PURE__ */ jsxs4("p", { className: "text-sm text-muted-foreground", children: [
        "This page expects a ",
        /* @__PURE__ */ jsx5("code", { children: "?token=\u2026" }),
        " query parameter from the email button. If you copied the link manually, please use the button instead."
      ] })
    ] }) : null,
    phase.kind === "loading" ? /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx5("h2", { className: "text-base font-medium", children: action === "accept" ? "Recording your acceptance\u2026" : "Recording your rejection\u2026" }),
      /* @__PURE__ */ jsx5("p", { className: "text-sm text-muted-foreground", children: "One moment." })
    ] }) : null,
    phase.kind === "success" ? /* @__PURE__ */ jsx5(
      SuccessBlock,
      {
        action,
        result: phase.result,
        onSubmitFollowUp
      }
    ) : null,
    phase.kind === "error" ? /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx5("h2", { className: "text-base font-medium", children: "This link is no longer valid." }),
      /* @__PURE__ */ jsx5("p", { className: "text-sm text-muted-foreground", children: "The link may have already been used or has expired. If you still want to act on this ticket, please open the app and find the ticket in your feedback list." }),
      /* @__PURE__ */ jsx5("p", { className: "text-xs text-muted-foreground/70 break-words", children: phase.message })
    ] }) : null
  ] }) });
}
function SuccessBlock({
  action,
  result,
  onSubmitFollowUp
}) {
  const isAccept = action === "accept";
  const cascadeNote = isAccept && result.cascade_count && result.cascade_count > 0 ? ` ${result.cascade_count} linked ticket${result.cascade_count === 1 ? "" : "s"} also auto-accepted.` : "";
  return /* @__PURE__ */ jsxs4("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsx5("h2", { className: "text-base font-medium", children: isAccept ? "Thanks \u2014 closed." : "Got it \u2014 marked as not resolved." }),
    /* @__PURE__ */ jsxs4("p", { className: "text-sm text-muted-foreground", children: [
      "Ticket",
      " ",
      /* @__PURE__ */ jsx5("code", { className: "font-mono px-1 py-0.5 rounded bg-muted", children: result.ticket_code }),
      " ",
      "is ",
      isAccept ? "now closed" : "open for a follow-up",
      ".",
      cascadeNote
    ] }),
    !isAccept ? /* @__PURE__ */ jsxs4("div", { className: "space-y-2 rounded-md border p-3 bg-muted/30", children: [
      /* @__PURE__ */ jsxs4("p", { className: "text-sm", children: [
        "Tell us what's still wrong \u2014 we'll open a fresh ticket linked to",
        " ",
        /* @__PURE__ */ jsx5("strong", { children: result.ticket_code }),
        " so we can iterate."
      ] }),
      onSubmitFollowUp ? /* @__PURE__ */ jsx5(
        Button,
        {
          type: "button",
          onClick: () => onSubmitFollowUp(result.ticket_code),
          children: "Submit a follow-up"
        }
      ) : /* @__PURE__ */ jsxs4("p", { className: "text-xs text-muted-foreground", children: [
        'Open the Compliance Brain app and click the floating feedback button \u2014 pre-fill the "Linked to" field with',
        " ",
        /* @__PURE__ */ jsx5("code", { className: "font-mono", children: result.ticket_code }),
        "."
      ] })
    ] }) : null,
    /* @__PURE__ */ jsx5("p", { className: "text-xs text-muted-foreground pt-2", children: "You can close this tab." })
  ] });
}
export {
  FeedbackActionPage,
  FeedbackButton,
  FeedbackButton_default as FeedbackButtonDefault,
  FeedbackProvider,
  FeedbackTriagePage,
  SubmitFeedbackError,
  VERSION,
  createAdapter,
  useCanTriageFeedback,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig
};
//# sourceMappingURL=index.js.map