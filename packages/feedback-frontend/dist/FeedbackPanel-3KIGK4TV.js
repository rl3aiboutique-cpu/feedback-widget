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
  useFeedbackAdapter,
  usePersonasQuery,
  useUserStoriesQuery
} from "./chunk-2ALMQ6BZ.js";

// src/FeedbackPanel.tsx
import { useEffect as useEffect2, useMemo as useMemo2, useState as useState3 } from "react";

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

// src/forms/FeedbackForm.tsx
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState as useState2 } from "react";

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

// src/forms/LinkedUserStoriesField.tsx
import { ChevronDown, Trash2 } from "lucide-react";

// src/ui/dropdown-menu.tsx
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function DropdownMenu({
  ...props
}) {
  return /* @__PURE__ */ jsx2(DropdownMenuPrimitive.Root, { "data-slot": "dropdown-menu", ...props });
}
function DropdownMenuTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    DropdownMenuPrimitive.Trigger,
    {
      "data-slot": "dropdown-menu-trigger",
      ...props
    }
  );
}
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}) {
  return /* @__PURE__ */ jsx2(DropdownMenuPrimitive.Portal, { children: /* @__PURE__ */ jsx2(
    DropdownMenuPrimitive.Content,
    {
      "data-slot": "dropdown-menu-content",
      sideOffset,
      className: cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      ),
      ...props
    }
  ) });
}
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    DropdownMenuPrimitive.Item,
    {
      "data-slot": "dropdown-menu-item",
      "data-inset": inset,
      "data-variant": variant,
      className: cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuLabel({
  className,
  inset,
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    DropdownMenuPrimitive.Label,
    {
      "data-slot": "dropdown-menu-label",
      "data-inset": inset,
      className: cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuSeparator({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    DropdownMenuPrimitive.Separator,
    {
      "data-slot": "dropdown-menu-separator",
      className: cn("bg-border -mx-1 my-1 h-px", className),
      ...props
    }
  );
}

// src/forms/LinkedUserStoriesField.tsx
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var PRIORITY_KEYS = [
  { value: "must", labelKey: "feedback.priority.must" },
  { value: "should", labelKey: "feedback.priority.should" },
  { value: "could", labelKey: "feedback.priority.could" },
  { value: "wont", labelKey: "feedback.priority.wont" }
];
function LinkedUserStoriesField({
  value,
  onChange
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const stories = useUserStoriesQuery(100);
  const updateRow = (idx, patch) => {
    const next = value.map((row, i) => i === idx ? { ...row, ...patch } : row);
    onChange(next);
  };
  const removeRow = (idx) => {
    onChange(value.filter((_, i) => i !== idx));
  };
  const addRow = () => {
    onChange([
      ...value,
      { story: "", acceptance_criteria: "", priority: "must" }
    ]);
  };
  const fillFromExisting = (idx, picked) => {
    onChange(
      value.map(
        (row, i) => i === idx ? {
          story: picked.story,
          acceptance_criteria: picked.acceptance_criteria ?? "",
          priority: picked.priority ?? "must"
        } : row
      )
    );
  };
  const items = stories.data ?? [];
  const appendFromExisting = (picked) => {
    onChange([
      ...value,
      {
        story: picked.story,
        acceptance_criteria: picked.acceptance_criteria ?? "",
        priority: picked.priority ?? "must"
      }
    ]);
  };
  return /* @__PURE__ */ jsxs2("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxs2("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx3(Label, { title: t("feedback.stories.hint"), children: t("feedback.stories.label") }),
      items.length > 0 ? /* @__PURE__ */ jsxs2(DropdownMenu, { children: [
        /* @__PURE__ */ jsx3(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs2(
          Button,
          {
            type: "button",
            variant: "ghost",
            size: "sm",
            className: "h-7 px-2 text-xs",
            "data-feedback-id": "feedback.stories.pick_existing_field",
            children: [
              /* @__PURE__ */ jsx3(ChevronDown, { className: "mr-1 h-3 w-3" }),
              t("feedback.stories.pick_existing")
            ]
          }
        ) }),
        /* @__PURE__ */ jsxs2(DropdownMenuContent, { align: "end", className: "w-[420px] max-w-[90vw]", children: [
          /* @__PURE__ */ jsx3(DropdownMenuLabel, { children: t("feedback.stories.pick_existing_help") }),
          /* @__PURE__ */ jsx3(DropdownMenuSeparator, {}),
          /* @__PURE__ */ jsx3("div", { className: "max-h-72 overflow-y-auto", children: items.map((s, sidx) => /* @__PURE__ */ jsxs2(
            DropdownMenuItem,
            {
              onSelect: () => appendFromExisting(s),
              className: "flex flex-col items-start gap-0.5 py-2",
              children: [
                /* @__PURE__ */ jsx3("span", { className: "text-sm font-medium line-clamp-1", children: s.story }),
                s.priority ? /* @__PURE__ */ jsxs2("span", { className: "text-[10px] text-muted-foreground", children: [
                  "[",
                  s.priority,
                  "]"
                ] }) : null
              ]
            },
            `${sidx}-${s.story.slice(0, 12)}`
          )) })
        ] })
      ] }) : null
    ] }),
    value.length === 0 ? /* @__PURE__ */ jsx3("p", { className: "text-xs text-muted-foreground italic", children: t("feedback.stories.hint") }) : null,
    value.map((row, idx) => /* @__PURE__ */ jsxs2(
      "div",
      {
        className: "rounded-md border border-input p-3 space-y-2 relative",
        children: [
          /* @__PURE__ */ jsxs2("div", { className: "flex items-start justify-between gap-2", children: [
            /* @__PURE__ */ jsx3(
              Input,
              {
                value: row.story,
                onChange: (e) => updateRow(idx, { story: e.target.value }),
                placeholder: t("feedback.stories.story_placeholder"),
                "data-feedback-id": "feedback.stories.story"
              }
            ),
            items.length > 0 ? /* @__PURE__ */ jsxs2(DropdownMenu, { children: [
              /* @__PURE__ */ jsx3(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs2(
                Button,
                {
                  type: "button",
                  variant: "ghost",
                  size: "sm",
                  className: "h-9 px-2 text-xs shrink-0",
                  "data-feedback-id": "feedback.stories.pick_existing",
                  children: [
                    /* @__PURE__ */ jsx3(ChevronDown, { className: "mr-1 h-3 w-3" }),
                    t("feedback.stories.pick_existing")
                  ]
                }
              ) }),
              /* @__PURE__ */ jsxs2(
                DropdownMenuContent,
                {
                  align: "end",
                  className: "w-[420px] max-w-[90vw]",
                  children: [
                    /* @__PURE__ */ jsx3(DropdownMenuLabel, { children: t("feedback.stories.pick_existing_help") }),
                    /* @__PURE__ */ jsx3(DropdownMenuSeparator, {}),
                    /* @__PURE__ */ jsx3("div", { className: "max-h-72 overflow-y-auto", children: items.map((s, sidx) => /* @__PURE__ */ jsxs2(
                      DropdownMenuItem,
                      {
                        onSelect: () => fillFromExisting(idx, s),
                        className: "flex flex-col items-start gap-0.5 py-2",
                        children: [
                          /* @__PURE__ */ jsx3("span", { className: "text-sm font-medium line-clamp-1", children: s.story }),
                          s.priority ? /* @__PURE__ */ jsxs2("span", { className: "text-[10px] text-muted-foreground", children: [
                            "[",
                            s.priority,
                            "]"
                          ] }) : null
                        ]
                      },
                      `${sidx}-${s.story.slice(0, 12)}`
                    )) })
                  ]
                }
              )
            ] }) : null,
            /* @__PURE__ */ jsx3(
              Button,
              {
                type: "button",
                variant: "ghost",
                size: "icon",
                onClick: () => removeRow(idx),
                "aria-label": t("feedback.stories.remove"),
                "data-feedback-id": "feedback.stories.remove",
                children: /* @__PURE__ */ jsx3(Trash2, { className: "h-4 w-4" })
              }
            )
          ] }),
          /* @__PURE__ */ jsx3(
            Textarea,
            {
              value: row.acceptance_criteria ?? "",
              onChange: (e) => updateRow(idx, { acceptance_criteria: e.target.value }),
              placeholder: t("feedback.stories.acceptance_placeholder"),
              rows: 2,
              "data-feedback-id": "feedback.stories.acceptance"
            }
          ),
          /* @__PURE__ */ jsxs2("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx3("span", { className: "text-xs text-muted-foreground", children: t("feedback.field.priority") }),
            /* @__PURE__ */ jsxs2(
              Select,
              {
                value: row.priority ?? "must",
                onValueChange: (v) => updateRow(idx, { priority: v }),
                children: [
                  /* @__PURE__ */ jsx3(
                    SelectTrigger,
                    {
                      className: "h-8 w-32",
                      "data-feedback-id": "feedback.stories.priority",
                      children: /* @__PURE__ */ jsx3(SelectValue, {})
                    }
                  ),
                  /* @__PURE__ */ jsx3(SelectContent, { children: PRIORITY_KEYS.map((opt) => /* @__PURE__ */ jsx3(SelectItem, { value: opt.value, children: t(opt.labelKey) }, opt.value)) })
                ]
              }
            )
          ] })
        ]
      },
      idx
    )),
    /* @__PURE__ */ jsxs2(
      Button,
      {
        type: "button",
        variant: "outline",
        size: "sm",
        onClick: addRow,
        "data-feedback-id": "feedback.stories.add",
        children: [
          "+ ",
          t("feedback.stories.add")
        ]
      }
    )
  ] });
}

