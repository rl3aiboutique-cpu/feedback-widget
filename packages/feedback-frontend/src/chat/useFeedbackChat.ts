/**
 * Top-level state hook for the chat-first feedback sheet.
 *
 * Owns:
 *   - Session lifecycle (POST /chat/sessions on open)
 *   - Auto-screenshot capture per D-007 (captured client-side, base64
 *     sent in /confirm body → backend uploads to S3 + creates
 *     FeedbackAttachment row in Sprint A Phase 5)
 *   - State machine transitions (idle → opening → awaiting_user → ...)
 *
 * Delegates streaming + message history to `useChatRunStream`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
 *   preview       — DEPRECATED in v1.0.0 chat-first: Whisper output now
 *                   lands directly in the Composer textarea, no separate
 *                   confirmation card. Kept in the type for backwards
 *                   compatibility with hosts that still introspect this
 *                   value; the hook itself no longer transitions into
 *                   `preview` — it goes idle the moment the transcript
 *                   is written into `composerValue`.
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
  // VoiceRecorder in place of the Composer while recording.
  voiceState: VoiceFlowState;
  voiceDurationMs: number;
  voiceTranscript: string;
  voiceLang: string;
  voiceError: string | null;
  /** Snapshot the current 40-slot waveform buffer (0..1 amplitudes).
   * Same array each call — read inside requestAnimationFrame. */
  getVoiceAudioLevels: () => Float32Array;
  /** Start a recording session (mic permission + MediaRecorder start). */
  startVoice: () => Promise<void>;
  /** Stop the recording → upload → write transcript into composer. */
  stopVoice: () => Promise<void>;
  /** Send the (possibly edited) transcript into the chat as a normal
   * user turn with `via: "voice"`. Retained for backwards compatibility
   * — no longer called by the new flow (transcript edit happens inline
   * in the Composer textarea). */
  confirmVoiceTranscript: (text: string) => Promise<void>;
  /** Discard the recording and bounce back to text. */
  cancelVoice: () => void;

  // ── Controlled Composer (Claude-AI voice pattern) ────────────────
  /** Current composer textarea value. The Composer is rendered as a
   * controlled input — the hook owns the buffer so the voice flow can
   * write transcripts into it. */
  composerValue: string;
  /** Update the composer value (parent → child during typing, hook
   * → composer during voice transcribed). */
  setComposerValue: (next: string) => void;
  /** Flips true for one render after `stopVoice` writes a transcript
   * into `composerValue` — the sheet forwards this as `autoFocus` so
   * the textarea receives focus + caret-at-end. */
  composerAutoFocus: boolean;
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
    // S3F shell-hybrid: forward the locked element so backend can hang
    // turn context (and downstream feedback row) off the right DOM node.
    // Sprint A Phase 2 promotes these to feedback.element_* columns.
    element_selector: args.locked?.selector ?? null,
    element_xpath: args.locked?.xpath ?? null,
    element_bounding_box: args.locked?.bounding_box ?? null,
  };
}

