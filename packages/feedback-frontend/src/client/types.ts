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

export type FeedbackStatus =
  | "open"
  | "in_review"
  | "in_progress"
  | "waiting_for_user"
  | "resolved"
  | "wont_fix"
  | "closed";

export type FeedbackSeverity = "blocker" | "major" | "minor" | "idea";

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

/**
 * One conversation entry inside ``feedback_ticket.messages``. The
 * backend appends entries in order; the frontend renders them as
 * chat bubbles. ``role`` discriminates the speaker: user, assistant
 * (LLM), or admin (injected via /admin-action).
 */
export interface FeedbackTimelineMessage {
  role: "user" | "assistant" | "admin";
  text: string;
  ts: string;
  /** Present on admin entries to attribute the message. */
  author_user_id?: string | null;
  /** Present on assistant entries that came from a synthesize turn. */
  mode?: "discover" | "synthesize";
}

export interface FeedbackRead {
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

/**
 * Body of POST /feedback/{id}/admin-action — atomic state change +
 * optional message injection (replaces the legacy comments POST).
 */
export interface FeedbackAdminActionPayload {
  to_status?: FeedbackStatus | null;
  message_text?: string | null;
  model_override?: string | null;
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
  is_complete?: boolean;
  completion_reason?: string | null;
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
  /** When present, the assumption is multiple-choice — UI renders
   * radio buttons over the listed options instead of an open
   * Confirm/Correct. */
  options?: string[] | null;
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
  | { type: "heartbeat" }
  | {
      // v0.4.6 — emitted when the backend's provider walks its
      // fallback chain mid-run (e.g. Gemini 503 → Gemma). The UI
      // surfaces a transient banner so the user knows the model
      // serving their iteration changed.
      type: "provider_fallback";
      from_model: string;
      to_model: string;
      reason: string;
    }
  | {
      // v0.5 (Block C) — single source of truth for the live model
      // serving the run. Emitted ONCE at stream start (with the
      // primary) AND ONCE after each fallback walk (with the new
      // active). Badge is a pure render of the latest event.
      type: "provider_active";
      model: string;
    };
