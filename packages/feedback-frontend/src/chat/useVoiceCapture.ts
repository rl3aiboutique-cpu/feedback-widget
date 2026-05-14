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
 *
 * Waveform (Claude-AI inline bar): we tap the live MediaStream with a
 * Web Audio AnalyserNode and expose a `getAudioLevels()` getter that
 * returns a 40-slot circular buffer of normalised amplitudes (0..1). The
 * UI reads via `requestAnimationFrame` and mutates DOM directly — we do
 * NOT trigger a React re-render per frame.
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
  /** Snapshot the current audio-level buffer (length AUDIO_LEVEL_BARS).
   * Returned values are normalised 0..1. The buffer is the SAME array
   * each call — callers that hold a reference always see the latest
   * values without re-rendering. Read inside requestAnimationFrame and
   * mutate DOM directly. */
  getAudioLevels: () => Float32Array;
}

/** 30s hard-cap per D-005 — the recorder auto-stops at this mark. */
const _MAX_DURATION_MS = 30_000;

/** Tick interval for the duration counter (16Hz keeps the UI smooth
 * without burning a frame budget on a meter that only goes to 30s). */
const _TICK_INTERVAL_MS = 250;

/** Number of vertical bars in the waveform. Matches the visual count
 * the recorder bar renders — keeping it here makes the hook the single
 * source of truth. */
export const AUDIO_LEVEL_BARS = 40;

/** Throttle the AnalyserNode poll to ~30 FPS — half of 60 FPS. The eye
 * cannot see individual bar shifts faster than that, and skipping every
 * other frame halves CPU work. */
const _LEVEL_FRAME_INTERVAL_MS = 1000 / 30;

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

/** Resolve the AudioContext constructor across browsers — Safari ships
 * the webkit-prefixed name only. Returns null when no constructor is
 * available (e.g. test stubs, very old browsers); the caller silently
 * skips waveform analysis when that happens. */
function _getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
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

  // Waveform plumbing — AnalyserNode + a ref'd circular buffer the UI
  // reads each animation frame. We keep the SAME Float32Array instance
  // for the lifetime of the hook so consumers can hold a reference.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const levelsRef = useRef<Float32Array>(new Float32Array(AUDIO_LEVEL_BARS));
  const levelsCursorRef = useRef<number>(0);
  const levelRafRef = useRef<number | null>(null);
  const levelLastTsRef = useRef<number>(0);
  // Backed by an explicit ArrayBuffer so the resulting Uint8Array narrows
  // to Uint8Array<ArrayBuffer> — the only shape AnalyserNode's
  // getByteTimeDomainData accepts under TS 5.7+ strict typing.
  const analyserBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const _stopLevelLoop = useCallback(() => {
    if (levelRafRef.current !== null) {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(levelRafRef.current);
      }
      levelRafRef.current = null;
    }
    levelLastTsRef.current = 0;
  }, []);

  const _resetLevels = useCallback(() => {
    levelsRef.current.fill(0);
    levelsCursorRef.current = 0;
  }, []);

  const _disposeAudioGraph = useCallback(() => {
    _stopLevelLoop();
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    sourceRef.current = null;
    try {
      analyserRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    if (ctx) {
      // close() returns a Promise — we don't await it because cleanup
      // must be synchronous; the context tears down in the background.
      try {
        void ctx.close();
      } catch {
        /* already closed */
      }
    }
    audioCtxRef.current = null;
    analyserBufRef.current = null;
  }, [_stopLevelLoop]);

  const _cleanup = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    _disposeAudioGraph();
    _resetLevels();
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
  }, [_disposeAudioGraph, _resetLevels]);

  /** Per-frame loop: sample the analyser → RMS → push into the circular
   * buffer. Throttled to ~30 FPS. Direct DOM mutation in the consumer
   * keeps React out of the hot loop. */
  const _tickLevel = useCallback((ts: number) => {
    const analyser = analyserRef.current;
    const buf = analyserBufRef.current;
    if (!analyser || !buf) {
      levelRafRef.current = null;
      return;
    }
    const last = levelLastTsRef.current;
    if (last !== 0 && ts - last < _LEVEL_FRAME_INTERVAL_MS) {
      levelRafRef.current = window.requestAnimationFrame(_tickLevel);
      return;
    }
    levelLastTsRef.current = ts;

    // Time-domain data gives us a centred waveform in 0..255 with a
    // resting value of 128. RMS over the window approximates loudness
    // and is cheaper than an FFT-based approach.
    analyser.getByteTimeDomainData(buf);
    let sumSquares = 0;
    const bufLen = buf.length;
    for (let i = 0; i < bufLen; i++) {
      // `?? 128` keeps TS happy under noUncheckedIndexedAccess and is a
      // safe noop — i is bounded by buf.length so the read never misses.
      const sample = ((buf[i] ?? 128) - 128) / 128; // -1..1
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufLen); // 0..1
    // Mild compression — quiet rooms still register a flicker, loud
    // speech reaches ~1.0 without clipping the meter.
    const normalised = Math.min(1, Math.max(0, rms * 1.8));
    const cursor = levelsCursorRef.current;
    levelsRef.current[cursor] = normalised;
    levelsCursorRef.current = (cursor + 1) % AUDIO_LEVEL_BARS;

    levelRafRef.current = window.requestAnimationFrame(_tickLevel);
  }, []);

  const _startLevelLoop = useCallback(
    (stream: MediaStream) => {
      const Ctor = _getAudioContextCtor();
      if (!Ctor) return; // No Web Audio — silently skip waveform.
      try {
        const ctx = new Ctor();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256; // 128 time-domain samples — plenty for RMS
        analyser.smoothingTimeConstant = 0.6;
        src.connect(analyser);
        // Do NOT connect the analyser to ctx.destination — we don't want
        // to echo the mic back to the speakers.
        audioCtxRef.current = ctx;
        sourceRef.current = src;
        analyserRef.current = analyser;
        analyserBufRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        _resetLevels();
        levelLastTsRef.current = 0;
        levelRafRef.current = window.requestAnimationFrame(_tickLevel);
      } catch {
        // AudioContext construction or source creation can fail under
        // exotic permission models — degrade silently to no waveform.
        _disposeAudioGraph();
      }
    },
    [_disposeAudioGraph, _resetLevels, _tickLevel],
  );

  const getAudioLevels = useCallback(() => levelsRef.current, []);

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

    // Spin up the AnalyserNode + rAF loop. Failures here are silent —
    // the recorder still works without the waveform.
    _startLevelLoop(stream);

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
  }, [_cleanup, _startLevelLoop, state]);

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
    getAudioLevels,
  };
}