async function _blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function useFeedbackChat(): UseFeedbackChatResult {
  const bindings = useFeedbackBindings();
  const adapter = useFeedbackAdapter();
  const user = adapter.useCurrentUser();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const stream = useChatRunStream({ bindings, sessionId });
  const [overrideState, setOverrideState] = useState<ChatState | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  // Phase 5: auto-captured PNG blob held in state until confirm() wires
  // it into the request body as base64 → backend S3 upload.
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
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
  // `useVoiceCapture`; this hook orchestrates the upload + write-to-
  // composer sequence on top of it. In v1.0.0 chat-first the transcript
  // lands directly in the Composer textarea (no separate preview card),
  // so the user edits inline and sends with the normal send button.
  const voiceCapture = useVoiceCapture();
  const [voiceState, setVoiceState] = useState<VoiceFlowState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceLang, setVoiceLang] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Controlled Composer — the hook owns the buffer so the voice flow
  // can pre-fill it with a Whisper transcript. `composerAutoFocus`
  // pulses true for the render after the transcript lands and gets
  // cleared once the Composer's autoFocus effect has run.
  const [composerValue, setComposerValue] = useState("");
  const [composerAutoFocus, setComposerAutoFocus] = useState(false);
  // `composerFromVoice` flips true the moment a transcript lands in
  // the composer and flips back to false the moment the user touches
  // the textarea (or after a successful send). When true at send time
  // we forward `via: "voice"` to the backend; otherwise the send is
  // treated as typed text. This keeps the legacy analytics contract
  // intact through the new inline-edit flow.
  const composerFromVoiceRef = useRef(false);

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
      // so the user can still file the feedback. Phase 5: the resulting
      // blob is kept in component state until `confirmSynthesis` sends
      // it as base64 in the /confirm body.
      try {
        const result = await capturePageScreenshot({
          redactionSelectors: DEFAULT_REDACTION_SELECTORS,
        });
        if (result?.blob) {
          setScreenshotBlob(result.blob);
        }
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
    setComposerValue("");
    setComposerAutoFocus(false);
    setVoiceTranscript("");
    setVoiceLang("");
    setVoiceError(null);
    setVoiceState("idle");
    setScreenshotBlob(null);
    openingRef.current = false;
  }, [stream]);

  const sendUserMessage = useCallback(
    async (content: string) => {
      // The Composer trims + clears its own buffer via the controlled
      // value path — but defence-in-depth: also clear here so a
      // programmatic send from elsewhere doesn't leave a stale draft.
      const via = composerFromVoiceRef.current ? "voice" : "text";
      composerFromVoiceRef.current = false;
      setComposerValue("");
      await stream.sendMessage(content, via);
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

      let screenshotB64: string | null = null;
      if (screenshotBlob) {
        try {
          screenshotB64 = await _blobToBase64(screenshotBlob);
        } catch (err) {
          if (typeof console !== "undefined") {
            console.warn("[feedback-chat] screenshot encode failed", err);
          }
        }
      }
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          synthesis_override: null,
          screenshot_b64: screenshotB64,
          screenshot_content_type: screenshotB64 ? "image/png" : null,
        }),
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
  }, [bindings, stream, sessionId, adapter, screenshotBlob]);

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
      // Whisper language strategy (matches ChatGPT / Claude AI):
      // - 1st clip in a session: no hint → Whisper auto-detects.
      // - Subsequent clips: pass the previously-detected ISO-639-1 code
      //   as `language_hint` so Whisper locks faster + more accurately
      //   and code-switching to gibberish is less likely.
      // `voiceLang` is cleared on session reset / cancel, so a fresh
      // session always starts with auto-detect again.
      if (voiceLang) {
        form.append("language_hint", voiceLang);
      }

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
      const transcript = body.transcript ?? "";
      const lang = body.lang ?? "";
      setVoiceTranscript(transcript);
      setVoiceLang(lang);
      // Claude-AI voice pattern: write the transcript directly into the
      // composer and flip back to idle. The user edits + sends inline
      // via the normal send button — no separate confirmation card.
      if (transcript.length > 0) {
        // Append rather than overwrite so a user who started typing
        // before recording finished doesn't lose their draft. A single
        // space joiner keeps the result readable.
        setComposerValue((current) => {
          if (current.trim().length === 0) return transcript;
          return `${current.replace(/\s+$/, "")} ${transcript}`;
        });
        setComposerAutoFocus(true);
        // Tag the next send as voice unless the user edits the buffer.
        composerFromVoiceRef.current = true;
      }
      setVoiceState("idle");
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      setVoiceError(msg);
      setVoiceState("error");
    }
  }, [bindings, sessionId, voiceCapture]);

  const confirmVoiceTranscript = useCallback(
    async (text: string) => {
      // Backwards-compatible path — retained for hosts that still wire
      // the deprecated preview surface. The new flow writes the
      // transcript into composerValue and the user sends via the normal
      // send button; this helper is no longer called by the sheet.
      const trimmed = text.trim();
      if (!trimmed) {
        setVoiceState("idle");
        return;
      }
      setVoiceTranscript("");
      setVoiceLang("");
      setVoiceState("idle");
      await stream.sendMessage(trimmed, "voice");
    },
    [stream],
  );

  // Controlled-Composer plumbing. When the user edits the textarea,
  // clear the "from voice" tag so the next send is correctly classified
  // as typed text. A no-op change (same content) keeps the tag intact.
  const setComposerValueCb = useCallback((next: string) => {
    setComposerValue((current) => {
      if (next !== current) {
        composerFromVoiceRef.current = false;
      }
      return next;
    });
  }, []);

  // Clear the autoFocus pulse after one render — the Composer's
  // useEffect picks up the truthy value, focuses the textarea, and we
  // reset to false on the next paint so subsequent state changes don't
  // grab focus unexpectedly.
  useEffect(() => {
    if (!composerAutoFocus) return;
    // RAF defers the reset until after the Composer's autoFocus effect
    // runs — setting it back to false synchronously would race the
    // child effect.
    const id = window.requestAnimationFrame(() => {
      setComposerAutoFocus(false);
    });
    return () => window.cancelAnimationFrame(id);
  }, [composerAutoFocus]);

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
    getVoiceAudioLevels: voiceCapture.getAudioLevels,
    startVoice,
    stopVoice,
    confirmVoiceTranscript,
    cancelVoice,
    composerValue,
    setComposerValue: setComposerValueCb,
    composerAutoFocus,
  };
}