// src/forms/PersonaField.tsx
import { ChevronDown as ChevronDown2, Pencil } from "lucide-react";
import { useState } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var FIRST_LINE_MAX = 80;
function _firstLine(s) {
  const trimmed = s.trim();
  const nl = trimmed.indexOf("\n");
  const cut = nl === -1 ? trimmed : trimmed.slice(0, nl);
  return cut.length > FIRST_LINE_MAX ? `${cut.slice(0, FIRST_LINE_MAX)}\u2026` : cut;
}
function PersonaField({
  value,
  onChange
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const personas = usePersonasQuery(50);
  const items = personas.data ?? [];
  return /* @__PURE__ */ jsxs3("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx4(Label, { htmlFor: "feedback-persona", title: t("feedback.persona.hint"), children: t("feedback.persona.label") }),
      /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2", children: [
        items.length > 0 ? /* @__PURE__ */ jsxs3(DropdownMenu, { open: isOpen, onOpenChange: setIsOpen, children: [
          /* @__PURE__ */ jsx4(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs3(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "sm",
              className: "h-7 px-2 text-xs",
              "data-feedback-id": "feedback.persona.pick_existing",
              children: [
                /* @__PURE__ */ jsx4(ChevronDown2, { className: "mr-1 h-3 w-3" }),
                t("feedback.persona.pick_existing")
              ]
            }
          ) }),
          /* @__PURE__ */ jsxs3(
            DropdownMenuContent,
            {
              align: "end",
              className: "w-[420px] max-w-[90vw]",
              children: [
                /* @__PURE__ */ jsx4(DropdownMenuLabel, { children: t("feedback.persona.pick_existing_help") }),
                /* @__PURE__ */ jsx4(DropdownMenuSeparator, {}),
                /* @__PURE__ */ jsx4("div", { className: "max-h-72 overflow-y-auto", children: items.map((persona, idx) => /* @__PURE__ */ jsxs3(
                  DropdownMenuItem,
                  {
                    onSelect: () => {
                      onChange(persona);
                      setIsOpen(false);
                    },
                    className: "flex flex-col items-start gap-0.5 py-2",
                    children: [
                      /* @__PURE__ */ jsx4("span", { className: "text-sm font-medium", children: _firstLine(persona) }),
                      /* @__PURE__ */ jsx4("span", { className: "text-[10px] text-muted-foreground line-clamp-2", children: persona.slice(0, 200) })
                    ]
                  },
                  `${idx}-${persona.slice(0, 12)}`
                )) })
              ]
            }
          )
        ] }) : null,
        /* @__PURE__ */ jsxs3(
          "button",
          {
            type: "button",
            onClick: () => onChange(t("feedback.persona.example")),
            "data-feedback-id": "feedback.persona.insert_example",
            className: "inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline",
            children: [
              /* @__PURE__ */ jsx4(Pencil, { className: "h-3 w-3" }),
              t("feedback.persona.insert_example")
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx4(
      Textarea,
      {
        id: "feedback-persona",
        value,
        onChange: (e) => onChange(e.target.value),
        placeholder: t("feedback.persona.placeholder"),
        rows: 7,
        "data-feedback-id": "feedback.persona"
      }
    )
  ] });
}

