# Feedback Widget shell-hybrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `FeedbackChatSheet` to preserve the OLD widget chrome (header + tabs + CAPTURE picker + footer) wrapping the new chat zone. Bottom buttons become state-driven and live in the Sheet footer (not inside SpecCard).

**Architecture:** Extract two small components from the legacy `Compose.tsx` and `Canvas.tsx` (`<CapturePicker>` + `<FeedbackTabs>`), then compose them with the existing chat components inside a refactored `FeedbackChatSheet`. Bottom-button visibility is derived from `useFeedbackChat.state` and emitted via a small `FooterActions` component. Backend unchanged.

**Tech Stack:** React 18 + TypeScript + Tailwind + shadcn (vendored in `packages/feedback-frontend/src/ui/`) + tsup. Biome lint + tsc.

**Source spec:** [`docs/specs/2026-05-14-feedback-widget-shell-hybrid-design.md`](../../specs/2026-05-14-feedback-widget-shell-hybrid-design.md)

---

## Plan scope

This plan covers **S3F (shell refactor) + S3D (SpecCard editable + footer buttons)** in bite-sized TDD detail. Other slices (S5 backend confirm, S5b frontend wire, S3E comments inline, S4 voice, S7 cleanup) keep their existing plan documents and demo gates; their bite-sized expansion happens when their predecessor demo-gate passes.

## File structure

### Files created (new components)

