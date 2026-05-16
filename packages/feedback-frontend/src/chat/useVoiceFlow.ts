/**
 * Voice capture state machine + Whisper round-trip — extracted from
 * useFeedbackChat so both the new-feedback sheet and the TicketDetail
 * reply path can share it. Owns:
 *
 *  - voiceCapture (MediaRecorder lifecycle + waveform levels)
 *  - upload to ``POST /chat/sessions/{sid}/voice`` (multipart)
 *  - language stickiness (first clip → auto-detect; later clips reuse)
 *  - transcript handoff via ``onTranscript(text, lang, viaVoice)``
 *
 * The caller owns the textarea state — this hook just produces the
 * transcript and lets the caller decide how to merge it (replace
 * composer value + autofocus + flag the next send as via=voice).
 */

import { useCallback, useState } from "react";

import type { FeedbackHostBindings } from "../adapter";

import { useVoiceCapture } from "./useVoiceCapture";

export type VoiceFlowState =
  | "idle"
  | "recording"
  | "transcribing"
  | "preview"
  | "error";

export interface UseVoiceFlowArgs {
  bindings: FeedbackHostBindings;
  /** Active chat session id. Voice upload requires it; the hook stays
   *  in "error" if start is called before the session exists. */
  sessionId: string | null;
  /** Called once Whisper returns a transcript. Caller is responsible
   *  for routing the text into the composer. */
  onTranscript: (text: string, lang: string) => void;
}

export interface UseVoiceFlowResult {
  state: VoiceFlowState;
  duration_ms: number;
  error: string | null;
  /** Live waveform amplitudes for the recorder UI. */
  getAudioLevels: () => Float32Array;
  startVoice: () => Promise<void>;
  stopVoice: () => Promise<void>;
  cancelVoice: () => void;
}

function _buildVoiceUrl(b: FeedbackHostBindings, sessionId: string): string {
  const base = b.apiBaseUrl.replace(/\/$/, "");
  const prefix = b.apiPathPrefix ?? "/api/v1/feedback";
  return `${base}${prefix}/chat/sessions/${encodeURIComponent(sessionId)}/voice`;
}

export function useVoiceFlow({
  bindings,
  sessionId,
  onTranscript,
}: UseVoiceFlowArgs): UseVoiceFlowResult {
  const voiceCapture = useVoiceCapture();
  const [state, setState] = useState<VoiceFlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stickyLang, setStickyLang] = useState("");

  const startVoice = useCallback(async () => {
    setError(null);
    setState("recording");
    await voiceCapture.startRecording();
    if (voiceCapture.state === "error" || voiceCapture.error) {
      setError(voiceCapture.error ?? "Microphone unavailable");
      setState("error");
    }
  }, [voiceCapture]);

  const cancelVoice = useCallback(() => {
    voiceCapture.cancelRecording();
    setError(null);
    setState("idle");
  }, [voiceCapture]);

  const stopVoice = useCallback(async () => {
    if (!sessionId) {
      setError("session not initialised");
      setState("error");
      return;
    }
    const result = await voiceCapture.stopRecording();
    if (!result || result.blob.size === 0) {
      setState("idle");
      return;
    }
    setState("transcribing");
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
      const ext = result.mime_type.includes("mp4")
        ? "m4a"
        : result.mime_type.includes("ogg")
          ? "ogg"
          : "webm";
      form.append("audio", result.blob, `clip.${ext}`);
      if (stickyLang) {
        form.append("language_hint", stickyLang);
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
        setError(`Voice transcription failed (${resp.status}): ${detail}`);
        setState("error");
        return;
      }
      const body = (await resp.json()) as { transcript: string; lang: string };
      const transcript = body.transcript ?? "";
      const lang = body.lang ?? "";
      if (lang) setStickyLang(lang);
      onTranscript(transcript, lang);
      setState("idle");
    } catch (err) {
      setError(String((err as Error).message ?? err));
      setState("error");
    }
  }, [bindings, sessionId, stickyLang, voiceCapture, onTranscript]);

  return {
    state,
    duration_ms: voiceCapture.duration_ms,
    error,
    getAudioLevels: voiceCapture.getAudioLevels,
    startVoice,
    stopVoice,
    cancelVoice,
  };
}
