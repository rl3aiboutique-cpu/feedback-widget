/**
 * Wire-shape types for the feedback widget.
 *
 * The shapes here intentionally mirror Pydantic schemas in
 * `feedback_widget.schemas` — keep them in sync.
 */

export type FeedbackType =
  | "bug"
  | "ui"
  | "performance"
  | "new_feature"
  | "extend_feature"
  | "other"

export type FeedbackStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "done"
  | "wont_fix"

export type FeedbackAttachmentKind = "screenshot" | "user_attachment"

export interface FeedbackAttachmentRead {
  id: string
  kind: FeedbackAttachmentKind
  bucket: string
  object_key: string
  content_type: string
  byte_size: number
  filename?: string | null
  width?: number | null
  height?: number | null
  created_at?: string | null
  presigned_url?: string | null
}

export interface FeedbackRead {
  id: string
  tenant_id: string | null
  user_id: string
  type: FeedbackType
  status: FeedbackStatus
  title: string
  description: string
  expected_outcome?: string | null
  url_captured: string
  route_name?: string | null
  element_selector?: string | null
  element_xpath?: string | null
  element_bounding_box?: Record<string, number> | null
  metadata_bundle: Record<string, unknown>
  app_version?: string | null
  git_commit_sha?: string | null
  user_agent?: string | null
  created_at?: string | null
  updated_at?: string | null
  triaged_by?: string | null
  triaged_at?: string | null
  triage_note?: string | null
  ticket_code: string
  attachments: FeedbackAttachmentRead[]
}

export interface FeedbackListResponse {
  data: FeedbackRead[]
  count: number
  page: number
  page_size: number
}

export interface FeedbackStatusUpdate {
  status: FeedbackStatus
  triage_note?: string | null
}

export type FeedbackCommentAuthorRole = "submitter" | "admin"

export interface FeedbackCommentRead {
  id: string
  feedback_id: string
  author_user_id: string
  author_role: FeedbackCommentAuthorRole
  body: string
  created_at?: string | null
}

export interface FeedbackCommentListResponse {
  data: FeedbackCommentRead[]
  count: number
}

export interface FeedbackCommentCreatePayload {
  body: string
}
