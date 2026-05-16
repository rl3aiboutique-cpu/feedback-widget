import { ReactElement, ReactNode } from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';

/** Package version — keep in sync with package.json. */
declare const VERSION = "1.0.0";

declare function useCanTriageFeedback(): boolean;

declare function installConsoleWrap(capacity?: number): void;

declare function installNetworkWrap(capacity?: number): void;

declare function installErrorWrap(capacity?: number): void;

/**
 * Internal widget types.
 *
 * The widget intentionally re-declares (rather than re-exports) the
 * shape of the SDK enums it consumes. That way `forms/types.ts` and the
 * other widget-internal files never import from `@/client` — only
 * `adapter.ts` does, and the adapter mirrors anything the widget needs
 * onto these declarations. This is the contract that makes extraction
 * cheap: if the host SDK changes shape, only `adapter.ts` cares.
 */
type FeedbackTypeKey = "bug" | "ui" | "performance" | "new_feature" | "extend_feature" | "other";
type FeedbackStatusKey = "open" | "in_review" | "in_progress" | "waiting_for_user" | "resolved" | "wont_fix" | "closed";
interface CurrentUserSnapshot {
    /** Stable user identifier — UUID-as-string. */
    id: string;
    email: string;
    role: string;
    /** Optional human display name; null when the host doesn't track one. */
    full_name?: string | null;
    /** Optional active tenant; null for single-tenant hosts (sapphira). */
    tenant_id?: string | null;
}
/**
 * Toast notifier the host injects via :class:`FeedbackHostBindings`.
 * When the host doesn't pass one, the widget falls back to a quiet
 * console-only stub so the package never imports a notifier library.
 */
interface ToastOptions {
    /** Optional href the host can attach as a click action. */
    url?: string;
    /** Optional plain-text label for the click action. */
    actionLabel?: string;
}
interface ToastApi {
    success(message: string, options?: ToastOptions): void;
    error(message: string, options?: ToastOptions): void;
    info(message: string, options?: ToastOptions): void;
    warning(message: string, options?: ToastOptions): void;
}
interface FeedbackAttachmentSummary {
    id: string;
    kind: "screenshot" | "user_attachment";
    bucket: string;
    object_key: string;
    content_type: string;
    byte_size: number;
    filename: string | null;
    width: number | null;
    height: number | null;
    created_at: string | null;
    presigned_url: string | null;
}
interface FeedbackReadShape {
    id: string;
    tenant_id: string;
    user_id: string;
    type: FeedbackTypeKey;
    status: FeedbackStatusKey;
    title: string;
    description: string;
    expected_outcome: string | null;
    url_captured: string;
    route_name: string | null;
    element_selector: string | null;
    element_xpath: string | null;
    element_bounding_box: Record<string, unknown> | null;
    metadata_bundle: Record<string, unknown>;
    app_version: string | null;
    git_commit_sha: string | null;
    user_agent: string | null;
    created_at: string | null;
    updated_at: string | null;
    triaged_by: string | null;
    triaged_at: string | null;
    triage_note: string | null;
    ticket_code: string;
    attachments: FeedbackAttachmentSummary[];
}
/**
 * Translator returned by `useTranslation()`. The host can implement
 * variable interpolation via the optional `vars` object — inside the
 * default locale map we look for `{name}` placeholders.
 */
type Translator = (key: string, vars?: Record<string, string>) => string;

/**
 * Floating RL3 Feedback launcher.
 *
 * Owns the cross-cutting state for the picker round-trip:
 *
 *   - ``open``         — Sheet visibility
 *   - ``pickerActive`` — element-selector overlay active
 *   - ``locked``       — element the picker locked, or null
 *
 * The Sheet panel closes (visually) while the picker is on, but the
 * panel component stays mounted as long as ``open || pickerActive``
 * — that way the user's half-filled form survives the picker round-
 * trip. When the picker locks an element or cancels, the Sheet
 * re-opens with the form state intact.
 *
 * Visual identity: RL3 mark + "Feedback" label so users know what
 * tool is open. Position is configurable via the FeedbackProvider
 * (env var fallback VITE_FEEDBACK_POSITION).
 *
 * Screenshot exclusion: every UI surface this file owns is wrapped
 * in ``data-feedback-widget-root="true"`` so the capture pipeline
 * filters them out before snapshotting the page.
 */