// src/forms/types.ts
var SEVERITY_OPTIONS = [
  { value: "blocker", labelKey: "feedback.severity.blocker" },
  { value: "high", labelKey: "feedback.severity.high" },
  { value: "medium", labelKey: "feedback.severity.medium" },
  { value: "low", labelKey: "feedback.severity.low" }
];
var PRIORITY_OPTIONS = [
  { value: "must", labelKey: "feedback.priority.must" },
  { value: "should", labelKey: "feedback.priority.should" },
  { value: "could", labelKey: "feedback.priority.could" },
  { value: "wont", labelKey: "feedback.priority.wont" }
];
var WHEN_OPTIONS = [
  { value: "on_load", labelKey: "feedback.when.on_load" },
  { value: "on_action", labelKey: "feedback.when.on_action" },
  { value: "intermittent", labelKey: "feedback.when.intermittent" },
  { value: "always", labelKey: "feedback.when.always" }
];
var TYPE_DEFS = [
  {
    key: "bug",
    labelKey: "feedback.type.bug",
    hintKey: "feedback.type.bug_hint",
    // Spec §"Type 1: Bug" — user_persona: textarea (required).
    // The persona is required even for bugs because the team needs to
    // know which actor's job is broken, not just what the symptom is.
    // Linked user stories are zero-or-more allowed for Bug.
    requiresPersona: true,
    requiresLinkedStories: false,
    fields: [
      {
        name: "severity",
        labelKey: "feedback.field.severity",
        hintKey: "feedback.field.severity_hint",
        kind: "select",
        options: SEVERITY_OPTIONS
      },
      {
        name: "reproduction_steps",
        labelKey: "feedback.field.reproduction_steps",
        hintKey: "feedback.field.reproduction_steps_hint",
        placeholderKey: "feedback.field.reproduction_steps_placeholder",
        kind: "textarea",
        rows: 5
      },
      {
        name: "expected_behavior",
        labelKey: "feedback.field.expected_behavior",
        kind: "textarea",
        rows: 2
      },
      {
        name: "actual_behavior",
        labelKey: "feedback.field.actual_behavior",
        kind: "textarea",
        rows: 2
      }
    ]
  },
  {
    key: "new_feature",
    labelKey: "feedback.type.new_feature",
    hintKey: "feedback.type.new_feature_hint",
    requiresPersona: true,
    requiresLinkedStories: true,
    fields: [
      {
        name: "problem_statement",
        labelKey: "feedback.field.problem_statement",
        placeholderKey: "feedback.field.problem_statement_placeholder",
        kind: "textarea",
        rows: 3
      },
      {
        name: "proposed_solution",
        labelKey: "feedback.field.proposed_solution",
        kind: "textarea",
        rows: 3
      },
      {
        name: "business_value",
        labelKey: "feedback.field.business_value",
        placeholderKey: "feedback.field.business_value_placeholder",
        kind: "textarea",
        rows: 2
      }
    ]
  },
  {
    key: "extend_feature",
    labelKey: "feedback.type.extend_feature",
    hintKey: "feedback.type.extend_feature_hint",
    requiresPersona: true,
    requiresLinkedStories: true,
    fields: [
      {
        name: "existing_feature",
        labelKey: "feedback.field.existing_feature",
        kind: "text"
      },
      {
        name: "gap_today",
        labelKey: "feedback.field.gap_today",
        kind: "textarea",
        rows: 3
      },
      {
        name: "proposed_extension",
        labelKey: "feedback.field.proposed_extension",
        kind: "textarea",
        rows: 3
      },
      {
        name: "business_value",
        labelKey: "feedback.field.business_value",
        kind: "textarea",
        rows: 2
      }
    ]
  },
  {
    key: "new_user_story",
    labelKey: "feedback.type.new_user_story",
    hintKey: "feedback.type.new_user_story_hint",
    requiresPersona: true,
    requiresLinkedStories: true,
    fields: [
      {
        name: "user_story",
        labelKey: "feedback.field.user_story",
        placeholderKey: "feedback.field.user_story_placeholder",
        kind: "textarea",
        rows: 2
      },
      {
        name: "acceptance_criteria",
        labelKey: "feedback.field.acceptance_criteria",
        placeholderKey: "feedback.field.acceptance_criteria_placeholder",
        kind: "textarea",
        rows: 4
      },
      {
        name: "priority",
        labelKey: "feedback.field.priority",
        kind: "select",
        options: PRIORITY_OPTIONS
      }
    ]
  },
  {
    key: "question",
    labelKey: "feedback.type.question",
    hintKey: "feedback.type.question_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "what_were_you_trying_to_do",
        labelKey: "feedback.field.what_were_you_trying_to_do",
        kind: "textarea",
        rows: 2
      },
      {
        name: "what_was_unclear",
        labelKey: "feedback.field.what_was_unclear",
        kind: "textarea",
        rows: 2
      },
      {
        name: "where_did_you_look_first",
        labelKey: "feedback.field.where_did_you_look_first",
        kind: "textarea",
        rows: 2
      }
    ]
  },
  {
    key: "ux_polish",
    labelKey: "feedback.type.ux_polish",
    hintKey: "feedback.type.ux_polish_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "what_feels_off",
        labelKey: "feedback.field.what_feels_off",
        kind: "textarea",
        rows: 3
      },
      {
        name: "suggested_change",
        labelKey: "feedback.field.suggested_change",
        kind: "textarea",
        rows: 3
      }
    ]
  },
  {
    key: "performance",
    labelKey: "feedback.type.performance",
    hintKey: "feedback.type.performance_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "what_was_slow",
        labelKey: "feedback.field.what_was_slow",
        kind: "textarea",
        rows: 2
      },
      {
        name: "when_did_it_happen",
        labelKey: "feedback.field.when_did_it_happen",
        kind: "select",
        options: WHEN_OPTIONS
      },
      {
        name: "perceived_duration_seconds",
        labelKey: "feedback.field.perceived_duration_seconds",
        kind: "number"
      }
    ]
  },
  {
    key: "data_issue",
    labelKey: "feedback.type.data_issue",
    hintKey: "feedback.type.data_issue_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "which_record",
        labelKey: "feedback.field.which_record",
        kind: "text"
      },
      {
        name: "expected_data",
        labelKey: "feedback.field.expected_data",
        kind: "textarea",
        rows: 2
      },
      {
        name: "actual_data",
        labelKey: "feedback.field.actual_data",
        kind: "textarea",
        rows: 2
      },
      {
        name: "impact",
        labelKey: "feedback.field.impact",
        kind: "textarea",
        rows: 2
      }
    ]
  }
];
function getTypeDef(key) {
  const found = TYPE_DEFS.find((d) => d.key === key);
  if (!found) {
    throw new Error(`Unknown feedback type: ${key}`);
  }
  return found;
}

