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
import type { FeedbackHostBindings } from "../adapter";
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
import { useVoiceCapture } from "./useVoiceCapture";

/** Build the absolute URL for the confirm endpoint. Pure helper —
 * exported so the unit test can pin the path-prefix + encoding behaviour
 * without spinning up the whole hook. */
export function _buildConfirmUrl(bindings: FeedbackHostBindings, sessionId: string): string {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/confirm`;
}

/** Build the absolute URL for the abandon endpoint. Pure helper. */
export function _buildAbandonUrl(bindings: FeedbackHostBindings, sessionId: string): string {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/abandon`;
}

/** Build the absolute URL for the voice transcription endpoint (S4). */
export function _buildVoiceUrl(bindings: FeedbackHostBindings, sessionId: string): string {
  const base = bindings.apiBaseUrl.replace(/\/$/, "");
  const prefix = bindings.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/voice`;
}

/** State machine for the voice-input flow (S4).
 *
 *   idle          — no voice activity
 *   recording     — mic is hot, MediaRecorder running
 *   transcribing  — blob uploaded to /voice, awaiting Whisper response
 *   preview       — Whisper returned; user reviews/edits the transcript
 *   error         — terminal voice error (mic denied / Whisper 5xx)
 */
export type VoiceFlowState = "idle" | "recording" | "transcribing" | "preview" | "error";

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
  /** User accepted the synthesis card. POSTs /confirm and transitions to
   * `done` on 2xx (or `error` on 4xx/5xx). */
  confirmSynthesis: () => Promise<void>;
  /** Best-effort POST /abandon — called when the user closes the sheet
   * mid-conversation. Never throws, never changes UI state. */
  abandonSession: () => Promise<void>;
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

  // S4 voice flow — exposed so FeedbackChatSheet can mount the
  // VoiceRecorder + TranscriptionPreview overlays.
  voiceState: VoiceFlowState;
  voiceDurationMs: number;
  voiceTranscript: string;
  voiceLang: string;
  voiceError: string | null;
  /** Start a recording session (mic permission + MediaRecorder start). */
  startVoice: () => Promise<void>;
  /** Stop the recording → upload → preview the transcript. */
  stopVoice: () => Promise<void>;
  /** Send the (possibly edited) transcript into the chat as a normal
   * user turn with `via: "voice"`. */
  confirmVoiceTranscript: (text: string) => Promise<void>;
  /** Discard the recording or transcript and bounce back to text. */
  cancelVoice: () => void;
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

  // S4 — voice capture flow. The browser-side recorder lives in
  // `useVoiceCapture`; this hook orchestrates the upload + preview +
  // send sequence on top of it.
  const voiceCapture = useVoiceCapture();
  const [voiceState, setVoiceState] = useState<VoiceFlowState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceLang, setVoiceLang] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

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
    // S5b: POST /api/v1/feedback/chat/sessions/{sid}/confirm.
    // Persisted synthesis is used (no override editing in v1.0.0).
    if (!sessionId) {
      setOpenError("session not initialised");
      stream.setStateExternal("error");
      return;
    }
    stream.setStateExternal("finalizing");
    try {
      const url = _buildConfirmUrl(bindings, sessionId);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const csrf = await bindings.getCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
        /* ignore — degrade gracefully */
      }
      if (bindings.authHeader) {
        try {
          const auth = await bindings.authHeader();
          if (auth) headers.Authorization = auth;
        } catch {
          /* ignore — degrade gracefully */
        }
      }

      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ synthesis_override: null }),
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const data = (await resp.json()) as { detail?: unknown };
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
          /* response had no JSON body */
        }
        const msg = `No pudimos registrar tu feedback (${resp.status}). ${detail}`;
        setOpenError(msg);
        stream.setStateExternal("error");
        try {
          adapter.toast?.error?.(msg);
        } catch {
          /* host toast may throw — never let it bubble */
        }
        return;
      }

      const body = (await resp.json()) as { feedback_id: string; ticket_code: string };
      const ticket = body.ticket_code || "FB-?";
      stream.pushAssistantMessage(
        `✓ ¡Gracias! Tu feedback es ${ticket}. Te avisaremos cuando lo veamos.`,
      );
      stream.setStateExternal("done");
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      setOpenError(msg);
      stream.setStateExternal("error");
      try {
        adapter.toast?.error?.(msg);
      } catch {
        /* ignore */
      }
    }
  }, [bindings, stream, sessionId, adapter]);

  const abandonSession = useCallback(async () => {
    // Fire-and-forget: user closed the sheet mid-conversation. The
    // backend records the abandon so analytics + retention pick it up.
    // Never throw, never change UI state — the sheet is already gone.
    if (!sessionId) return;
    try {
      const url = _buildAbandonUrl(bindings, sessionId);
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
        method: "POST",
        credentials: "include",
        headers,
      });
      if (!resp.ok && typeof console !== "undefined") {
        console.warn(`[feedback-chat] abandon failed (${resp.status})`);
      }
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[feedback-chat] abandon network error", err);
      }
    }
  }, [bindings, sessionId]);

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

  // ── S4: voice capture flow ──────────────────────────────────────

  const startVoice = useCallback(async () => {
    setVoiceError(null);
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceState("recording");
    await voiceCapture.startRecording();
    // If start failed, the hook flips state=error; mirror it here so
    // the sheet shows the recorder error UI.
    if (voiceCapture.state === "error" || voiceCapture.error) {
      setVoiceError(voiceCapture.error ?? "Microphone unavailable");
      setVoiceState("error");
    }
  }, [voiceCapture]);

  const cancelVoice = useCallback(() => {
    voiceCapture.cancelRecording();
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceError(null);
    setVoiceState("idle");
  }, [voiceCapture]);

  const stopVoice = useCallback(async () => {
    if (!sessionId) {
      setVoiceError("session not initialised");
      setVoiceState("error");
      return;
    }
    const result = await voiceCapture.stopRecording();
    if (!result || result.blob.size === 0) {
      // Empty blob — likely a too-short tap; drop back to idle silently.
      setVoiceState("idle");
      return;
    }
    setVoiceState("transcribing");
    try {
      const url = _buildVoiceUrl(bindings, sessionId);
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

      const form = new FormData();
      // Filename extension hints Whisper toward the right codec when
      // content_type is generic.
      const ext = result.mime_type.includes("mp4")
        ? "m4a"
        : result.mime_type.includes("ogg")
          ? "ogg"
          : "webm";
      form.append("audio", result.blob, `clip.${ext}`);

      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: form,
      });
      if (!resp.ok) {
        let detail = resp.statusText;
        try {
          const data = (await resp.json()) as { detail?: unknown };
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {
          /* response had no JSON body */
        }
        const msg = `Voice transcription failed (${resp.status}): ${detail}`;
        setVoiceError(msg);
        setVoiceState("error");
        return;
      }
      const body = (await resp.json()) as { transcript: string; lang: string };
      setVoiceTranscript(body.transcript ?? "");
      setVoiceLang(body.lang ?? "");
      setVoiceState("preview");
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      setVoiceError(msg);
      setVoiceState("error");
    }
  }, [bindings, sessionId, voiceCapture]);

  const confirmVoiceTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setVoiceState("idle");
        return;
      }
      // Reset voice state BEFORE firing the send so the preview overlay
      // disappears immediately; the chat stream takes over.
      setVoiceTranscript("");
      setVoiceLang("");
      setVoiceState("idle");
      await stream.sendMessage(trimmed, "voice");
    },
    [stream],
  );

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
    abandonSession,
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
    voiceState,
    voiceDurationMs: voiceCapture.duration_ms,
    voiceTranscript,
    voiceLang,
    voiceError,
    startVoice,
    stopVoice,
    confirmVoiceTranscript,
    cancelVoice,
  };
}