declare function FeedbackButton(): React.ReactElement | null;

type CaptureMode = "page" | "element";
interface LockedElementInfo {
    selector: string;
    xpath: string | null;
    bounding_box: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** Sprint B / capture_v3 — element outerHTML snapshot, truncated to
     * the backend cap (4096 chars). Null when capture failed. */
    outer_html?: string | null;
}
interface CapturePickerProps {
    mode: CaptureMode;
    locked: LockedElementInfo | null;
    onActivatePicker: () => void;
    onClearLocked: () => void;
    onModeChange: (mode: CaptureMode) => void;
    /** When `true`, the picker is in read-only "badge" mode (after the chat has started). */
    readOnly?: boolean;
    /** When `true`, render as icon-only buttons (28×28) so the picker
     *  fits inline next to the tabs in a single header row. Tooltips
     *  preserve the discoverability of each mode. */
    compact?: boolean;
}
declare function CapturePicker({ mode, locked, onActivatePicker, onClearLocked, onModeChange, readOnly, compact, }: CapturePickerProps): ReactElement;

/**
 * Chat-first feedback sheet — v1.0.0 shell-hybrid (S3F).
 *
 * Re-architected per spec
 * `docs/specs/2026-05-14-feedback-widget-shell-hybrid-design.md`:
 * the OLD widget chrome (header + tabs + CAPTURE picker + footer) is
 * preserved and now wraps the chat zone. The form-fields area is the
 * only thing the chat replaces.
 *
 * Layout:
 *
 *   ┌─ SheetHeader (RL3 mark + title + description) ─────────┐
 *   │ ┌─ FeedbackTabs (Nuevo feedback / Mis feedbacks) ────┐ │
 *   │ ┌─ CapturePicker (Whole page / Select element) ────-─┐ │  ← compose tab only
 *   │ ┌─ Chat scroll area (timeline + synthesis card) ─-───┐ │
 *   │ ┌─ Composer (textarea + send) ────────────-──────────┐ │  ← discovery states
 *   │ ┌─ FooterActions (Sigamos iterando / Confirmar) ─────┐ │  ← synthesis states
 *   └────────────────────────────────────────────────────────┘
 *
 * Bottom buttons live in `FooterActions`, NOT inside `SynthesisCard`.
 * Visibility is purely state-driven by `useFeedbackChat.state`.
 *
 * The "Conversaciones previas" header (S3C `<PreviousConversations>`)
 * is replaced by the Mis feedbacks tab + `<MineFeedTab>` (S3F).
 */

interface FeedbackChatSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** External locked element coming from `FeedbackButton`'s picker
     * round-trip. Mirrored into the hook on every render so the
     * CapturePicker badge and the auto_context payload stay in sync. */
    locked: LockedElementInfo | null;
    /** Hand control back to the parent so it can mount the ElementSelector
     * overlay. The sheet closes (visually) while the picker is on. */
    onActivatePicker: () => void;
    /** Drop the external locked element. Called when the user clicks the
     * ✕ next to the locked-element pill. */
    onClearLocked: () => void;
}
declare function FeedbackChatSheet({ open, onOpenChange, locked, onActivatePicker, onClearLocked, }: FeedbackChatSheetProps): ReactElement;

/** Persona entry inside the enriched synthesis (Sprint B / capture_v3). */
interface SynthesisPersona {
    name: string;
    goal: string;
    frustration: string;
}
/** Synthesis card payload (D-015 + Sprint B / capture_v3 — legacy
 * iter-module parity. Sprint B optional fields land tolerantly: the
 * LLM may emit them or not; SynthesisCard renders only the populated
 * sections.) */