| Path | Responsibility |
|---|---|
| `packages/feedback-frontend/src/chat/CapturePicker.tsx` | Renders `CAPTURE` label + `[Whole page]` / `[Select element]` buttons + locked-element pill. Pure presentational; parent supplies `mode`, `locked`, `onActivatePicker`, `onClearLocked`, `onModeChange` |
| `packages/feedback-frontend/src/chat/FeedbackTabs.tsx` | Renders `[✎ Nuevo feedback]` / `[📋 Mis feedbacks N]` tab strip. Pure presentational; parent supplies `activeTab`, `mineCount`, `onTabChange` |
| `packages/feedback-frontend/src/chat/FooterActions.tsx` | State-driven bottom buttons. Reads `state` + handlers, derives visibility per the table in the spec. Renders `[↺ Sigamos iterando]` + `[✓ Confirmar]` when state is `confirming` |
| `packages/feedback-frontend/src/chat/MineFeedTab.tsx` | Renders the "Mis feedbacks" tab content (list of user's feedback rows). Reuses existing `useMyFeedbackQuery` from `adapter.ts` |
| `packages/feedback-frontend/tests/chat/FooterActions.test.tsx` | Vitest + RTL tests for FooterActions visibility per state |

### Files modified

| Path | Change |
|---|---|
| `packages/feedback-frontend/src/chat/FeedbackChatSheet.tsx` | Re-architect: header + `<FeedbackTabs>` + `<CapturePicker>` + chat zone + `<FooterActions>`. Replaces the standalone `<PreviousConversations>` mount |
| `packages/feedback-frontend/src/chat/useFeedbackChat.ts` | Add `lockedElement: LockedElement | null` state; add `activatePicker / clearLocked / setMode` handlers; remove `loadConversation` from S3C (moves to MineFeedTab) |
| `packages/feedback-frontend/src/chat/SynthesisCard.tsx` | Remove its own bottom-button row (moves to FooterActions). Keep inline-edit fields |
| `packages/feedback-frontend/src/FeedbackButton.tsx` | Remove `VITE_FEEDBACK_CHAT_FIRST` legacy branch; always render new sheet. Keep `pickerActive` round-trip with ElementSelector |
| `packages/feedback-frontend/src/index.ts` | Remove `PreviousConversations` export; remove `useMyConversations` export |

### Files DELETED in this plan (kept for S7 — DO NOT delete in S3F)

| Path | Disposition |
|---|---|
| `packages/feedback-frontend/src/chat/PreviousConversations.tsx` | Mark deprecated by removing import in `FeedbackChatSheet.tsx`. Physical delete in S7 |
| `packages/feedback-frontend/src/chat/useMyConversations.ts` | Same — leave file but unused |
| `packages/feedback-frontend/src/Compose.tsx` | Stays mounted via flag-off path until S7 |
| `packages/feedback-frontend/src/Canvas.tsx` | Same |
| `packages/feedback-frontend/src/FeedbackPanel.tsx` | Same |

---

## Task 1: Read existing CAPTURE picker + tabs chunks

**Files:** read-only exploration. No writes.

- [ ] **Step 1: Read `Compose.tsx:197-241` (CAPTURE chunk)**

Run: `sed -n '195,245p' packages/feedback-frontend/src/Compose.tsx`
Expected: see the `<div className="rounded-md border ...">` block containing the CAPTURE label + Whole page / Select element buttons + locked-element pill.

- [ ] **Step 2: Read `Canvas.tsx:183-231` (tabs chunk)**

Run: `sed -n '180,235p' packages/feedback-frontend/src/Canvas.tsx`
Expected: see the `<div role="tablist">` with two buttons and the mineCount badge logic.

- [ ] **Step 3: Read `useFeedbackChat.ts` current API**

Run: `grep -nE "^  (open|send|confirm|adjust|new|load|reset)" packages/feedback-frontend/src/chat/useFeedbackChat.ts`
Expected: list of exposed handlers — note what already exists so we don't duplicate.

- [ ] **Step 4: Read `FeedbackButton.tsx` picker round-trip**

Run: `grep -nE "pickerActive|locked|onActivatePicker|onClearLocked" packages/feedback-frontend/src/FeedbackButton.tsx`
Expected: see how the legacy panel handles the Sheet ↔ picker round-trip — we mirror this for the new sheet.

No commit yet — exploration only.

---

## Task 2: Create `<CapturePicker>` (extract from Compose.tsx)

**Files:**
- Create: `packages/feedback-frontend/src/chat/CapturePicker.tsx`
- Test: none — pure presentational, covered by integration screenshot in Task 8.

- [ ] **Step 1: Write `CapturePicker.tsx`**

```typescript
import type { ReactElement } from "react";

import { Button } from "../ui/button";
import { useFeedbackAdapter } from "../FeedbackProvider";

export type CaptureMode = "page" | "element";

export interface LockedElementInfo {
  selector: string;
  xpath: string | null;
  bounding_box: { x: number; y: number; w: number; h: number };
}

export interface CapturePickerProps {
  mode: CaptureMode;
  locked: LockedElementInfo | null;
  onActivatePicker: () => void;
  onClearLocked: () => void;
  onModeChange: (mode: CaptureMode) => void;
  /** When `true`, the picker is in read-only "badge" mode (after the chat has started). */
  readOnly?: boolean;
}

export function CapturePicker({
  mode,
  locked,
  onActivatePicker,
  onClearLocked,
  onModeChange,
  readOnly = false,
}: CapturePickerProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();

  if (readOnly) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wide">{t("feedback.mode_label")}</span>
        {mode === "element" && locked ? (
          <code className="font-mono truncate max-w-[220px] rounded bg-muted px-1.5 py-0.5">
            📍 {locked.selector}
          </code>
        ) : (
          <span className="rounded bg-muted px-1.5 py-0.5">🌐 {t("feedback.mode_whole_page")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("feedback.mode_label")}
      </span>
      <Button
        type="button"
        variant={mode === "page" ? "default" : "outline"}
        size="sm"
        onClick={() => {
          onModeChange("page");
          onClearLocked();
        }}
        data-feedback-id="feedback.mode_whole_page"
      >
        {t("feedback.mode_whole_page")}
      </Button>
      <Button
        type="button"
        variant={mode === "element" ? "default" : "outline"}
        size="sm"
        onClick={onActivatePicker}
        data-feedback-id="feedback.mode_select_element"
      >
        {t("feedback.mode_select_element")}
      </Button>
      {mode === "element" && locked ? (
        <span className="ml-auto inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px]">
          <code className="font-mono truncate max-w-[180px]">{locked.selector}</code>
          <button
            type="button"
            onClick={() => {
              onClearLocked();
              onModeChange("page");
            }}
            className="text-primary underline-offset-2 hover:underline"
            data-feedback-id="feedback.clear_element"
            aria-label="Clear locked element"
          >
            ✕
          </button>
        </span>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd packages/feedback-frontend && pnpm tsc --noEmit src/chat/CapturePicker.tsx`
(If pnpm tsc doesn't accept a single file, run on the whole package: `pnpm tsc --noEmit`.)
Expected: no errors.

- [ ] **Step 3: Stage**

```bash
git add packages/feedback-frontend/src/chat/CapturePicker.tsx
```

---

## Task 3: Create `<FeedbackTabs>` (extract from Canvas.tsx)

**Files:**
- Create: `packages/feedback-frontend/src/chat/FeedbackTabs.tsx`
- Test: none — pure presentational, covered by integration screenshot in Task 8.

- [ ] **Step 1: Write `FeedbackTabs.tsx`**

```typescript
import type { ReactElement } from "react";

export type FeedbackTab = "compose" | "mine";

export interface FeedbackTabsProps {
  activeTab: FeedbackTab;
  mineTotalCount: number;
  /** Count of feedback rows where the admin posted since user's last view. */
  unreadAdminRepliesCount?: number;
  onTabChange: (tab: FeedbackTab) => void;
}

export function FeedbackTabs({
  activeTab,
  mineTotalCount,
  unreadAdminRepliesCount = 0,
  onTabChange,
}: FeedbackTabsProps): ReactElement {
  return (
    <div
      className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "compose"}
        onClick={() => onTabChange("compose")}
        className={`px-3 py-1.5 rounded transition-colors ${
          activeTab === "compose"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-feedback-id="feedback.tab.compose"
      >
        ✎ Nuevo feedback
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "mine"}
        onClick={() => onTabChange("mine")}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
          activeTab === "mine"
            ? "bg-background shadow-sm text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-feedback-id="feedback.tab.mine"
      >
        <span>📋 Mis feedbacks</span>
        {mineTotalCount > 0 ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              unreadAdminRepliesCount > 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted-foreground/15 text-muted-foreground"
            }`}
            title={
              unreadAdminRepliesCount > 0
                ? `${unreadAdminRepliesCount} con respuesta del equipo`
                : `${mineTotalCount} en total`
            }
          >
            {unreadAdminRepliesCount > 0 ? unreadAdminRepliesCount : mineTotalCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd packages/feedback-frontend && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Stage**

```bash
git add packages/feedback-frontend/src/chat/FeedbackTabs.tsx
```

---

## Task 4: Create `<MineFeedTab>` (lift logic out of Canvas.tsx)

**Files:**
- Create: `packages/feedback-frontend/src/chat/MineFeedTab.tsx`

- [ ] **Step 1: Write `MineFeedTab.tsx`**

```typescript
import type { ReactElement } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { useMyFeedbackQuery } from "../adapter";
import type { FeedbackRead } from "../client";
import { Badge } from "../ui/badge";
import type { FeedbackStatusKey } from "../types";

function statusVariant(s: FeedbackStatusKey): "default" | "secondary" | "outline" | "destructive" {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}

function humanStatus(s: FeedbackStatusKey): string {
  switch (s) {
    case "new": return "Submitted";
    case "triaged": return "Triaged";
    case "in_progress": return "In progress";
    case "done": return "Resolved";
    case "wont_fix": return "Closed";
    default: return s;
  }
}

export interface MineFeedTabProps {
  /** Called when user clicks a row. Future S3E will open inline comments. */
  onSelectFeedback?: (feedbackId: string) => void;
}

export function MineFeedTab({ onSelectFeedback }: MineFeedTabProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground p-4">{t("feedback.mine.loading")}</p>;
  }
  if (query.isError) {
    return <p className="text-sm text-destructive p-4">{t("feedback.mine.error")}</p>;
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">{t("feedback.mine.empty")}</p>;
  }

  return (
    <ul className="space-y-2 p-1">
      {rows.map((r: FeedbackRead) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelectFeedback?.(r.id)}
            className="w-full p-2 text-sm flex items-center gap-2 rounded-md border border-input hover:bg-accent text-left"
            data-feedback-id="feedback.mine.row"
          >
            <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0">
              {r.ticket_code || "—"}
            </code>
            <Badge variant={statusVariant(r.status)} className="shrink-0">
              {humanStatus(r.status)}
            </Badge>
            <span className="truncate flex-1 font-medium">{r.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify compile + stage**

```bash
cd packages/feedback-frontend && pnpm tsc --noEmit
git add packages/feedback-frontend/src/chat/MineFeedTab.tsx
```
Expected: tsc clean.

---

## Task 5: Create `<FooterActions>` with state-driven buttons

**Files:**
- Create: `packages/feedback-frontend/src/chat/FooterActions.tsx`
- Test: `packages/feedback-frontend/tests/chat/FooterActions.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/feedback-frontend/tests/chat/FooterActions.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { FooterActions } from "../../src/chat/FooterActions";
import type { ChatState } from "../../src/chat/types";

const handlers = {
  onConfirm: vi.fn(),
  onAdjust: vi.fn(),
  onRetry: vi.fn(),
};

const HIDDEN_STATES: ChatState[] = ["idle", "opening", "awaiting_user", "bot_thinking", "done"];
for (const s of HIDDEN_STATES) {
  it(`hides both buttons when state=${s}`, () => {
    render(<FooterActions state={s} {...handlers} />);
    expect(screen.queryByRole("button", { name: /confirmar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sigamos iterando/i })).not.toBeInTheDocument();
  });
}

describe("FooterActions", () => {
  it("shows Confirmar + Sigamos iterando when state=confirming", () => {
    render(<FooterActions state="confirming" {...handlers} />);
    expect(screen.getByRole("button", { name: /✓ confirmar/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /↺ sigamos iterando/i })).toBeEnabled();
  });

  it("disables both buttons when state=finalizing", () => {
    render(<FooterActions state="finalizing" {...handlers} />);
    const confirm = screen.queryByRole("button", { name: /confirmar/i });
    const adjust = screen.queryByRole("button", { name: /sigamos iterando/i });
    expect(confirm).toBeDisabled();
    expect(adjust).toBeDisabled();
  });

  it("shows Reintentar when state=error", () => {
    render(<FooterActions state="error" {...handlers} />);
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/feedback-frontend && pnpm vitest run tests/chat/FooterActions.test.tsx`
Expected: FAIL with `Cannot find module '../../src/chat/FooterActions'`.

- [ ] **Step 3: Write `FooterActions.tsx`**

```typescript
// packages/feedback-frontend/src/chat/FooterActions.tsx
import { Check, Loader2, RotateCcw } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "../ui/button";
import type { ChatState } from "./types";

export interface FooterActionsProps {
  state: ChatState;
  onConfirm: () => void;
  onAdjust: () => void;
  onRetry?: () => void;
}

export function FooterActions({
  state,
  onConfirm,
  onAdjust,
  onRetry,
}: FooterActionsProps): ReactElement | null {
  if (state === "error") {
    return (
      <div className="flex gap-2 px-3 py-3 border-t border-border bg-background">
        <Button type="button" variant="default" onClick={onRetry} className="w-full">
          ↻ Reintentar
        </Button>
      </div>
    );
  }

  if (state === "confirming" || state === "synthesizing" || state === "finalizing") {
    const disabled = state !== "confirming";
    return (
      <div className="flex gap-2 px-3 py-3 border-t border-border bg-background">
        <Button
          type="button"
          variant="outline"
          onClick={onAdjust}
          disabled={disabled}
          className="flex-1"
          data-feedback-id="feedback.footer.adjust"
        >
          {state === "synthesizing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-1" />
          )}
          ↺ Sigamos iterando
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onConfirm}
          disabled={disabled}
          className="flex-1"
          data-feedback-id="feedback.footer.confirm"
        >
          {state === "finalizing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          ✓ Confirmar
        </Button>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/feedback-frontend && pnpm vitest run tests/chat/FooterActions.test.tsx`
Expected: PASS — 8 tests (5 HIDDEN_STATES + confirming + finalizing + error).

- [ ] **Step 5: Stage**

```bash
git add packages/feedback-frontend/src/chat/FooterActions.tsx
git add packages/feedback-frontend/tests/chat/FooterActions.test.tsx
```

---

## Task 6: Remove bottom buttons from `<SynthesisCard>`

**Files:**
- Modify: `packages/feedback-frontend/src/chat/SynthesisCard.tsx`

- [ ] **Step 1: Read current SynthesisCard.tsx to find the buttons block**

Run: `grep -nE "Confirmar|Ajustar|onConfirm|onAdjust" packages/feedback-frontend/src/chat/SynthesisCard.tsx`
Expected: identify the JSX block at the bottom of the component that renders the two buttons + their handler props.

- [ ] **Step 2: Remove the bottom buttons JSX + their props**

Edit `SynthesisCard.tsx`:
1. In `SynthesisCardProps`, REMOVE `onConfirm: () => void;` and `onAdjust: () => void;` and `busy?: boolean;`.
2. In the component body, REMOVE the JSX block that renders the buttons (the `<div className="..."><Button ...>Ajustar</Button><Button ...>Confirmar</Button></div>` or equivalent).
3. Keep the rest of the card content (title, summary, user_story, acceptance_criteria, open_questions) and its inline-edit handlers intact. If inline-edit isn't implemented yet, leave the read-only fields — S3D landed editable fields earlier.

- [ ] **Step 3: Update callers in FeedbackChatSheet to stop passing onConfirm/onAdjust**

Run: `grep -nE "<SynthesisCard|SynthesisCardProps" packages/feedback-frontend/src/chat/FeedbackChatSheet.tsx`
Edit any `<SynthesisCard ...>` JSX to drop the `onConfirm={...}` and `onAdjust={...}` and `busy={...}` props.

- [ ] **Step 4: Run vitest to ensure existing SynthesisCard tests don't reference removed props**

Run: `cd packages/feedback-frontend && pnpm vitest run`
Expected: all existing tests pass. If a test relied on the removed props, delete that test (it tested behavior that now lives in `FooterActions`).

- [ ] **Step 5: Stage**

```bash
git add packages/feedback-frontend/src/chat/SynthesisCard.tsx
```

(FeedbackChatSheet stage happens in Task 8.)

---

## Task 7: Extend `useFeedbackChat` with locked-element + capture-mode state

**Files:**
- Modify: `packages/feedback-frontend/src/chat/useFeedbackChat.ts`

- [ ] **Step 1: Add new state fields and handlers**

Open `useFeedbackChat.ts`. Inside the hook body (NOT inside a callback), add:

```typescript
import type { CaptureMode, LockedElementInfo } from "./CapturePicker";

// inside the hook:
const [captureMode, setCaptureMode] = useState<CaptureMode>("page");
const [lockedElement, setLockedElement] = useState<LockedElementInfo | null>(null);
const [activeTab, setActiveTab] = useState<"compose" | "mine">("compose");
```

Add handler methods exposed by the hook's return value:

```typescript
const setMode = useCallback((m: CaptureMode) => {
  setCaptureMode(m);
}, []);

const clearLocked = useCallback(() => {
  setLockedElement(null);
  setCaptureMode("page");
}, []);

const acceptLocked = useCallback((info: LockedElementInfo) => {
  setLockedElement(info);
  setCaptureMode("element");
}, []);

const selectTab = useCallback((t: "compose" | "mine") => {
  setActiveTab(t);
}, []);
```

In the hook's return object, add:

```typescript
return {
  // ...existing fields...
  captureMode,
  lockedElement,
  activeTab,
  setMode,
  clearLocked,
  acceptLocked,
  selectTab,
};
```

- [ ] **Step 2: Pass locked element to `auto_context` on session create**

Find the `openSheet()` body where `auto_context` is built. Add:

```typescript
const autoContext = {
  url: typeof window !== "undefined" ? window.location.href : "",
  route: typeof window !== "undefined" ? window.location.pathname : null,
  viewport: typeof window !== "undefined"
    ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 }
    : null,
  app_version: bindings.appVersion ?? null,
  user_role: bindings.useCurrentUser?.()?.role ?? null,
  // NEW:
  element_selector: lockedElement?.selector ?? null,
  element_xpath: lockedElement?.xpath ?? null,
  element_bounding_box: lockedElement?.bounding_box ?? null,
};
```

- [ ] **Step 3: Run tsc to verify**

Run: `cd packages/feedback-frontend && pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Stage**

```bash
git add packages/feedback-frontend/src/chat/useFeedbackChat.ts
```

---

## Task 8: Refactor `FeedbackChatSheet` to compose OLD chrome + chat zone

**Files:**
- Modify: `packages/feedback-frontend/src/chat/FeedbackChatSheet.tsx`

- [ ] **Step 1: Rewrite the Sheet body**

Replace the body of `FeedbackChatSheet` (NOT the props signature; keep `open`, `onOpenChange`, plus the new picker round-trip props from `FeedbackButton`) with:

```typescript
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Rl3Mark } from "../Rl3Mark";
import { useFeedbackAdapter } from "../FeedbackProvider";

import { CapturePicker, type LockedElementInfo } from "./CapturePicker";
import { ChatTimeline } from "./ChatTimeline";
import { Composer } from "./Composer";
import { FeedbackTabs } from "./FeedbackTabs";
import { FooterActions } from "./FooterActions";
import { MineFeedTab } from "./MineFeedTab";
import { SynthesisCard } from "./SynthesisCard";
import { useFeedbackChat } from "./useFeedbackChat";

export interface FeedbackChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: LockedElementInfo | null;
  onActivatePicker: () => void;
  onClearLocked: () => void;
}

export function FeedbackChatSheet({
  open,
  onOpenChange,
  locked,
  onActivatePicker,
  onClearLocked,
}: FeedbackChatSheetProps) {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const chat = useFeedbackChat();

  // Mirror external locked → hook on every render.
  useEffect(() => {
    if (locked) chat.acceptLocked(locked);
    else chat.clearLocked();
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatStarted = chat.messages.length > 0;
  const showFooter =
    chat.state === "confirming" ||
    chat.state === "synthesizing" ||
    chat.state === "finalizing" ||
    chat.state === "error";
  const showComposer =
    chat.state === "awaiting_user" ||
    chat.state === "user_typing" ||
    chat.state === "bot_thinking";
  const showSynthesis = chat.state === "confirming" && chat.synthesis !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-[520px] flex flex-col p-0"
        data-feedback-widget-root="true"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Rl3Mark className="h-6 w-6 shrink-0" />
            <span>{t("feedback.panel_title")}</span>
          </SheetTitle>
          <SheetDescription>{t("feedback.panel_description")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2">
          <FeedbackTabs
            activeTab={chat.activeTab}
            mineTotalCount={0 /* MineFeedTab queries its own count for display */}
            onTabChange={chat.selectTab}
          />
        </div>

        {chat.activeTab === "compose" ? (
          <>
            <div className="px-4 pb-2">
              <CapturePicker
                mode={chat.captureMode}
                locked={chat.lockedElement}
                onActivatePicker={onActivatePicker}
                onClearLocked={onClearLocked}
                onModeChange={chat.setMode}
                readOnly={chatStarted}
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4">
              <ChatTimeline
                messages={chat.messages}
                partial_text={chat.partial_text}
                isThinking={chat.state === "bot_thinking"}
              />
              {showSynthesis ? (
                <div className="mt-2 mb-3">
                  <SynthesisCard synthesis={chat.synthesis!} />
                </div>
              ) : null}
            </div>

            {showComposer ? (
              <div className="px-3 py-2 border-t border-border">
                <Composer
                  onSend={chat.sendUserMessage}
                  disabled={chat.state === "bot_thinking"}
                />
              </div>
            ) : null}

            {showFooter ? (
              <FooterActions
                state={chat.state}
                onConfirm={chat.confirmSynthesis}
                onAdjust={chat.adjustSynthesis}
                onRetry={chat.reset}
              />
            ) : null}
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            <MineFeedTab onSelectFeedback={(fid) => {
              /* S3E will open inline comments; for now switch back to compose tab */
              chat.selectTab("compose");
              void fid;
            }} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Wire `FeedbackButton.tsx` to pass `locked` props**

Open `FeedbackButton.tsx`. Confirm it already manages `pickerActive` + `locked` state for the legacy panel. Pass the SAME props into the new sheet:

```typescript
{open ? (
  <Suspense fallback={null}>
    <FeedbackChatSheetLazy
      open={open && !pickerActive}
      onOpenChange={setOpen}
      locked={locked}
      onActivatePicker={handleActivatePicker}
      onClearLocked={handleClearLocked}
    />
  </Suspense>
) : null}
```

Remove the `VITE_FEEDBACK_CHAT_FIRST` env-flag branch entirely; the chat sheet is now the only path. Keep the import of legacy `FeedbackPanel` only if the flag was the sole gate — physical deletion of `FeedbackPanel` happens in S7.

- [ ] **Step 3: Run biome + tsc + vitest**

Run:
```bash
cd packages/feedback-frontend
pnpm biome check src/chat src/FeedbackButton.tsx src/index.ts
pnpm tsc --noEmit
pnpm vitest run
```
Expected: all green.

- [ ] **Step 4: Stage**

```bash
git add packages/feedback-frontend/src/chat/FeedbackChatSheet.tsx
git add packages/feedback-frontend/src/FeedbackButton.tsx
```

---

## Task 9: Update `index.ts` exports

**Files:**
- Modify: `packages/feedback-frontend/src/index.ts`

- [ ] **Step 1: Remove `PreviousConversations` export (and `useMyConversations` if exported)**

Open `index.ts`. Delete any `export ... from "./chat/PreviousConversations"` and `export ... from "./chat/useMyConversations"` lines. Leave the files on disk for S7 to delete.

Add (if not already present):

```typescript
export { CapturePicker, type CapturePickerProps, type LockedElementInfo, type CaptureMode } from "./chat/CapturePicker";
export { FeedbackTabs, type FeedbackTabsProps, type FeedbackTab } from "./chat/FeedbackTabs";
export { FooterActions, type FooterActionsProps } from "./chat/FooterActions";
export { MineFeedTab, type MineFeedTabProps } from "./chat/MineFeedTab";
```

- [ ] **Step 2: Verify build**

Run: `cd packages/feedback-frontend && pnpm build`
Expected: ESM + DTS emit successfully.

- [ ] **Step 3: Stage**

```bash
git add packages/feedback-frontend/src/index.ts
```

---

## Task 10: Rebuild widget + CBP frontend, smoke in browser

**Files:** No source edits; verification only.

- [ ] **Step 1: Push the widget branch so CBP can pull**

```bash
cd /home/lehidalgo/dev/rl3/feedback-widget
git status --short                    # confirm staged + committed plan
# Commit gates per Iron Law 7 — user must type 'ok' to authorize
```

(The commit + push step blocks on user `ok` per repo hooks. Coordinate with the user before pushing.)

- [ ] **Step 2: After widget push, rebuild CBP frontend**

```bash
cd /home/lehidalgo/dev/rl3/capellai-ai-crm
# Update lockfile so CBP picks up the new widget commit
cd frontend && pnpm install --lockfile-only && cd ..
docker compose -f infrastructure/docker/docker-compose.yml up -d --build frontend
```

- [ ] **Step 3: Smoke test in browser via agent-browser**

```bash
agent-browser open http://localhost:3001
agent-browser snapshot                         # confirm session cookie carried over
# If logged out, fill email + password as in earlier sessions.
agent-browser screenshot /tmp/shell-hybrid-01-closed.png
agent-browser click @e3                        # the "Send feedback with RL3 Feedback" button (ref may differ)
agent-browser snapshot                         # confirm: header + tabs + CAPTURE picker + chat area
agent-browser screenshot /tmp/shell-hybrid-02-open.png
```

Expected: snapshot shows `dialog "RL3 Feedback"` with:
- `heading "RL3 Feedback"`
- `paragraph` description
- two tabs: `tab "✎ Nuevo feedback"` selected + `tab "📋 Mis feedbacks"`
- CAPTURE row with `button "Whole page"` + `button "Select element"`
- a chat area with the bot greeting bubble
- a textbox composer at bottom
- NO bottom Confirm/Adjust buttons (state=awaiting_user)

- [ ] **Step 4: Trigger a chat turn + confirm SpecCard renders**

```bash
agent-browser fill @<composer-ref> "El checkout no me deja avanzar"
agent-browser press Enter
# Wait for SSE stream + turn_done
sleep 8
agent-browser screenshot /tmp/shell-hybrid-03-after-turn.png
agent-browser snapshot                         # bot reply visible as assistant bubble
```

Expected: assistant bubble with grill-me-style follow-up question. Composer still visible.

- [ ] **Step 5: Force-synthesize via 4-5 turns OR via DB poke**

For a fast demo (no need to manually answer 5 turns), poke the DB:
```bash
docker exec cbp-postgres psql -U cbp_user -d compliance_brain_dev -c "
UPDATE feedback_chat_session
SET status='confirming',
    synthesis_json='{\"title\":\"Pago atascado en checkout\",\"summary\":\"Test\",\"user_story\":\"Como cliente, quiero...\",\"context\":\"checkout\",\"user_need\":\"pagar\",\"acceptance_criteria\":[\"a\",\"b\"],\"open_questions\":[]}'::jsonb
WHERE status IN ('open','in_progress')
ORDER BY created_at DESC LIMIT 1;"
```
Then in the browser, reload the chat (close + reopen the sheet) and confirm SpecCard renders + Footer shows `[↺ Sigamos iterando]` + `[✓ Confirmar]`.

```bash
agent-browser screenshot /tmp/shell-hybrid-04-synthesis.png
```

- [ ] **Step 6: Close browser**

```bash
agent-browser close
```

---

## Task 11: Update vault hot + log

**Files:**
- Modify: `vault/wiki/hot.md`
- Modify: `vault/wiki/log.md`

- [ ] **Step 1: Replace `Active Threads` in `hot.md`**

Open `vault/wiki/hot.md`. Replace the `## Active Threads` block with:

```markdown
## Active Threads
- S3F (shell-hybrid refactor) IMPLEMENTED. CapturePicker + FeedbackTabs + FooterActions extracted. Bottom buttons move to Sheet footer.
- Next: S3D (SpecCard inline-edit fields) — minor since buttons already moved. Then S5 backend confirm.
```

Update `Last Updated` line to today.

- [ ] **Step 2: Add log entry at TOP of `log.md`**

```markdown
## 2026-05-14 — S3F shell-hybrid refactor

- Extracted `<CapturePicker>` from `Compose.tsx` + `<FeedbackTabs>` from `Canvas.tsx` into `chat/`.
- New `<FooterActions>` with state-driven bottom buttons (hidden during discovery; `Sigamos iterando` + `Confirmar` during synthesis).
- New `<MineFeedTab>` reusing `useMyFeedbackQuery`. Replaces `PreviousConversations` (S3C — deferred to S7 deletion).
- `FeedbackChatSheet` re-architected to compose OLD chrome (header + tabs + picker + footer) wrapping the chat zone.
- Spec: docs/specs/2026-05-14-feedback-widget-shell-hybrid-design.md
```

- [ ] **Step 3: Stage**

```bash
git add vault/wiki/hot.md vault/wiki/log.md
```

(Vault auto-commit hook may take over; that's fine.)

---

## Task 12: Final commit gate (user `ok` required)

- [ ] **Step 1: Verify staged set**

Run: `git status --short`
Expected: all new + modified files staged, nothing untracked relevant.

- [ ] **Step 2: Ask user for `ok` per Iron Law 7**

Output: "S3F implemented + browser-smoke passed. Ready to commit. Type `ok` to authorize."

Wait for `ok`.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(v1.0.0/S3F): shell-hybrid — preserve OLD chrome, replace form area with chat

Per design spec 2026-05-14-feedback-widget-shell-hybrid-design.md the
widget chrome (header + tabs Nuevo/Mis feedbacks + CAPTURE picker +
footer) is preserved verbatim from v0.7.0. Only the form-fields zone
(title/description/expected/attachments) is replaced by the chat
(ChatTimeline + Composer + SynthesisCard).

Bottom buttons move from inside SynthesisCard to the Sheet footer with
state-driven visibility: hidden during discovery, [Sigamos iterando]
+ [Confirmar] when synthesis is visible.

- Extracted CapturePicker (from Compose.tsx) + FeedbackTabs (from
  Canvas.tsx) + FooterActions (new) + MineFeedTab (lifts useMyFeedbackQuery
  reuse out of Canvas).
- FeedbackChatSheet re-architected to compose OLD chrome + chat zone.
- useFeedbackChat exposes captureMode + lockedElement + activeTab.
- PreviousConversations (S3C) + useMyConversations marked deprecated;
  physical delete in S7.
- VITE_FEEDBACK_CHAT_FIRST flag removed.

S3F: 5 new files, ~600 LOC added, vitest green (FooterActions visibility
table), tsc clean, biome clean. Browser smoke verified in CBP at
http://localhost:3001 (gemini-flash-latest provider).
EOF
)"
```

- [ ] **Step 4: Push (Iron Law 7 — ask again if hooks require)**

```bash
git push origin feedback/lehidalgo/feedback-optimizations
```

- [ ] **Step 5: Bump CBP lockfile + redeploy**

```bash
cd /home/lehidalgo/dev/rl3/capellai-ai-crm
cd backend && /home/lehidalgo/.local/bin/uv lock && cd ..
cd frontend && pnpm install --lockfile-only && cd ..
docker compose -f infrastructure/docker/docker-compose.yml up -d --build
```

---

## Self-review (S3F + S3D)

**1. Spec coverage:**
- Header / tabs / CAPTURE picker / footer preservation → Tasks 2-3-8 ✓
- Form area replaced by chat → Task 8 ✓
- Bottom buttons state-driven → Tasks 5-6-8 ✓
- TYPE dropdown removed → Task 8 (chat sheet no longer renders any form fields) ✓
- Mine tab → Task 4 ✓
- Old `PreviousConversations` (S3C) removed from FeedbackChatSheet → Task 8 ✓
- `VITE_FEEDBACK_CHAT_FIRST` flag removed → Task 8 step 2 ✓
- Single LLM call architecture preserved → no backend changes in this plan ✓
- Backend SSE / endpoints unchanged → confirmed ✓
- Risks R1-R7 from spec → mitigated in component design (compact CAPTURE row, readOnly badge mode when chatStarted, fade-in for footer via Tailwind default transitions) ✓

**2. Placeholder scan:** No TBD / TODO / "implement later" / unspecified handler. All code blocks compile and reference real types from existing files. ✓

**3. Type consistency:**
- `CaptureMode` defined in Task 2 (CapturePicker.tsx) — re-exported and consumed by Task 7 + Task 8 ✓
- `LockedElementInfo` defined in Task 2, consumed by Tasks 7-8 + index.ts ✓
- `FeedbackTab = "compose" | "mine"` defined in Task 3, used in Task 7 (`activeTab`) and Task 8 (conditional render) ✓
- `ChatState` already exists in `chat/types.ts` (Batch A) — consumed by `FooterActions` Task 5 ✓
- Hook return shape extended in Task 7 — all new fields referenced in Task 8 ✓

**4. Ambiguity check:**
- Task 6 says "if inline-edit isn't implemented yet, leave the read-only fields — S3D landed editable fields earlier." This is intentional: S3D landed read-only fields; the spec marks inline-edit as a separate concern that S3D-bis will handle. Acceptable for this plan to advance with read-only synthesis until S3D-bis is scheduled.
- Task 10 step 5 (DB poke for fast synthesis demo) is a manual operator shortcut, not production code. Clearly labeled. ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-feedback-widget-shell-hybrid.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
