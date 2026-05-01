import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode } from 'react';

/** Package version — keep in sync with package.json. */
declare const VERSION = "0.1.0";

declare function useCanTriageFeedback(): boolean;

/**
 * Admin triage page — lives INSIDE the widget folder so the host's
 * route file is a thin wrapper. When the widget is extracted to
 * another web app, this page comes along.
 *
 * Permissions: this component currently checks ``user.role ===
 * "MASTER_ADMIN"`` via the adapter. If a host wants a different gate,
 * they wrap or replace the adapter's ``useCurrentUser``.
 *
 * Data fetching goes through the adapter hooks so the SDK is not
 * imported directly here.
 */
declare function FeedbackTriagePage(): React.ReactElement;

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
type FeedbackStatusKey = "new" | "triaged" | "in_progress" | "done" | "wont_fix";
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

/**
 * Wire-shape types for the feedback widget.
 *
 * The shapes here intentionally mirror Pydantic schemas in
 * `feedback_widget.schemas` — keep them in sync.
 */
type FeedbackType = "bug" | "ui" | "performance" | "new_feature" | "extend_feature" | "other";
type FeedbackStatus = "new" | "triaged" | "in_progress" | "done" | "wont_fix";
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
interface FeedbackRead {
    id: string;
    tenant_id: string | null;
    user_id: string;
    type: FeedbackType;
    status: FeedbackStatus;
    title: string;
    description: string;
    expected_outcome?: string | null;
    url_captured: string;
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
    triaged_by?: string | null;
    triaged_at?: string | null;
    triage_note?: string | null;
    ticket_code: string;
    attachments: FeedbackAttachmentRead[];
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
interface FeedbackConfig {
    /** Master kill-switch — when false the widget renders nothing. */
    enabled?: boolean;
    /** Floating button corner. */
    position?: FeedbackPosition;
    /** Optional brand color override (otherwise inherits the host CSS var). */
    brandPrimaryHex?: string;
    /** UI locale. Currently English-only; kept here for future locales. */
    locale?: "en";
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

export { type CurrentUserSnapshot, type FeedbackAdapter, type FeedbackAttachmentRead, FeedbackButton, FeedbackButton as FeedbackButtonDefault, type FeedbackConfig, type FeedbackHostBindings, type FeedbackListResponse, type FeedbackPosition, FeedbackProvider, type FeedbackRead, type FeedbackReadShape, type FeedbackStatus, type FeedbackStatusKey, type FeedbackStatusUpdate, FeedbackTriagePage, type FeedbackType, type FeedbackTypeKey, SubmitFeedbackError, type ToastApi, type ToastOptions, type Translator, VERSION, createAdapter, useCanTriageFeedback, useFeedbackAdapter, useFeedbackBindings, useFeedbackConfig };