interface Synthesis {
    title: string;
    summary: string;
    user_story: string;
    context: string;
    user_need: string;
    acceptance_criteria: string[];
    open_questions: string[];
    personas?: SynthesisPersona[];
    user_stories?: string[];
    assumptions?: string[];
    /** Optional Mermaid source string. Null when the LLM judged no
     * diagram useful. Rendered as a code block fallback when the host
     * has no mermaid runtime. */
    diagram?: string | null;
}
/**
 * Top-level state machine for the chat panel.
 *
 * idle           — sheet closed, no session
 * opening        — sheet opening; capturing screenshot + creating session
 * awaiting_user  — bot finished a turn, waiting for the user
 * user_typing    — user is composing (purely a UI hint, not load-bearing)
 * bot_thinking   — request in-flight, streaming delta events
 * synthesizing   — got `synthesizing` SSE event, awaiting `synthesis`
 * confirming     — synthesis received, user reviewing the card
 * finalizing     — user confirmed, POST /confirm in flight
 * done           — feedback created; sheet about to close
 * error          — terminal error state
 */
type ChatState = "idle" | "opening" | "awaiting_user" | "user_typing" | "bot_thinking" | "synthesizing" | "confirming" | "finalizing" | "done" | "error";

/**
 * Synthesis card for the chat-first feedback flow.
 *
 * Lives INSIDE the chat timeline as one bubble per spec emission so the
 * user can compare iterations. Each card has its own Approve button;
 * only one version per chat can be confirmed (one-winner invariant —
 * server-enforced). Click the card to enter edit mode and tweak title /
 * summary / user_story / acceptance_criteria manually; press Confirm to
 * persist the edit (does NOT auto-approve).
 *
 * Read-only mode renders the full enriched payload (personas, diagram,
 * etc.). Edit mode shows only the four user-editable fields — the rest
 * stays LLM-owned to keep the surface small.
 */

interface SynthesisCardProps {
    synthesis: Synthesis;
    /** Whether THIS card is the approved winner. Drives the green badge
     *  + disables further Approve / Edit. */
    confirmed?: boolean;
    /** True when ANY OTHER card in the same chat is already confirmed.
     *  Locks Approve + Edit on this one (the ticket has a winner). */
    lockedByOtherWinner?: boolean;
    /** Async approve handler — called when user presses Approve.
     *  Omit to render the card read-only (e.g. the legacy detail view). */
    onApprove?: () => void | Promise<void>;
    /** Async edit handler — called with the patched fields when the user
     *  presses Confirm in edit mode. Omit to render read-only. */
    onEdit?: (patch: {
        title?: string;
        summary?: string;
        user_story?: string;
        acceptance_criteria?: string[];
    }) => void | Promise<void>;
    /** Disables both buttons while a mutation is in-flight. */
    busy?: boolean;
}
declare function SynthesisCard({ synthesis, confirmed, lockedByOtherWinner, onApprove, onEdit, busy, }: SynthesisCardProps): ReactElement;

type FeedbackTab = "compose" | "mine";
interface FeedbackTabsProps {
    activeTab: FeedbackTab;
    mineTotalCount: number;
    /** Count of feedback rows where the admin posted since user's last view. */
    unreadAdminRepliesCount?: number;
    onTabChange: (tab: FeedbackTab) => void;
}
declare function FeedbackTabs({ activeTab, mineTotalCount, unreadAdminRepliesCount, onTabChange, }: FeedbackTabsProps): ReactElement;

interface FooterActionsProps {
    state: ChatState;
    onConfirm: () => void;
    onAdjust: () => void;
    onRetry?: () => void;
}
declare function FooterActions({ state, onConfirm, onAdjust, onRetry, }: FooterActionsProps): ReactElement | null;

/**
 * "Tickets" tab — unified ticket browser (Patrón A, 2026-05-16).
 *
 * Owns the management surface for both audiences:
 *
 *   - Submitter: scope = "mine" only. Sees their own tickets with
 *     search + status filter (no pagination — the user list is
 *     bounded to the most-recent 50).
 *   - Admin (``useCanTriageFeedback() === true``): scope toggle
 *     between "Mine" and "All". The "All" scope hits the admin
 *     endpoint and supports search + status + type filters with
 *     real pagination (page / page_size).
 *
 * Filter and pagination state lives in this component; switching
 * scope or tabs preserves it via the surrounding ChatSheet stays
 * mounted. Querystring sync is intentionally NOT done — the sheet
 * is an overlay, not a route.
 */

