/**
 * Top-level state hook for the chat-first feedback sheet.
 *
 * Owns:
 *   - Session lifecycle (POST /chat/sessions on open)
 *   - Auto-screenshot capture per D-007 (captured client-side; upload
 *     to backend deferred to Batch B once `screenshot_attachment_id`
 *     plumbing lands)
 *   - State machine transitions (idle → opening → awaiting_user → ...)
 *
 * Delegates streaming + message history to `useChatRunStream`.
 */

import { useCallback, useRef, useState } from "react";

import { useFeedbackAdapter, useFeedbackBindings } from "../FeedbackProvider";
import { capturePageScreenshot } from "../capture/screenshot";
import { DEFAULT_REDACTION_SELECTORS } from "../redactors";
import type { CaptureMode, LockedElementInfo } from "./CapturePicker";
import type { FeedbackTab } from "./FeedbackTabs";
import type {
  AutoContextPayload,
  ChatMessage,
  ChatSessionCreateResponse,
  ChatState,
  PreviousConversationItem,
  Synthesis,
} from "./types";
import { useChatRunStream } from "./useChatRunStream";

export interface UseFeedbackChatResult {
  state: ChatState;
  messages: ChatMessage[];
  partialText: string;
  synthesis: Synthesis | null;
  error: string | null;
  /** Open the sheet → screenshot → create session → seed greeting. */
  openSheet: () => Promise<void>;
  /** Reset session + history (called when sheet closes). */
  closeSheet: () => void;
  /** Send a user message into the streaming endpoint. */
  sendUserMessage: (content: string) => Promise<void>;
  /** User accepted the synthesis card. Batch B stubs the POST /confirm
   * call until S5 lands the backend endpoint. */
  confirmSynthesis: () => Promise<void>;
  /** User asked to refine the synthesis. Drops the card and re-enters
   * the discover loop with a follow-up question (D-012). */
  adjustSynthesis: () => void;
  /** Rebuild the timeline from a previous conversation the user clicked
   * in the "Conversaciones previas" header (S3C). For an in-progress
   * chat we fetch `GET /chat/sessions/{sid}` and seed messages /
   * synthesis. For a submitted ticket we drop a placeholder bot turn
   * so the user sees context immediately; S3E wires real comments. */
  loadConversation: (item: PreviousConversationItem) => Promise<void>;
  /** Reset everything to a fresh capture session (drops session id,
   * messages, synthesis, error) and re-runs the open flow so a new
   * server-side session is created. */
  newConversation: () => Promise<void>;
  // S3F shell-hybrid additions — capture-mode + locked-element + tab state
  // exposed so the OLD chrome (CapturePicker + FeedbackTabs) wrapping
  // the chat zone is fully driven from this single hook.
  captureMode: CaptureMode;
  lockedElement: LockedElementInfo | null;
  activeTab: FeedbackTab;
  setMode: (mode: CaptureMode) => void;
  clearLocked: () => void;
  acceptLocked: (info: LockedElementInfo) => void;
  selectTab: (tab: FeedbackTab) => void;
}

function _buildAutoContext(args: {
  appVersion: string;
  gitSha: string;
  userRole: string | null;
  locked: LockedElementInfo | null;
}): AutoContextPayload {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
      : "";
  const route =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search + window.location.hash
      : null;
  const viewport =
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
      : null;
  return {
    url,
    route,
    viewport,
    app_version: args.appVersion || null,
    git_commit_sha: args.gitSha || null,
    user_role: args.userRole,
    console_tail: [],
    // Batch A: client captures screenshot but does NOT upload. Batch B
    // adds the multipart/form-data upload → returns attachment_id →
    // wires it through this field. TODO(S3-B).
    screenshot_attachment_id: null,
    // S3F shell-hybrid: forward the locked element so backend can hang
    // turn context (and downstream feedback row) off the right DOM node.
    // Backend pydantic config ignores unknown fields today (S5 lands
    // first-class support).
    element_selector: args.locked?.selector ?? null,
    element_xpath: args.locked?.xpath ?? null,
    element_bounding_box: args.locked?.bounding_box ?? null,
  };
}