// src/forms/FeedbackForm.tsx
import { Fragment, jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var EMPTY_FORM = {
  type: null,
  title: "",
  description: "",
  type_fields: {},
  persona: "",
  linked_user_stories: [],
  consent_metadata_capture: true,
  follow_up_email: "",
  parent_ticket_code: ""
};
var _RequiredMark = () => /* @__PURE__ */ jsx5("span", { "aria-hidden": "true", className: "ml-0.5 text-destructive", children: "*" });
function FeedbackForm({
  values,
  onChange,
  errors = {}
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const activeDef = useMemo(
    () => values.type ? getTypeDef(values.type) : null,
    [values.type]
  );
  const [previousType, setPreviousType] = useState2(
    values.type
  );
  useEffect(() => {
    if (previousType !== values.type) {
      const hadData = Object.values(values.type_fields).some(
        (v) => v !== "" && v !== null && v !== void 0
      );
      if (previousType !== null && hadData) {
        adapter.toast.warning(t("feedback.toast_type_change_warning"));
      }
      setPreviousType(values.type);
    }
  }, [values.type, previousType, t, values.type_fields, adapter]);
  const setField = (key, val) => {
    onChange({ ...values, [key]: val });
  };
  const setTypeFieldValue = (name, val) => {
    onChange({
      ...values,
      type_fields: { ...values.type_fields, [name]: val }
    });
  };
  const handleTypeChange = (next) => {
    if (next === values.type) return;
    onChange({
      ...values,
      type: next,
      // Clear type_fields on switch so we don't smuggle stale fields
      // into the next type's payload.
      type_fields: {}
    });
  };
  return /* @__PURE__ */ jsxs4("div", { className: "space-y-5", children: [
    /* @__PURE__ */ jsxs4("div", { children: [
      /* @__PURE__ */ jsx5(Label, { className: "text-xs uppercase tracking-wide text-muted-foreground", children: t("feedback.type_label") }),
      /* @__PURE__ */ jsx5("div", { className: "mt-2 grid grid-cols-2 gap-2", children: TYPE_DEFS.map((def) => {
        const active = values.type === def.key;
        return /* @__PURE__ */ jsxs4(
          "button",
          {
            type: "button",
            title: t(def.hintKey),
            onClick: () => handleTypeChange(def.key),
            "data-feedback-id": `feedback.type.${def.key}`,
            className: `flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors
                  ${active ? "border-primary bg-primary/10 text-foreground" : "border-input hover:bg-accent hover:text-accent-foreground"}`,
            children: [
              /* @__PURE__ */ jsx5("span", { children: t(def.labelKey) }),
              /* @__PURE__ */ jsx5(ChevronRight, { className: "h-3 w-3 opacity-50" })
            ]
          },
          def.key
        );
      }) })
    ] }),
    activeDef ? /* @__PURE__ */ jsxs4(Fragment, { children: [
      /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs4(
          Label,
          {
            htmlFor: "feedback-title",
            title: t("feedback.field.title_hint"),
            children: [
              t("feedback.field.title"),
              /* @__PURE__ */ jsx5(_RequiredMark, {})
            ]
          }
        ),
        /* @__PURE__ */ jsx5(
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
        errors.title ? /* @__PURE__ */ jsx5("p", { className: "text-xs text-destructive", children: errors.title }) : null
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxs4(
          Label,
          {
            htmlFor: "feedback-description",
            title: t("feedback.field.description_hint"),
            children: [
              t("feedback.field.description"),
              /* @__PURE__ */ jsx5(_RequiredMark, {})
            ]
          }
        ),
        /* @__PURE__ */ jsx5(
          Textarea,
          {
            id: "feedback-description",
            value: values.description,
            onChange: (e) => setField("description", e.target.value),
            placeholder: t("feedback.field.description_placeholder"),
            rows: 4,
            "data-feedback-id": "feedback.field.description",
            "aria-invalid": !!errors.description,
            "aria-required": "true",
            className: errors.description ? "border-destructive ring-1 ring-destructive" : ""
          }
        ),
        errors.description ? /* @__PURE__ */ jsx5("p", { className: "text-xs text-destructive", children: errors.description }) : null
      ] }),
      activeDef.fields.map((field) => {
        const fieldId = `feedback-tf-${field.name}`;
        const value = values.type_fields[field.name] ?? "";
        const isRequired = field.required !== false;
        const fieldError = errors[field.name];
        const errorClass = fieldError ? "border-destructive ring-1 ring-destructive" : "";
        return /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxs4(
            Label,
            {
              htmlFor: fieldId,
              title: field.hintKey ? t(field.hintKey) : void 0,
              children: [
                t(field.labelKey),
                isRequired ? /* @__PURE__ */ jsx5(_RequiredMark, {}) : null
              ]
            }
          ),
          field.kind === "textarea" ? /* @__PURE__ */ jsx5(
            Textarea,
            {
              id: fieldId,
              value: String(value),
              onChange: (e) => setTypeFieldValue(field.name, e.target.value),
              placeholder: field.placeholderKey ? t(field.placeholderKey) : void 0,
              rows: field.rows ?? 3,
              "data-feedback-id": `feedback.field.${field.name}`,
              "aria-invalid": !!fieldError,
              "aria-required": isRequired,
              className: errorClass
            }
          ) : field.kind === "number" ? /* @__PURE__ */ jsx5(
            Input,
            {
              id: fieldId,
              type: "number",
              inputMode: "numeric",
              value: String(value),
              onChange: (e) => setTypeFieldValue(
                field.name,
                e.target.value === "" ? "" : Number(e.target.value)
              ),
              placeholder: field.placeholderKey ? t(field.placeholderKey) : void 0,
              "data-feedback-id": `feedback.field.${field.name}`,
              "aria-invalid": !!fieldError,
              "aria-required": isRequired,
              className: errorClass
            }
          ) : field.kind === "select" ? /* @__PURE__ */ jsxs4(
            Select,
            {
              value: String(value || ""),
              onValueChange: (v) => setTypeFieldValue(field.name, v),
              children: [
                /* @__PURE__ */ jsx5(
                  SelectTrigger,
                  {
                    id: fieldId,
                    "data-feedback-id": `feedback.field.${field.name}`,
                    "aria-invalid": !!fieldError,
                    "aria-required": isRequired,
                    className: errorClass,
                    children: /* @__PURE__ */ jsx5(SelectValue, {})
                  }
                ),
                /* @__PURE__ */ jsx5(SelectContent, { children: (field.options ?? []).map((opt) => /* @__PURE__ */ jsx5(SelectItem, { value: opt.value, children: t(opt.labelKey) }, opt.value)) })
              ]
            }
          ) : /* @__PURE__ */ jsx5(
            Input,
            {
              id: fieldId,
              value: String(value),
              onChange: (e) => setTypeFieldValue(field.name, e.target.value),
              placeholder: field.placeholderKey ? t(field.placeholderKey) : void 0,
              "data-feedback-id": `feedback.field.${field.name}`,
              "aria-invalid": !!fieldError,
              "aria-required": isRequired,
              className: errorClass
            }
          ),
          fieldError ? /* @__PURE__ */ jsx5("p", { className: "text-xs text-destructive", children: fieldError }) : null
        ] }, field.name);
      }),
      activeDef.requiresPersona ? /* @__PURE__ */ jsxs4("div", { className: errors.persona ? "rounded-md ring-1 ring-destructive p-1 -m-1" : "", children: [
        /* @__PURE__ */ jsx5(
          PersonaField,
          {
            value: values.persona,
            onChange: (v) => setField("persona", v)
          }
        ),
        errors.persona ? /* @__PURE__ */ jsx5("p", { className: "text-xs text-destructive mt-1 px-1", children: errors.persona }) : null,
        /* @__PURE__ */ jsx5(
          LinkedUserStoriesField,
          {
            value: values.linked_user_stories,
            onChange: (v) => setField("linked_user_stories", v)
          }
        ),
        errors.linked_user_stories ? /* @__PURE__ */ jsx5("p", { className: "text-xs text-destructive mt-1 px-1", children: errors.linked_user_stories }) : null
      ] }) : null,
      /* @__PURE__ */ jsxs4("div", { className: "rounded-md border border-input p-3 space-y-3 bg-muted/40", children: [
        /* @__PURE__ */ jsx5("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: t("feedback.ticketing.section_label") }),
        /* @__PURE__ */ jsxs4("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx5(
            Label,
            {
              htmlFor: "feedback-follow-up-email",
              title: t("feedback.field.follow_up_email_hint"),
              children: t("feedback.field.follow_up_email")
            }
          ),
          /* @__PURE__ */ jsx5(
            Input,
            {
              id: "feedback-follow-up-email",
              type: "email",
              value: values.follow_up_email,
              onChange: (e) => setField("follow_up_email", e.target.value),
              placeholder: t("feedback.field.follow_up_email_placeholder"),
              "data-feedback-id": "feedback.field.follow_up_email",
              maxLength: 320
            }
          ),
          /* @__PURE__ */ jsx5("p", { className: "text-[11px] text-muted-foreground", children: t("feedback.field.follow_up_email_help") })
        ] }),
        /* @__PURE__ */ jsxs4("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsx5(
            Label,
            {
              htmlFor: "feedback-parent-ticket",
              title: t("feedback.field.parent_ticket_hint"),
              children: t("feedback.field.parent_ticket")
            }
          ),
          /* @__PURE__ */ jsx5(
            Input,
            {
              id: "feedback-parent-ticket",
              value: values.parent_ticket_code,
              onChange: (e) => setField("parent_ticket_code", e.target.value.toUpperCase()),
              placeholder: t("feedback.field.parent_ticket_placeholder"),
              "data-feedback-id": "feedback.field.parent_ticket",
              maxLength: 24,
              pattern: "^FB-\\d{4}-\\d{4}$",
              className: "font-mono"
            }
          ),
          values.parent_ticket_code ? /* @__PURE__ */ jsx5("p", { className: "text-[11px] text-primary", children: t("feedback.field.parent_ticket_link", {
            code: values.parent_ticket_code
          }) }) : /* @__PURE__ */ jsx5("p", { className: "text-[11px] text-muted-foreground", children: t("feedback.field.parent_ticket_help") })
        ] })
      ] }),
      /* @__PURE__ */ jsxs4(
        "label",
        {
          className: `flex items-start gap-2 text-xs cursor-pointer ${errors.consent_metadata_capture ? "text-destructive" : "text-muted-foreground"}`,
          children: [
            /* @__PURE__ */ jsx5(
              "input",
              {
                type: "checkbox",
                checked: values.consent_metadata_capture,
                onChange: (e) => setField("consent_metadata_capture", e.target.checked),
                className: `mt-0.5 ${errors.consent_metadata_capture ? "ring-1 ring-destructive" : ""}`,
                "data-feedback-id": "feedback.field.consent_metadata",
                "aria-invalid": !!errors.consent_metadata_capture,
                "aria-required": "true"
              }
            ),
            /* @__PURE__ */ jsxs4("span", { children: [
              t("feedback.field.consent_metadata"),
              /* @__PURE__ */ jsx5(_RequiredMark, {})
            ] })
          ]
        }
      )
    ] }) : null
  ] });
}