interface MineFeedTabProps {
    /** Called when the user clicks a row. The sheet swaps to the
     *  inline TicketDetail view. */
    onSelectFeedback?: (feedbackId: string) => void;
}
declare function MineFeedTab({ onSelectFeedback }: MineFeedTabProps): ReactElement;

/**
 * Status pill — submitter-facing rendering of D-003 ticket lifecycle.
 *
 * D-008 hides `type` and `severity` from the submitter, but `status` IS
 * visible because the submitter needs to know whether the team has seen
 * the ticket and where it stands. Colors mirror the admin triage panel
 * so the same status reads the same across surfaces.
 *
 * Spanish copy is fixed — the sandbox runs in `es` and v1 hosts inherit
 * that; if a non-es host appears later we'll route via the translator.
 */

interface StatusPillProps {
    status: FeedbackStatusKey;
}
declare function StatusPill({ status }: StatusPillProps): ReactElement;

/**
 * TicketDetail — full conversational workspace for one ticket.
 *
 * Mirrors the EXACT chat experience of the "New feedback" tab:
 * ChatTimeline + AttachmentTray + Composer (paperclip + mic + send
 * pill). The header carries status/code/meta; the admin actions
 * panel sits AT THE TOP right under the header so reviewers see
 * controls before they scroll the conversation; the synthesis card
 * renders when the ticket has been confirmed; attachments are
 * clickable thumbnails (open in lightbox / native browser).
 *
 * The conversation is hydrated from the detail query and then driven
 * by the same ``useChatRunStream`` hook the new-feedback flow uses,
 * so streaming deltas, retries, and synthesis events all behave
 * identically across both entry points.
 */

interface TicketDetailProps {
    feedbackId: string;
    onBack: () => void;
}
declare function TicketDetail({ feedbackId, onBack }: TicketDetailProps): ReactElement;

/**
 * Wire-shape types for the feedback widget.
 *
 * The shapes here intentionally mirror Pydantic schemas in
 * `feedback_widget.schemas` — keep them in sync.
 */
type FeedbackType = "bug" | "ui" | "performance" | "new_feature" | "extend_feature" | "other";
type FeedbackStatus = "open" | "in_review" | "in_progress" | "waiting_for_user" | "resolved" | "wont_fix" | "closed";
type FeedbackSeverity = "blocker" | "major" | "minor" | "idea";
type FeedbackAttachmentKind = "screenshot" | "user_attachment";
interface FeedbackAttachmentRead {
    id: string;
    kind: FeedbackAttachmentKind;
    bucket: string;
    object_key: string;
    content_type: string;
    byte_size: number;
    filename?: string | null;
    width?: number | null;
    height?: number | null;
    created_at?: string | null;
    presigned_url?: string | null;
}
/**
 * One conversation entry inside ``feedback_ticket.messages``. The
 * backend appends entries in order; the frontend renders them as
 * chat bubbles. ``role`` discriminates the speaker: user, assistant
 * (LLM), or admin (injected via /admin-action).
 */