export function useFeedbackChat(): UseFeedbackChatResult {
  const bindings = useFeedbackBindings();
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const stream = useChatRunStream({ bindings, sessionId });
  const [overrideState, setOverrideState] = useState<ChatState | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  /** Prevents double-open on rapid sheet toggles. */
  const openingRef = useRef(false);

  // S3F shell-hybrid — capture-mode + locked element + active tab.
  // Lifted up from the OLD chrome so the new sheet drives both the
  // CAPTURE picker (Whole page / Select element) and the tab strip
  // (Nuevo feedback / Mis feedbacks) from this hook.
  const [captureMode, setCaptureMode] = useState<CaptureMode>("page");
  const [lockedElement, setLockedElement] = useState<LockedElementInfo | null>(null);
  const [activeTab, setActiveTab] = useState<FeedbackTab>("compose");

  const setMode = useCallback((mode: CaptureMode) => {
    setCaptureMode(mode);
  }, []);

  const clearLocked = useCallback(() => {
    setLockedElement(null);
    setCaptureMode("page");
  }, []);

  const acceptLocked = useCallback((info: LockedElementInfo) => {
    setLockedElement(info);
    setCaptureMode("element");
  }, []);

  const selectTab = useCallback((tab: FeedbackTab) => {
    setActiveTab(tab);
  }, []);

  const openSheet = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOverrideState("opening");
    setOpenError(null);
    try {
      // Auto-screenshot — D-007. The widget is excluded from the capture
      // via the `data-feedback-widget-root="true"` filter inside
      // `capturePageScreenshot`. Failures are non-fatal: log and proceed
      // so the user can still file the feedback.
      try {
        await capturePageScreenshot({
          redactionSelectors: DEFAULT_REDACTION_SELECTORS,
        });
        // Screenshot blob is discarded for now — Batch B will upload it
        // via multipart and pass the resulting attachment_id through
        // auto_context.screenshot_attachment_id.
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[feedback-chat] screenshot capture failed", err);
        }
      }

      const auto_context = _buildAutoContext({
        appVersion: adapter.appVersion,
        gitSha: adapter.gitSha,
        userRole: user?.role ?? null,
        locked: lockedElement,
      });

      const base = bindings.apiBaseUrl.replace(/\/$/, "");
      const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
      const url = `${base}${prefix}/chat/sessions`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const csrf = await bindings.getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
        /* ignore */
      }
      if (bindings.authHeader) {
        try {
          const auth = await bindings.authHeader();
          if (auth) headers.Authorization = auth;
        } catch {
          /* ignore */
        }
      }

      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ mode: "capture", auto_context }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        throw new Error(`create session failed (${resp.status}): ${detail || resp.statusText}`);
      }
      const body = (await resp.json()) as ChatSessionCreateResponse;
      setSessionId(body.session_id);
      stream.pushAssistantGreeting(body.greeting);
      setOverrideState(null);
    } catch (err) {
      setOpenError(String((err as Error).message ?? err));
      setOverrideState("error");
    } finally {
      openingRef.current = false;
    }
  }, [adapter.appVersion, adapter.gitSha, bindings, stream, user?.role, lockedElement]);

  const closeSheet = useCallback(() => {
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    openingRef.current = false;
  }, [stream]);

  const sendUserMessage = useCallback(
    async (content: string) => {
      await stream.sendMessage(content);
    },
    [stream],
  );

  const confirmSynthesis = useCallback(async () => {
    // TODO(S5): replace with real POST /api/v1/feedback/chat/sessions/{sid}/confirm.
    // For Batch B we stub the round-trip so the UX is fully exercisable
    // end-to-end: flip to `finalizing` for a tick, push a thank-you turn,
    // then flip to `done`. The sheet auto-dismisses on `done` from the
    // parent component.
    stream.setStateExternal("finalizing");
    // Tiny micro-delay so the disabled state is visible even on a fast
    // network — keeps the UX honest with the future real call.
    await new Promise((r) => setTimeout(r, 250));
    stream.pushAssistantMessage("¡Gracias! Hemos registrado tu feedback.");
    stream.setStateExternal("done");
  }, [stream]);

  const loadConversation = useCallback(
    async (item: PreviousConversationItem) => {
      if (item.kind === "submitted") {
        // S3E owns the real comments-inline rendering. For S3C we drop
        // a placeholder bot turn so the user sees ticket context as
        // soon as they click the row — keeps the chat surface honest
        // about state without lying about features that ship next.
        const code = item.ticket_code ?? "—";
        const status = item.status ?? "—";
        const text = `Este es el ticket ${code} — ${item.title}. Estado: ${status}. (Los comentarios inline llegan en S3E.)`;
        setSessionId(null);
        stream.seedConversation({
          messages: [{ role: "assistant", text, ts: Date.now() }],
          synthesis: null,
          nextState: "awaiting_user",
        });
        setOverrideState(null);
        setOpenError(null);
        return;
      }

      // kind === "in_progress" — fetch session detail and rebuild.
      const sid = item.session_id;
      if (!sid) {
        setOpenError("session id missing on previous conversation item");
        setOverrideState("error");
        return;
      }
      setOverrideState("opening");
      setOpenError(null);
      try {
        const base = bindings.apiBaseUrl.replace(/\/$/, "");
        const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
        const url = `${base}${prefix}/chat/sessions/${encodeURIComponent(sid)}`;
        const headers: Record<string, string> = {};
        try {
          const csrf = await bindings.getCsrfToken();
          if (csrf) headers["X-CSRF-Token"] = csrf;
        } catch {
          /* ignore */
        }
        if (bindings.authHeader) {
          try {
            const auth = await bindings.authHeader();
            if (auth) headers.Authorization = auth;
          } catch {
            /* ignore */
          }
        }

        const resp = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers,
        });
        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          throw new Error(`resume session failed (${resp.status}): ${detail || resp.statusText}`);
        }
        const body = (await resp.json()) as {
          messages: Array<Record<string, unknown>>;
          synthesis_json: Synthesis | null;
          status: string;
        };

        // Map server-side messages (ts = ISO string) to the frontend's
        // ChatMessage shape (ts = epoch ms). Filter to known roles only.
        const messages: ChatMessage[] = [];
        for (const m of body.messages ?? []) {
          const role = m.role === "user" || m.role === "assistant" ? m.role : null;
          if (!role) continue;
          const text = typeof m.text === "string" ? m.text : "";
          const ts = typeof m.ts === "string" ? Date.parse(m.ts) || Date.now() : Date.now();
          const msg: ChatMessage = { role, text, ts };
          if (role === "assistant") {
            if (m.mode === "discover" || m.mode === "synthesize") msg.mode = m.mode;
            if (typeof m.active_branch === "string") msg.active_branch = m.active_branch;
            if (m.covered && typeof m.covered === "object") {
              msg.covered = m.covered as ChatMessage["covered"];
            }
            if (m.inferred && typeof m.inferred === "object") {
              msg.inferred = m.inferred as ChatMessage["inferred"];
            }
          }
          messages.push(msg);
        }

        // If the server still has a pending synthesis (awaiting_confirm),
        // surface the card so the user can resume the decision.
        const synth = body.synthesis_json ?? null;
        const nextState: ChatState =
          synth && body.status === "awaiting_confirm" ? "confirming" : "awaiting_user";

        setSessionId(sid);
        stream.seedConversation({ messages, synthesis: synth, nextState });
        setOverrideState(null);
      } catch (err) {
        setOpenError(String((err as Error).message ?? err));
        setOverrideState("error");
      }
    },
    [bindings, stream],
  );

  const newConversation = useCallback(async () => {
    // Clear local state first so the timeline blanks immediately, then
    // re-run the open flow (which calls POST /chat/sessions). openSheet
    // already guards against re-entry via openingRef.
    stream.reset();
    setSessionId(null);
    setOverrideState(null);
    setOpenError(null);
    await openSheet();
    // openSheet is captured below; including it in deps would create a
    // cycle. The outer parent component is responsible for triggering
    // newConversation explicitly, never as part of a render.
  }, [stream, openSheet]);

  const adjustSynthesis = useCallback(() => {
    // D-012: Ajustar never opens an inline form. It re-injects a bot
    // question and hands control back to the composer so the user can
    // describe what they want to change in their own words. The next
    // synthesize turn from the backend will replace the dropped synthesis.
    stream.clearSynthesis();
    stream.pushAssistantMessage("¿Qué cambiarías del resumen?");
    stream.setStateExternal("awaiting_user");
  }, [stream]);

  const effectiveState: ChatState = overrideState ?? stream.state;
  const effectiveError = openError ?? stream.error;

  return {
    state: effectiveState,
    messages: stream.messages,
    partialText: stream.partial_text,
    synthesis: stream.synthesis,
    error: effectiveError,
    openSheet,
    closeSheet,
    sendUserMessage,
    confirmSynthesis,
    adjustSynthesis,
    loadConversation,
    newConversation,
    captureMode,
    lockedElement,
    activeTab,
    setMode,
    clearLocked,
    acceptLocked,
    selectTab,
  };
}
