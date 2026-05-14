/**
 * useVoiceCapture — voice recording hook (S4, D-004 + D-005).
 *
 * Owns the browser-side recording lifecycle:
 *
 *   idle      → startRecording() asks for mic permission, starts a
 *               MediaRecorder, returns immediately
 *   recording → stopRecording() awaits the final blob, returns it
 *   stopping  → transient while the recorder flushes its last chunk
 *   error     → permission denied / MediaRecorder unsupported / etc.
 *
 * Hard auto-stop at 30s (D-005) — the cap is enforced here, not in the
 * UI, so an unmounted component can't run the recorder forever. The
 * backend ALSO enforces a 5MB cap as defence-in-depth.
 *
 * The blob's MIME type is browser-dependent: Chrome/Firefox/Edge produce
 * `audio/webm;codecs=opus`, Safari iOS produces `audio/mp4`. We pick the
 * first supported MIME via `MediaRecorder.isTypeSupported`. Callers
 * forward the blob's `type` field to the backend so Whisper picks the
 * right codec.
 *
 * Audio is NEVER persisted (D-013) — once the parent hook hands the blob
 * to the upload, this hook drops its reference.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceCaptureState = "idle" | "recording" | "stopping" | "error";

export interface VoiceCaptureBlob {
  blob: Blob;
  duration_ms: number;
  mime_type: string;
}

export interface UseVoiceCaptureResult {
  state: VoiceCaptureState;
  /** Live ms since recording started. 0 when idle / stopping / error. */
  duration_ms: number;
  /** Human-readable detail when state === "error". Null otherwise. */
  error: string | null;
  /** Begin recording. Resolves once the recorder is actually running. */
  startRecording: () => Promise<void>;
  /** Stop recording and return the produced blob + duration. */
  stopRecording: () => Promise<VoiceCaptureBlob | null>;
  /** Discard the recording — never resolves a blob. */
  cancelRecording: () => void;
}

/** 30s hard-cap per D-005 — the recorder auto-stops at this mark. */
const _MAX_DURATION_MS = 30_000;

/** Tick interval for the duration counter (16Hz keeps the UI smooth
 * without burning a frame budget on a meter that only goes to 30s). */
const _TICK_INTERVAL_MS = 250;

/** Codec preference order. We pick the first supported by the browser.
 * Safari iOS only supports MP4; everyone else gets opus-in-webm. */
const _PREFERRED_MIME_TYPES: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/** Browser-feature-detect: is MediaRecorder available + getUserMedia
 * reachable. Hosts mounted over HTTP (not HTTPS) on a non-localhost
 * origin will return false here. Composer hides the mic when this is
 * false so the chat still works text-only. */
export function isVoiceCaptureSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.MediaRecorder === "undefined") return false;
  const md = window.navigator?.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return false;
  return true;
}

function _pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const mt of _PREFERRED_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(mt)) return mt;
    } catch {
      // Some Safari builds throw on isTypeSupported — keep searching.
    }
  }
  return "audio/webm";
}

export function useVoiceCapture(): UseVoiceCaptureResult {
  const [state, setState] = useState<VoiceCaptureState>("idle");
  const [duration_ms, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Imperative refs — recorder + stream + timers MUST NOT trigger
  // re-renders when they change, only the state above should.
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickTimerRef = useRef<number | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);
  const stopResolverRef = useRef<((b: VoiceCaptureBlob | null) => void) | null>(null);

  const _cleanup = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          /* track already stopped */
        }
      }
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
  }, []);

  useEffect(() => {
    // Cleanup on unmount — release the mic stream even if the host
    // closes the sheet mid-recording.
    return () => {
      _cleanup();
    };
  }, [_cleanup]);

  const startRecording = useCallback(async () => {
    if (!isVoiceCaptureSupported()) {
      setError("Voice recording is not supported in this browser.");
      setState("error");
      return;
    }
    if (state === "recording" || state === "stopping") return;

    setError(null);
    setDurationMs(0);

    let stream: MediaStream;
    try {
      stream = await window.navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      setError(`Microphone access denied: ${msg}`);
      setState("error");
      return;
    }

    const mimeType = _pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      // Some browsers reject our preferred MIME — retry with defaults.
      try {
        recorder = new MediaRecorder(stream);
      } catch (err2) {
        for (const track of stream.getTracks()) track.stop();
        const msg = (err2 as Error)?.message ?? String(err2);
        setError(`MediaRecorder unavailable: ${msg}`);
        setState("error");
        return;
      }
      // err is intentionally swallowed — the fallback succeeded.
      void err;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };

    recorder.onstop = () => {
      const usedType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: usedType });
      const elapsed = startedAtRef.current === 0 ? 0 : Date.now() - startedAtRef.current;
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      _cleanup();
      setState("idle");
      setDurationMs(0);
      if (resolver) {
        if (blob.size === 0) {
          resolver(null);
        } else {
          resolver({ blob, duration_ms: elapsed, mime_type: usedType });
        }
      }
    };

    recorder.onerror = (ev: Event) => {
      const detail = (ev as ErrorEvent)?.message ?? "MediaRecorder error";
      setError(detail);
      setState("error");
      const resolver = stopResolverRef.current;
      stopResolverRef.current = null;
      _cleanup();
      if (resolver) resolver(null);
    };

    recorderRef.current = recorder;
    streamRef.current = stream;
    startedAtRef.current = Date.now();

    try {
      recorder.start();
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      _cleanup();
      setError(`Failed to start recorder: ${msg}`);
      setState("error");
      return;
    }

    setState("recording");

    // Tick the duration meter for the UI.
    tickTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setDurationMs(elapsed);
    }, _TICK_INTERVAL_MS);

    // Auto-stop at 30s — clears its own timer via the recorder's onstop.
    autoStopTimerRef.current = window.setTimeout(() => {
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        setState("stopping");
        try {
          r.stop();
        } catch {
          /* already stopping */
        }
      }
    }, _MAX_DURATION_MS);
  }, [_cleanup, state]);

  const stopRecording = useCallback(async (): Promise<VoiceCaptureBlob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return null;
    }
    setState("stopping");
    return new Promise<VoiceCaptureBlob | null>((resolve) => {
      stopResolverRef.current = resolve;
      try {
        recorder.stop();
      } catch {
        // onstop won't fire — resolve null directly.
        stopResolverRef.current = null;
        _cleanup();
        setState("idle");
        resolve(null);
      }
    });
  }, [_cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    // Pending stopRecording() promises resolve null — caller drops blob.
    const resolver = stopResolverRef.current;
    stopResolverRef.current = null;
    _cleanup();
    setState("idle");
    setDurationMs(0);
    setError(null);
    if (resolver) resolver(null);
  }, [_cleanup]);

  return {
    state,
    duration_ms,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