interface FeedbackTimelineMessage {
    role: "user" | "assistant" | "admin";
    text: string;
    ts: string;
    /** Present on admin entries to attribute the message. */
    author_user_id?: string | null;
    /** Present on assistant entries that came from a synthesize turn. */
    mode?: "discover" | "synthesize";
}
interface FeedbackRead {
    id: string;
    tenant_id: string | null;
    user_id: string;
    type: FeedbackType | null;
    status: FeedbackStatus;
    title: string | null;
    description: string | null;
    expected_outcome?: string | null;
    url_captured: string | null;
    route_name?: string | null;
    element_selector?: string | null;
    element_xpath?: string | null;
    element_bounding_box?: Record<string, number> | null;
    metadata_bundle: Record<string, unknown>;
    app_version?: string | null;
    git_commit_sha?: string | null;
    user_agent?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    confirmed_at?: string | null;
    abandoned_at?: string | null;
    closed_at?: string | null;
    triaged_by?: string | null;
    triaged_at?: string | null;
    triage_note?: string | null;
    ticket_code: string | null;
    severity?: FeedbackSeverity | null;
    synthesis_json?: Record<string, unknown> | null;
    user_action_required: boolean;
    last_user_msg_at?: string | null;
    last_admin_msg_at?: string | null;
    total_input_tokens: number;
    total_output_tokens: number;
    context_usage_pct: number;
    model_id_pinned?: string | null;
    model_provider?: string | null;
    deleted_at?: string | null;
    deleted_by_role?: string | null;
    attachments: FeedbackAttachmentRead[];
    messages?: FeedbackTimelineMessage[] | null;
}
interface FeedbackListResponse {
    data: FeedbackRead[];
    count: number;
    page: number;
    page_size: number;
}
interface FeedbackStatusUpdate {
    status: FeedbackStatus;
    triage_note?: string | null;
}
type IterSessionStatus = "draft" | "iterating" | "finalized" | "abandoned";
type IterAssumptionKind = "technical" | "business" | "ux" | "scope";
type IterAssumptionStatus = "open" | "confirmed" | "corrected" | "irrelevant";
interface IterSessionRead {
    id: string;
    feedback_id: string;
    created_by_user_id: string;
    status: IterSessionStatus;
    model_id: string;
    model_provider: string;
    language: string;
    current_iteration_id: string | null;
    final_package_id: string | null;
    created_at: string;
    updated_at: string;
    finalized_at: string | null;
    /** Model id of the most recent successful LLM call. May differ
     * from ``model_id`` if the provider's fallback chain walked to
     * a different model. Null until at least one call has succeeded. */
    last_call_model_id?: string | null;
    /** Primary model id from the *currently configured* fallback
     * chain — what the next iteration would attempt first. Tracks
     * env changes live, so when the host swaps from Gemma to Flash
     * Lite the workspace header reflects it without a restart. */
    current_primary_model_id?: string | null;
    /** Iterations remaining before the hard cap blocks new runs.
     * Counts persisted versions; surfaces "Round N of M" in the UI
     * and swaps "Run iteration" for "Mark ready" once exhausted. */
    remaining_turns?: number;
    max_turns?: number;
    /** Mirrors the latest version's convergence signal so the UI
     * doesn't need to fetch the version detail to know whether to
     * show the "Mark ready" CTA. */
    is_complete?: boolean;
    completion_reason?: string | null;
}
type IterDiffOp = {
    op: "add";
    path: string;
    value: unknown;
    note?: string | null;
} | {
    op: "modify";
    path: string;
    before: unknown;
    after: unknown;
    note?: string | null;
} | {
    op: "remove";
    path: string;
    before: unknown;
    note: string;
} | {
    op: "mark_obsolete";
    path: string;
    reason: string;
};
interface IterVersionRead {
    id: string;
    session_id: string;
    version_number: number;
    parent_version_id: string | null;
    user_message: string;
    restructure_allowed: boolean;
    output_markdown: string;
    diff_json: IterDiffOp[];
    changes_summary: string;
    is_complete?: boolean;
    completion_reason?: string | null;
    created_at: string;
}
interface IterAssumptionRead {
    id: string;
    version_id: string;
    slot_key: string;
    kind: IterAssumptionKind;
    statement: string;
    rationale: string;
    confidence: number;
    status: IterAssumptionStatus;
    user_response: string | null;
    resolved_at: string | null;
    resolved_by_user_id: string | null;
    /** When present, the assumption is multiple-choice — UI renders
     * radio buttons over the listed options instead of an open
     * Confirm/Correct. */
    options?: string[] | null;
    created_at: string;
}
interface IterPackageRead {
    id: string;
    session_id: string;
    final_version_id: string;
    minio_zip_key: string;
    minio_folder_prefix: string;
    byte_size_zip: number;
    created_at: string;
    presigned_zip_url: string | null;
}

