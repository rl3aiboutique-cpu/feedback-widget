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
  | "other";

export type FeedbackStatus = "new" | "triaged" | "in_progress" | "done" | "wont_fix";

export type FeedbackAttachmentKind = "screenshot" | "user_attachment";

export interface FeedbackAttachmentRead {
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

export interface FeedbackRead {
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

export interface FeedbackListResponse {
  data: FeedbackRead[];
  count: number;
  page: number;
  page_size: number;
}

export interface FeedbackStatusUpdate {
  status: FeedbackStatus;
  triage_note?: string | null;
}

export type FeedbackCommentAuthorRole = "submitter" | "admin";

export interface FeedbackCommentRead {
  id: string;
  feedback_id: string;
  author_user_id: string;
  author_role: FeedbackCommentAuthorRole;
  body: string;
  created_at?: string | null;
}

export interface FeedbackCommentListResponse {
  data: FeedbackCommentRead[];
  count: number;
}

export interface FeedbackCommentCreatePayload {
  body: string;
}

// ─────────────────────────────────────────────────────────────────
// Iterate-with-AI module — wire types
// (mirrors `feedback_widget.iter_schemas` on the backend)
// ─────────────────────────────────────────────────────────────────

export type IterSessionStatus = "draft" | "iterating" | "finalized" | "abandoned";

export type IterCallStatus =
  | "success"
  | "json_invalid"
  | "timeout"
  | "provider_error"
  | "cancelled";

export type IterAssumptionKind = "technical" | "business" | "ux" | "scope";
export type IterAssumptionStatus = "open" | "confirmed" | "corrected" | "irrelevant";

export interface IterSessionRead {
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
}

export type IterDiffOp =
  | { op: "add"; path: string; value: unknown; note?: string | null }
  | {
      op: "modify";
      path: string;
      before: unknown;
      after: unknown;
      note?: string | null;
    }
  | { op: "remove"; path: string; before: unknown; note: string }
  | { op: "mark_obsolete"; path: string; reason: string };

export interface IterVersionRead {
  id: string;
  session_id: string;
  version_number: number;
  parent_version_id: string | null;
  user_message: string;
  restructure_allowed: boolean;
  output_markdown: string;
  diff_json: IterDiffOp[];
  changes_summary: string;
  created_at: string;
}

export interface IterAssumptionRead {
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
  created_at: string;
}

export interface IterCallRead {
  id: string;
  session_id: string;
  version_id: string | null;
  model_id: string;
  model_provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string | null;
  latency_ms: number;
  status: IterCallStatus;
  attempt_number: number;
  error_message: string | null;
  prompt_sha256: string;
  created_at: string;
}

export interface IterPackageRead {
  id: string;
  session_id: string;
  final_version_id: string;
  minio_zip_key: string;
  minio_folder_prefix: string;
  byte_size_zip: number;
  created_at: string;
  presigned_zip_url: string | null;
}

export interface IterUsageRead {
  user_id: string;
  used_this_week: number;
  weekly_limit: number;
  remaining_this_week: number;
  window_resets_at: string;
}

export interface IterStartRequest {
  feedback_id: string;
}

export interface IterRunRequest {
  user_message: string;
  restructure_allowed: boolean;
}

export interface IterAssumptionResolveRequest {
  status: "confirmed" | "corrected" | "irrelevant";
  user_response?: string | null;
}

export interface IterVersionMarkdownEditRequest {
  output_markdown: string;
}

export interface IterRateLimitErrorBody {
  error: "rate_limited";
  scope: "session" | "user_week";
  limit: number;
  current: number;
  retry_after_seconds: number;
}

// Discriminated union of SSE events the run-iteration endpoint
// streams. The frontend reducer uses the `type` field to route.
export type IterStreamEvent =
  | { type: "token"; chunk: string }
  | {
      type: "section";
      section: "personas" | "user_stories" | "spec" | "diagram" | "assumptions";
    }
  | { type: "done"; version_id: string; version_number: number }
  | { type: "error"; error_code: string; message: string }
  | { type: "heartbeat" };
