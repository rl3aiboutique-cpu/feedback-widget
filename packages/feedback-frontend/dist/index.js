import {
  Badge,
  Button,
  FeedbackProvider,
  Input,
  Rl3Mark,
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
} from "./chunk-GXNRGDHV.js";

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

// src/ui/select.tsx
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
function Select({
  ...props
}) {
  return /* @__PURE__ */ jsx(SelectPrimitive.Root, { "data-slot": "select", ...props });
}
function SelectValue({
  ...props
}) {
  return /* @__PURE__ */ jsx(SelectPrimitive.Value, { "data-slot": "select-value", ...props });
}
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    SelectPrimitive.Trigger,
    {
      "data-slot": "select-trigger",
      "data-size": size,
      className: cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsx(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ jsx(ChevronDownIcon, { className: "size-4 opacity-50" }) })
      ]
    }
  );
}
function SelectContent({
  className,
  children,
  position = "popper",
  align = "center",
  ...props
}) {
  return /* @__PURE__ */ jsx(SelectPrimitive.Portal, { children: /* @__PURE__ */ jsxs(
    SelectPrimitive.Content,
    {
      "data-slot": "select-content",
      className: cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      ),
      position,
      align,
      ...props,
      children: [
        /* @__PURE__ */ jsx(SelectScrollUpButton, {}),
        /* @__PURE__ */ jsx(
          SelectPrimitive.Viewport,
          {
            className: cn(
              "p-1",
              position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
            ),
            children
          }
        ),
        /* @__PURE__ */ jsx(SelectScrollDownButton, {})
      ]
    }
  ) });
}
function SelectItem({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxs(
    SelectPrimitive.Item,
    {
      "data-slot": "select-item",
      className: cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsx("span", { className: "absolute right-2 flex size-3.5 items-center justify-center", children: /* @__PURE__ */ jsx(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx(CheckIcon, { className: "size-4" }) }) }),
        /* @__PURE__ */ jsx(SelectPrimitive.ItemText, { children })
      ]
    }
  );
}
function SelectScrollUpButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SelectPrimitive.ScrollUpButton,
    {
      "data-slot": "select-scroll-up-button",
      className: cn(
        "flex cursor-default items-center justify-center py-1",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(ChevronUpIcon, { className: "size-4" })
    }
  );
}
function SelectScrollDownButton({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SelectPrimitive.ScrollDownButton,
    {
      "data-slot": "select-scroll-down-button",
      className: cn(
        "flex cursor-default items-center justify-center py-1",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsx(ChevronDownIcon, { className: "size-4" })
    }
  );
}

// src/ui/table.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function Table({ className, ...props }) {
  return /* @__PURE__ */ jsx2(
    "div",
    {
      "data-slot": "table-container",
      className: "relative w-full overflow-x-auto rounded-lg border",
      children: /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsx2(
    "thead",
    {
      "data-slot": "table-header",
      className: cn("bg-muted/50 [&_tr]:border-b", className),
      ...props
    }
  );
}
function TableBody({ className, ...props }) {
  return /* @__PURE__ */ jsx2(
    "tbody",
    {
      "data-slot": "table-body",
      className: cn("[&_tr:last-child]:border-0", className),
      ...props
    }
  );
}
function TableRow({ className, ...props }) {
  return /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsx2(
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
  return /* @__PURE__ */ jsx2(
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
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var TYPE_VALUES = [
  "bug",
  "ui",
  "performance",
  "new_feature",
  "extend_feature",
  "other"
];
var STATUS_VALUES = [
  "new",
  "triaged",
  "in_progress",
  "done",
  "wont_fix"
];
function statusVariant(s) {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}
function FeedbackTriagePage() {
  const isAdmin = useCanTriageFeedback();
  const adapter = useFeedbackAdapter();
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
    return /* @__PURE__ */ jsxs2("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx3("h1", { className: "text-2xl font-semibold", children: "Feedback" }),
      /* @__PURE__ */ jsxs2("p", { className: "text-muted-foreground", children: [
        "Your role is not authorised to triage feedback. Configure",
        /* @__PURE__ */ jsx3("code", { className: "mx-1", children: "VITE_FEEDBACK_TRIAGE_ROLES" }),
        "(or the host's ",
        /* @__PURE__ */ jsx3("code", { children: "bindings.triageRoles" }),
        ") to include your role."
      ] })
    ] });
  }
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx3("div", { className: "flex items-center justify-between gap-4", children: /* @__PURE__ */ jsxs2("div", { children: [
      /* @__PURE__ */ jsxs2("h1", { className: "flex items-center gap-3 text-2xl font-semibold", children: [
        /* @__PURE__ */ jsx3(Rl3Mark, { className: "h-7 w-7 shrink-0" }),
        /* @__PURE__ */ jsx3("span", { children: "RL3 Feedback \u2014 triage" })
      ] }),
      /* @__PURE__ */ jsxs2("p", { className: "text-sm text-muted-foreground", children: [
        list.data?.count ?? 0,
        " total \xB7 Filter by type, status, or title."
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap items-end gap-3 rounded-md border p-3", children: [
      /* @__PURE__ */ jsxs2("div", { className: "flex-1 min-w-48", children: [
        /* @__PURE__ */ jsx3("label", { className: "block text-xs text-muted-foreground mb-1", children: "Type" }),
        /* @__PURE__ */ jsxs2(
          Select,
          {
            value: typeFilter,
            onValueChange: (v) => setTypeFilter(v),
            children: [
              /* @__PURE__ */ jsx3(SelectTrigger, { children: /* @__PURE__ */ jsx3(SelectValue, {}) }),
              /* @__PURE__ */ jsxs2(SelectContent, { children: [
                /* @__PURE__ */ jsx3(SelectItem, { value: "all", children: "All" }),
                TYPE_VALUES.map((t) => /* @__PURE__ */ jsx3(SelectItem, { value: t, children: t }, t))
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "flex-1 min-w-48", children: [
        /* @__PURE__ */ jsx3("label", { className: "block text-xs text-muted-foreground mb-1", children: "Status" }),
        /* @__PURE__ */ jsxs2(
          Select,
          {
            value: statusFilter,
            onValueChange: (v) => setStatusFilter(v),
            children: [
              /* @__PURE__ */ jsx3(SelectTrigger, { children: /* @__PURE__ */ jsx3(SelectValue, {}) }),
              /* @__PURE__ */ jsxs2(SelectContent, { children: [
                /* @__PURE__ */ jsx3(SelectItem, { value: "all", children: "All" }),
                STATUS_VALUES.map((s) => /* @__PURE__ */ jsx3(SelectItem, { value: s, children: s }, s))
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "flex-1 min-w-48", children: [
        /* @__PURE__ */ jsx3("label", { className: "block text-xs text-muted-foreground mb-1", children: "Search title" }),
        /* @__PURE__ */ jsx3(
          Input,
          {
            value: q,
            onChange: (e) => setQ(e.target.value),
            placeholder: "\u2026"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "rounded-md border", children: /* @__PURE__ */ jsxs2(Table, { children: [
      /* @__PURE__ */ jsx3(TableHeader, { children: /* @__PURE__ */ jsxs2(TableRow, { children: [
        /* @__PURE__ */ jsx3(TableHead, { className: "w-32", children: "Ticket" }),
        /* @__PURE__ */ jsx3(TableHead, { className: "w-32", children: "Date" }),
        /* @__PURE__ */ jsx3(TableHead, { className: "w-32", children: "Type" }),
        /* @__PURE__ */ jsx3(TableHead, { className: "w-32", children: "Status" }),
        /* @__PURE__ */ jsx3(TableHead, { children: "Title" }),
        /* @__PURE__ */ jsx3(TableHead, { className: "w-48", children: "Route" })
      ] }) }),
      /* @__PURE__ */ jsx3(TableBody, { children: list.isLoading ? /* @__PURE__ */ jsx3(TableRow, { children: /* @__PURE__ */ jsx3(
        TableCell,
        {
          colSpan: 6,
          className: "text-center text-muted-foreground py-6",
          children: "Loading\u2026"
        }
      ) }) : rows.length === 0 ? /* @__PURE__ */ jsx3(TableRow, { children: /* @__PURE__ */ jsx3(
        TableCell,
        {
          colSpan: 6,
          className: "text-center text-muted-foreground py-6",
          children: "No matching feedback."
        }
      ) }) : rows.map((row) => /* @__PURE__ */ jsxs2(
        TableRow,
        {
          className: "cursor-pointer hover:bg-accent",
          onClick: () => setOpenId(row.id),
          children: [
            /* @__PURE__ */ jsx3(TableCell, { className: "font-mono text-xs", children: row.ticket_code || "\u2014" }),
            /* @__PURE__ */ jsx3(TableCell, { className: "text-xs text-muted-foreground", children: row.created_at?.slice(0, 16) ?? "" }),
            /* @__PURE__ */ jsx3(TableCell, { children: /* @__PURE__ */ jsx3(Badge, { variant: "outline", children: row.type }) }),
            /* @__PURE__ */ jsx3(TableCell, { children: /* @__PURE__ */ jsx3(Badge, { variant: statusVariant(row.status), children: row.status }) }),
            /* @__PURE__ */ jsx3(TableCell, { className: "font-medium", children: row.title }),
            /* @__PURE__ */ jsx3(TableCell, { className: "text-xs text-muted-foreground truncate max-w-48", children: row.route_name ?? "\u2014" })
          ]
        },
        row.id
      )) })
    ] }) }),
    /* @__PURE__ */ jsx3(
      Sheet,
      {
        open: !!openId,
        onOpenChange: (open) => {
          if (!open) setOpenId(null);
        },
        children: /* @__PURE__ */ jsxs2(
          SheetContent,
          {
            side: "right",
            className: "w-full sm:max-w-2xl overflow-y-auto",
            children: [
              /* @__PURE__ */ jsxs2(SheetHeader, { children: [
                /* @__PURE__ */ jsxs2(SheetTitle, { className: "flex items-center gap-2", children: [
                  detail.data?.ticket_code ? /* @__PURE__ */ jsx3("span", { className: "font-mono text-xs px-1.5 py-0.5 rounded bg-muted shrink-0", children: detail.data.ticket_code }) : null,
                  /* @__PURE__ */ jsx3("span", { className: "truncate", children: detail.data?.title ?? "" })
                ] }),
                /* @__PURE__ */ jsx3(SheetDescription, { children: detail.data ? /* @__PURE__ */ jsx3("span", { className: "text-xs space-y-0.5 block", children: /* @__PURE__ */ jsxs2("span", { children: [
                  detail.data.type,
                  " \xB7 ",
                  detail.data.created_at?.slice(0, 16),
                  " ",
                  "\xB7 ",
                  detail.data.url_captured
                ] }) }) : "Loading\u2026" })
              ] }),
              detail.data ? /* @__PURE__ */ jsx3(
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
  const screenshot = data.attachments?.find(
    (a) => a.kind === "screenshot"
  )?.presigned_url;
  const userAttachments = data.attachments?.filter(
    (a) => a.kind === "user_attachment"
  ) ?? [];
  return /* @__PURE__ */ jsxs2("div", { className: "px-4 mt-4 space-y-5", children: [
    /* @__PURE__ */ jsxs2("section", { children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-medium mb-1", children: "What's happening?" }),
      /* @__PURE__ */ jsx3("pre", { className: "whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border", children: data.description })
    ] }),
    data.expected_outcome ? /* @__PURE__ */ jsxs2("section", { children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-medium mb-1", children: "How should it work?" }),
      /* @__PURE__ */ jsx3("pre", { className: "whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border", children: data.expected_outcome })
    ] }) : null,
    screenshot ? /* @__PURE__ */ jsxs2("section", { children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-medium mb-1", children: "Screenshot" }),
      /* @__PURE__ */ jsx3("a", { href: screenshot, target: "_blank", rel: "noreferrer", children: /* @__PURE__ */ jsx3(
        "img",
        {
          src: screenshot,
          alt: "Screenshot",
          className: "w-full rounded-md border",
          loading: "lazy"
        }
      ) })
    ] }) : null,
    userAttachments.length > 0 ? /* @__PURE__ */ jsxs2("section", { children: [
      /* @__PURE__ */ jsxs2("h3", { className: "text-sm font-medium mb-1", children: [
        "Attachments (",
        userAttachments.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx3("ul", { className: "space-y-1.5", children: userAttachments.map((a) => /* @__PURE__ */ jsxs2(
        "li",
        {
          className: "flex items-center justify-between gap-2 rounded-md border p-2 text-xs",
          children: [
            /* @__PURE__ */ jsx3("span", { className: "truncate font-mono", children: a.filename ?? a.object_key }),
            /* @__PURE__ */ jsxs2("span", { className: "text-muted-foreground shrink-0", children: [
              (a.byte_size / 1024).toFixed(1),
              " KB \xB7 ",
              a.content_type
            ] }),
            a.presigned_url ? /* @__PURE__ */ jsx3(
              "a",
              {
                href: a.presigned_url,
                target: "_blank",
                rel: "noreferrer",
                className: "shrink-0 text-primary hover:underline",
                children: "Open"
              }
            ) : null
          ]
        },
        a.id
      )) })
    ] }) : null,
    /* @__PURE__ */ jsxs2("details", { className: "text-xs", children: [
      /* @__PURE__ */ jsx3("summary", { className: "cursor-pointer font-medium text-foreground", children: "Technical metadata (redacted)" }),
      /* @__PURE__ */ jsx3("pre", { className: "whitespace-pre-wrap rounded-md bg-muted/50 p-3 border mt-2 max-h-96 overflow-auto", children: JSON.stringify(data.metadata_bundle, null, 2) })
    ] }),
    /* @__PURE__ */ jsxs2("section", { className: "rounded-md border p-3 space-y-3", children: [
      /* @__PURE__ */ jsx3("h3", { className: "text-sm font-medium", children: "Triage" }),
      /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx3("span", { className: "text-xs text-muted-foreground w-28", children: "Status" }),
        /* @__PURE__ */ jsxs2(
          Select,
          {
            value: status,
            onValueChange: (v) => setStatus(v),
            children: [
              /* @__PURE__ */ jsx3(SelectTrigger, { className: "flex-1", children: /* @__PURE__ */ jsx3(SelectValue, {}) }),
              /* @__PURE__ */ jsx3(SelectContent, { children: STATUS_VALUES.map((s) => /* @__PURE__ */ jsx3(SelectItem, { value: s, children: s }, s)) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs2("div", { children: [
        /* @__PURE__ */ jsx3("span", { className: "block text-xs text-muted-foreground mb-1", children: "Triage note" }),
        /* @__PURE__ */ jsx3(
          Textarea,
          {
            rows: 3,
            value: note,
            onChange: (e) => setNote(e.target.value),
            placeholder: "Why this status, what was done\u2026"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        /* @__PURE__ */ jsx3(
          Button,
          {
            type: "button",
            onClick: () => onChangeStatus(status, note || void 0),
            disabled: busy,
            children: "Save status"
          }
        ),
        /* @__PURE__ */ jsxs2(
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
              /* @__PURE__ */ jsx3(Download, { className: "mr-1 h-3.5 w-3.5" }),
              "Download .zip"
            ]
          }
        ),
        /* @__PURE__ */ jsx3(
          Button,
          {
            type: "button",
            variant: "destructive",
            onClick: () => {
              if (window.confirm(
                "Delete this feedback? This removes the row + attachments."
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
import { lazy, Suspense, useCallback, useState as useState3 } from "react";

// src/ElementSelector.tsx
import { useEffect, useRef, useState as useState2 } from "react";
import { Fragment, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs3(
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
        /* @__PURE__ */ jsx4(
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
        rect ? /* @__PURE__ */ jsxs3(Fragment, { children: [
          /* @__PURE__ */ jsx4(
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
          /* @__PURE__ */ jsx4(
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
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var FeedbackPanelLazy = lazy(() => import("./FeedbackPanel-VKO4Q3VG.js"));
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
  const pendingCount = useMyPendingActionCount();
  if (!config.enabled) return null;
  const cornerClass = POSITION_CLASSES[config.position] ?? POSITION_CLASSES.bottom_right;
  const accentStyle = config.brandPrimaryHex ? { "--feedback-brand": config.brandPrimaryHex } : void 0;
  return /* @__PURE__ */ jsxs4("div", { "data-feedback-widget-root": "true", children: [
    /* @__PURE__ */ jsxs4(
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
          /* @__PURE__ */ jsxs4("span", { className: "relative", children: [
            /* @__PURE__ */ jsx5(Rl3Mark, { className: "h-7 w-7 shrink-0" }),
            pendingCount > 0 ? /* @__PURE__ */ jsx5(
              "span",
              {
                "aria-hidden": "true",
                className: "absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background",
                children: pendingCount > 9 ? "9+" : pendingCount
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsx5("span", { className: "text-sm font-semibold", children: t("feedback.button_label") })
        ]
      }
    ),
    open || pickerActive ? /* @__PURE__ */ jsx5(Suspense, { fallback: null, children: /* @__PURE__ */ jsx5(
      FeedbackPanelLazy,
      {
        open: open && !pickerActive,
        onOpenChange: setOpen,
        locked,
        onActivatePicker: handleActivatePicker,
        onClearLocked: handleClearLocked,
        onScreenshotCaptured: (_) => {
        }
      }
    ) }) : null,
    pickerActive ? /* @__PURE__ */ jsx5(
      ElementSelector,
      {
        onLock: handlePickerLock,
        onCancel: handlePickerCancel
      }
    ) : null
  ] });
}
var FeedbackButton_default = FeedbackButton;
export {
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