/**
 * Default + host-extensible string redactors.
 *
 * Every string value in the metadata bundle (console tail, network tail,
 * breadcrumbs, etc.) flows through `applyRedactors` before it leaves the
 * browser. The server-side redactor in `app/feedback/redaction.py` is
 * the second line of defence; this module is the first.
 *
 * The default list intentionally mirrors the server-side patterns so a
 * value scrubbed here doesn't trigger a different replacement string
 * server-side.
 */
declare function registerRedactor(fn: (s: string) => string): void;

/**
 * Adapter — the seam between the widget and the host application.
 *
 * The host provides a small set of `bindings` (see `FeedbackHostBindings`)
 * via the `<FeedbackProvider bindings={...}>` mount. Internally we
 * combine those bindings with widget-owned defaults (translator,
 * redactor list, build provenance) into a `FeedbackAdapter` that the
 * widget components read through `useFeedbackAdapter()`.
 *
 * No `@/*` imports here — the host plugs in via the bindings prop.
 */

interface FeedbackHostBindings {
    /** Hook returning the currently signed-in user, or null when absent. */
    useCurrentUser: () => CurrentUserSnapshot | null;
    /**
     * Returns the CSRF token to attach as `X-CSRF-Token`.
     *
     * Hosts that don't use CSRF (Bearer-only) should return an empty
     * string; the package-side router gates CSRF behind
     * `FEEDBACK_CSRF_REQUIRED`.
     */
    getCsrfToken: () => Promise<string>;
    /**
     * Optional. Returns the value to attach as `Authorization` header
     * (e.g. `"Bearer <token>"`). Hosts using cookie-based auth (with
     * `credentials: "include"`) leave this undefined; hosts that store
     * the token in localStorage / memory provide a callback. Returning
     * an empty string skips the header.
     */
    authHeader?: () => Promise<string>;
    /**
     * Optional CSV/list of roles permitted to triage feedback. The widget
     * exposes a `useCanTriageFeedback()` hook that reads this and gates
     * admin-only UI. When unset, the hook compares
     * `useCurrentUser().role` against `"MASTER_ADMIN"` case-insensitively.
     * Hosts with multiple admin-shaped roles set this from a build-time
     * env var (e.g. `VITE_FEEDBACK_TRIAGE_ROLES`).
     */
    triageRoles?: readonly string[];
    /** Backend root URL — the SDK appends `/api/v1/feedback` to this. */
    apiBaseUrl: string;
    /** Optional: override the API path prefix (default: `/api/v1/feedback`). */
    apiPathPrefix?: string;
    /**
     * Optional override of the deep-link base for the admin button in
     * notification emails. Defaults to `window.location.origin`.
     */
    getDeepLinkBase?: () => string;
    /** Optional: register additional redaction selectors at mount time. */
    extraRedactionSelectors?: readonly string[];
    /** Optional: locale override (defaults to "en"). */
    locale?: "en";
    /**
     * Optional toast notifier. When omitted the widget falls back to a
     * console-only stub. Hosts running ``sonner`` /
     * ``react-hot-toast`` / etc. pass their own to surface widget
     * messages in the host's notification UI.
     */
    toast?: ToastApi;
}
declare class SubmitFeedbackError extends Error {
    readonly status: number;
    readonly body: string;
    readonly retryAfter: string | null;
    constructor(status: number, body: string, retryAfter: string | null);
}
declare function useCurrentUser(): CurrentUserSnapshot | null;
declare function getDefaultRedactionSelectors(): readonly string[];