// src/FeedbackPanel.tsx
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function FeedbackPanel({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
  initialParentTicket
}) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const user = adapter.useCurrentUser();
  const [values, setValues] = useState3(() => ({
    ...EMPTY_FORM,
    follow_up_email: user?.email ?? "",
    parent_ticket_code: initialParentTicket ?? ""
  }));
  const [mode, setMode] = useState3(locked ? "element" : "page");
  const [submitting, setSubmitting] = useState3(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState3(open);
  const [tab, setTab] = useState3("submit");
  useEffect2(() => {
    if (open) setHasOpenedOnce(true);
  }, [open]);
  useEffect2(() => {
    if (!open && hasOpenedOnce && !locked) {
      const id = setTimeout(() => {
        setValues({ ...EMPTY_FORM, follow_up_email: user?.email ?? "" });
        setMode("page");
        setSubmitting(false);
      }, 200);
      return () => clearTimeout(id);
    }
    return void 0;
  }, [open, hasOpenedOnce, locked, user?.email]);
  useEffect2(() => {
    if (locked) setMode("element");
  }, [locked]);
  useEffect2(() => {
    if (user?.email && !values.follow_up_email) {
      setValues((cur) => ({ ...cur, follow_up_email: user.email ?? "" }));
    }
  }, [user?.email, values.follow_up_email]);
  const [fieldErrors, setFieldErrors] = useState3({});
  useEffect2(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    const cleared = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (k === "title" && values.title.trim()) continue;
      if (k === "description" && values.description.trim()) continue;
      if (k === "persona" && values.persona.trim()) continue;
      if (k === "follow_up_email" && values.follow_up_email.trim()) continue;
      if (k === "parent_ticket_code" && values.parent_ticket_code.trim()) continue;
      if (k === "consent_metadata_capture" && values.consent_metadata_capture) continue;
      if (k === "linked_user_stories" && values.linked_user_stories.length > 0) continue;
      const tf = values.type_fields[k];
      if (tf !== void 0 && tf !== null && tf !== "") continue;
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
    const def = getTypeDef(values.type);
    for (const f of def.fields) {
      if (f.required === false) continue;
      const v = values.type_fields[f.name];
      if (v === void 0 || v === null || v === "") {
        return { ok: false, reason: f.name };
      }
    }
    if (def.requiresPersona && !values.persona.trim()) {
      return { ok: false, reason: "persona" };
    }
    if (def.requiresLinkedStories && values.linked_user_stories.length === 0) {
      return { ok: false, reason: "linked_user_stories" };
    }
    const fue = values.follow_up_email.trim();
    if (fue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fue)) {
      return { ok: false, reason: "follow_up_email" };
    }
    const ptc = values.parent_ticket_code.trim();
    if (ptc && !/^FB-\d{4}-\d{4}$/.test(ptc)) {
      return { ok: false, reason: "parent_ticket_code" };
    }
    if (!values.consent_metadata_capture) {
      return { ok: false, reason: "consent" };
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
          case "persona":
            return t("feedback.persona.label");
          case "linked_user_stories":
            return t("feedback.stories.label");
          case "follow_up_email":
            return t("feedback.field.follow_up_email");
          case "parent_ticket_code":
            return t("feedback.field.parent_ticket");
          case "consent_metadata_capture":
            return t("feedback.field.consent_metadata");
          default: {
            const def = values.type ? getTypeDef(values.type) : null;
            const f = def?.fields.find((x) => x.name === reason);
            return f ? t(f.labelKey) : reason;
          }
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
        const wasOpen = true;
        if (wasOpen) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        return captureScreenshot();
      })();
      const shot = await shotPromise;
      const metadata = buildMetadataBundle({
        routeName: typeof window !== "undefined" ? window.location.pathname : null,
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        user,
        selectedElement: locked?.info ?? null
      });
      const payload = {
        type: values.type,
        title: values.title.trim(),
        description: values.description,
        url_captured: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}` : "",
        route_name: typeof window !== "undefined" ? window.location.pathname : null,
        element: selectorInfo,
        type_fields: values.type_fields,
        persona: values.persona || null,
        linked_user_stories: values.linked_user_stories,
        metadata_bundle: metadata,
        consent_metadata_capture: values.consent_metadata_capture,
        app_version: adapter.appVersion,
        git_commit_sha: adapter.gitSha,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        follow_up_email: values.follow_up_email.trim() || null,
        parent_ticket_code: values.parent_ticket_code.trim() || null
      };
      const payloadJson = JSON.stringify(payload);
      const payloadBytes = new Blob([payloadJson]).size;
      const screenshotBytes = shot?.blob.size ?? 0;
      console.info("[feedback] submit", {
        payloadBytes,
        screenshotBytes,
        totalBytes: payloadBytes + screenshotBytes
      });
      const created = await adapter.submitFeedback(
        payloadJson,
        shot?.blob ?? null
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
  return /* @__PURE__ */ jsx6(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs5(
    SheetContent,
    {
      side: "right",
      className: "w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto",
      "data-feedback-widget-root": "true",
      children: [
        /* @__PURE__ */ jsxs5(SheetHeader, { children: [
          /* @__PURE__ */ jsxs5(SheetTitle, { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx6(Rl3Mark, { className: "h-6 w-6 shrink-0" }),
            /* @__PURE__ */ jsx6("span", { children: t("feedback.panel_title") })
          ] }),
          /* @__PURE__ */ jsx6(SheetDescription, { children: t("feedback.panel_description") })
        ] }),
        /* @__PURE__ */ jsxs5("div", { className: "px-4 mt-4 space-y-4", children: [
          /* @__PURE__ */ jsxs5(
            "div",
            {
              className: "grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium",
              role: "tablist",
              children: [
                /* @__PURE__ */ jsx6(
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
                /* @__PURE__ */ jsx6(
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
          tab === "mine" ? /* @__PURE__ */ jsx6(MyTicketsPanel, {}) : null,
          tab === "submit" ? /* @__PURE__ */ jsxs5(Fragment2, { children: [
            /* @__PURE__ */ jsxs5("div", { className: "rounded-md border border-input p-3 space-y-2", children: [
              /* @__PURE__ */ jsx6("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: t("feedback.mode_label") }),
              /* @__PURE__ */ jsxs5("div", { className: "flex flex-wrap gap-2", children: [
                /* @__PURE__ */ jsx6(
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
                /* @__PURE__ */ jsx6(
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
              mode === "element" && locked ? /* @__PURE__ */ jsxs5("div", { className: "flex items-center justify-between rounded-md bg-primary/10 px-2 py-1 text-xs", children: [
                /* @__PURE__ */ jsx6("span", { className: "font-mono truncate", children: locked.info.selector }),
                /* @__PURE__ */ jsx6(
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
            /* @__PURE__ */ jsx6(FeedbackForm, { values, onChange: setValues, errors: fieldErrors }),
            /* @__PURE__ */ jsxs5("details", { className: "rounded-md border border-input p-3 text-xs text-muted-foreground", children: [
              /* @__PURE__ */ jsx6("summary", { className: "cursor-pointer font-medium text-foreground", children: t("feedback.metadata.title") }),
              /* @__PURE__ */ jsx6("p", { className: "mt-2", children: t("feedback.metadata.summary") })
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxs5(
            "a",
            {
              href: "https://rl3.dev",
              target: "_blank",
              rel: "noreferrer",
              className: "flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
              "aria-label": t("feedback.powered_by_aria"),
              children: [
                /* @__PURE__ */ jsx6(Rl3Mark, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsxs5("span", { children: [
                  t("feedback.powered_by"),
                  " ",
                  /* @__PURE__ */ jsx6("strong", { className: "font-semibold", children: "RL3" })
                ] })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs5(SheetFooter, { className: "mt-6", children: [
          /* @__PURE__ */ jsx6(
            Button,
            {
              variant: "outline",
              onClick: () => onOpenChange(false),
              disabled: submitting,
              "data-feedback-id": "feedback.cancel",
              children: t("feedback.cancel")
            }
          ),
          tab === "submit" ? /* @__PURE__ */ jsx6(
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
//# sourceMappingURL=FeedbackPanel-3KIGK4TV.js.map