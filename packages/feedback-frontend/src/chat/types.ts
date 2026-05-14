/**
 * Frontend types for the chat-first feedback experience (v1.0.0).
 *
 * Mirrors the backend `chat_schemas.py` + `chat_turn_parser.py` wire
 * contract per D-015. Only the surface the frontend cares about — full
 * server-side fields (call audit, glossary snapshot, etc.) intentionally
 * not modelled here.
 */

export type ChatMode = "capture" | "refine";

/** Coverage scores per D-015. Range [0, 1]; 0.7+ triggers synthesis. */
export interface ChatCovered {
  problem: number;
  context: number;
  expectation: number;
  reality: number;
  impact: number;
  change: number;
  example: number;
  importance: number;
}

export interface ChatInferred {
  type: string;
  severity: string;
}

/** Synthesis card payload (D-015, terminal turn). */
export interface Synthesis {
  title: string;
  summary: string;
  user_story: string;
  context: string;
  user_need: string;
  acceptance_criteria: string[];
  open_questions: string[];
}

/** Server response from POST /chat/sessions. */
export interface ChatSessionCreateResponse {
  session_id: string;
  greeting: string;
  resume_available: boolean;
}

/** One parsed turn from the backend (turn_done event). */
export interface ChatTurn {
  mode: "discover" | "synthesize";
  reply: string;
  covered: ChatCovered;
  active_branch: string;
  inferred: ChatInferred | null;
  synthesis: Synthesis | null;
}

/** Rendered chat history entry. User messages have no parsed fields. */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
  mode?: "discover" | "synthesize";
  covered?: ChatCovered;
  active_branch?: string;
  inferred?: ChatInferred | null;
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
 * finalizing     — user confirmed, POST /confirm in flight (Batch B)
 * done           — feedback created; sheet about to close
 * error          — terminal error state
 */
export type ChatState =
  | "idle"
  | "opening"
  | "awaiting_user"
  | "user_typing"
  | "bot_thinking"
  | "synthesizing"
  | "confirming"
  | "finalizing"
  | "done"
  | "error";

/**
 * One entry in the collapsible "Conversaciones previas" header (S3C).
 *
 * The list merges two backend sources:
 *
 * * `kind="in_progress"`  — rows from `GET /chat/sessions/in-progress`
 *   that the user can resume mid-conversation (D-014).
 * * `kind="submitted"`    — rows from `GET /feedback/mine`, i.e. tickets
 *   the user already filed and may want to revisit.
 *
 * The two shapes are unified here so the header component can render
 * both with one mapping pass. S3E swaps the placeholder
 * `unread_admin_replies` heuristic for a real per-feedback comment
 * count.
 */
export interface PreviousConversationItem {
  kind: "in_progress" | "submitted";
  /** Present when `kind="in_progress"` — the chat session id. */
  session_id?: string;
  /** Present when `kind="submitted"` — the feedback row id. */
  feedback_id?: string;
  /** Present when `kind="submitted"` — short ticket label (e.g. `FB-0042`). */
  ticket_code?: string;
  /** Display title: feedback.title for submitted; preview/synthesis for in_progress. */
  title: string;
  /** Status string: feedback.status for submitted; "in_progress" placeholder for chat. */
  status?: string;
  /** ISO timestamp used for sort + relative-time rendering. */
  updated_at: string;
  /** Submitted only — count of admin comments after user's last view.
   * v1.0.0 placeholder: `1` when status is "in_progress", `0` otherwise.
   * S3E replaces this heuristic with a real comment-count lookup. */
  unread_admin_replies?: number;
}

/** Auto-context payload sent on session creation. Mirrors backend
 * `AutoContext` shape; only the fields the widget can produce client-side. */
export interface AutoContextPayload {
  url: string;
  route: string | null;
  viewport: { w: number; h: number; dpr: number } | null;
  app_version: string | null;
  git_commit_sha: string | null;
  user_role: string | null;
  console_tail: string[];
  /** CSS selector of the user-locked element (S3F shell-hybrid). Null
   * when the user is filing whole-page feedback. Sprint A Phase 2
   * promotes these to feedback.element_* columns on confirm. */
  element_selector?: string | null;
  element_xpath?: string | null;
  element_bounding_box?: { x: number; y: number; w: number; h: number } | null;
}