declare function useTranslation(): Translator;
interface FeedbackAdapter {
    useCurrentUser: typeof useCurrentUser;
    appVersion: string;
    gitSha: string;
    /** Caller passes payloadJson + optional screenshot + up to 5 user
     * attachments; we attach CSRF + cookies. */
    submitFeedback: (payloadJson: string, screenshot: Blob | null, attachments?: readonly File[]) => Promise<FeedbackReadShape>;
    downloadFeedbackBundle: (feedbackId: string) => Promise<{
        blob: Blob;
        filename: string;
    }>;
    getDeepLinkToFeedback: (id: string) => string;
    getDefaultRedactionSelectors: typeof getDefaultRedactionSelectors;
    registerRedactor: typeof registerRedactor;
    useTranslation: typeof useTranslation;
    /** Toast notifier — host-injected via bindings or console-only fallback. */
    toast: ToastApi;
}
declare function createAdapter(bindings: FeedbackHostBindings): FeedbackAdapter;

type FeedbackPosition = "bottom_right" | "bottom_left" | "top_right" | "top_left";
/** Style for how the iter pane is presented after the user clicks Iterate.
 *
 * - `"focus"` (default): the iter pane takes over the canvas, hides
 *   compose + the rest of the card feed, expands the Sheet to ~800px
 *   on lg+ to give the spec markdown room. Best for deep work.
 * - `"inline"`: legacy v0.4.0 behaviour — iter renders inside the
 *   expanded ticket card alongside the rest of the feed.
 */
type IterStyle = "focus" | "inline";
interface FeedbackConfig {
    /** Master kill-switch — when false the widget renders nothing. */
    enabled?: boolean;
    /** Floating button corner. */
    position?: FeedbackPosition;
    /** Optional brand color override (otherwise inherits the host CSS var). */
    brandPrimaryHex?: string;
    /** UI locale. Currently English-only; kept here for future locales. */
    locale?: "en";
    /** How to render the iter pane after the user clicks Iterate. */
    iterStyle?: IterStyle;
}
interface FeedbackProviderProps {
    children: ReactNode;
    /** Host-provided wiring — REQUIRED. See `FeedbackHostBindings`. */
    bindings: FeedbackHostBindings;
    /**
     * Override the default adapter (advanced — most hosts pass `bindings`
     * and let the provider build the adapter).
     */
    adapter?: FeedbackAdapter;
    /** Optional non-secret tuning (button position, locale, etc.). */
    config?: FeedbackConfig;
}
declare function FeedbackProvider({ children, bindings, adapter, config }: FeedbackProviderProps): react_jsx_runtime.JSX.Element;
declare function useFeedbackAdapter(): FeedbackAdapter;
declare function useFeedbackConfig(): Required<FeedbackConfig>;
declare function useFeedbackBindings(): FeedbackHostBindings;

/**
 * Idempotency key helper — extracted from the deleted legacy
 * ``client/iter.ts`` so the chat stream + any other widget caller can
 * still generate replay-safe keys without depending on the iter
 * surface (Sprint C deprecation).
 */
declare function newIdempotencyKey(): string;

export { type CaptureMode, CapturePicker, type CapturePickerProps, type CurrentUserSnapshot, type FeedbackAdapter, type FeedbackAttachmentRead, FeedbackButton, FeedbackButton as FeedbackButtonDefault, FeedbackChatSheet, type FeedbackChatSheetProps, type FeedbackConfig, type FeedbackHostBindings, type FeedbackListResponse, type FeedbackPosition, FeedbackProvider, type FeedbackRead, type FeedbackReadShape, type FeedbackStatus, type FeedbackStatusKey, type FeedbackStatusUpdate, type FeedbackTab, FeedbackTabs, type FeedbackTabsProps, type FeedbackType, type FeedbackTypeKey, FooterActions, type FooterActionsProps, type IterAssumptionRead, type IterAssumptionStatus, type IterPackageRead, type IterSessionRead, type IterSessionStatus, type IterVersionRead, type LockedElementInfo, MineFeedTab, type MineFeedTabProps, StatusPill, type StatusPillProps, SubmitFeedbackError, type Synthesis, SynthesisCard, type SynthesisCardProps, TicketDetail, type TicketDetailProps, type ToastApi, type ToastOptions, type Translator, VERSION, createAdapter, installConsoleWrap, installErrorWrap, installNetworkWrap, newIdempotencyKey, useCanTriageFeedback, useFeedbackAdapter, useFeedbackBindings, useFeedbackConfig };
