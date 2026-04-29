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

export type FeedbackTypeKey =
  | "bug"
  | "new_feature"
  | "extend_feature"
  | "new_user_story"
  | "question"
  | "ux_polish"
  | "performance"
  | "data_issue"

export type FeedbackStatusKey =
  | "new"
  | "triaged"
  | "in_progress"
  | "done"
  | "wont_fix"
  | "accepted_by_user"
  | "rejected_by_user"

export interface CurrentUserSnapshot {
  /** Stable user identifier — UUID-as-string. */
  id: string
  email: string
  role: string
  /** Optional human display name; null when the host doesn't track one. */
  full_name?: string | null
  /** Optional active tenant; null for single-tenant hosts (sapphira). */
  tenant_id?: string | null
}

/**
 * Toast notifier the host injects via :class:`FeedbackHostBindings`.
 * When the host doesn't pass one, the widget falls back to a quiet
 * console-only stub so the package never imports a notifier library.
 */
export interface ToastOptions {
  /** Optional href the host can attach as a click action. */
  url?: string
  /** Optional plain-text label for the click action. */
  actionLabel?: string
}

export interface ToastApi {
  success(message: string, options?: ToastOptions): void
  error(message: string, options?: ToastOptions): void
  info(message: string, options?: ToastOptions): void
  warning(message: string, options?: ToastOptions): void
}

export interface LinkedUserStory {
  story: string
  acceptance_criteria?: string | null
  priority?: string | null
}

export interface FeedbackElementInfo {
  selector: string | null
  xpath: string | null
  bounding_box: { x: number; y: number; w: number; h: number } | null
}

export interface FeedbackCreatePayloadInput {
  type: FeedbackTypeKey
  title: string
  description: string
  url_captured: string
  route_name?: string | null
  element?: FeedbackElementInfo | null
  type_fields: Record<string, unknown>
  persona?: string | null
  linked_user_stories: LinkedUserStory[]
  metadata_bundle: Record<string, unknown>
  consent_metadata_capture: boolean
  app_version?: string | null
  git_commit_sha?: string | null
  user_agent?: string | null
  follow_up_email?: string | null
  parent_ticket_code?: string | null
}

export interface FeedbackAttachmentSummary {
  id: string
  kind: "screenshot" | "log_dump"
  bucket: string
  object_key: string
  content_type: string
  byte_size: number
  width: number | null
  height: number | null
  created_at: string | null
  presigned_url: string | null
}

export interface FeedbackReadShape {
  id: string
  tenant_id: string
  user_id: string
  type: FeedbackTypeKey
  status: FeedbackStatusKey
  title: string
  description: string
  url_captured: string
  route_name: string | null
  element_selector: string | null
  element_xpath: string | null
  element_bounding_box: Record<string, unknown> | null
  type_fields: Record<string, unknown>
  persona: string | null
  linked_user_stories: Record<string, unknown>[]
  metadata_bundle: Record<string, unknown>
  consent_metadata_capture: boolean
  app_version: string | null
  git_commit_sha: string | null
  user_agent: string | null
  created_at: string | null
  updated_at: string | null
  triaged_by: string | null
  triaged_at: string | null
  triage_note: string | null
  ticket_code: string
  follow_up_email: string | null
  parent_feedback_id: string | null
  parent_ticket_code: string | null
  attachments: FeedbackAttachmentSummary[]
}

/**
 * Translator returned by `useTranslation()`. The host can implement
 * variable interpolation via the optional `vars` object — inside the
 * default locale map we look for `{name}` placeholders.
 */
export type Translator = (key: string, vars?: Record<string, string>) => string
