/**
 * VoiceRecorder — inline recording bar (Claude-AI voice pattern).
 *
 * Replaces the Composer while the user is recording or while the clip
 * is being transcribed. Shape mirrors the composer (rounded dark bar,
 * inline with the chat scroll area):
 *
 *   [ ✕ ]  [ … live waveform … ]  [ ✓ ]
 *
 * The waveform is 40 thin vertical bars whose height is driven each
 * animation frame by the AnalyserNode RMS values exposed by
 * `useVoiceCapture.getAudioLevels()`. We mutate the DOM directly via
 * refs — React never re-renders during recording, which keeps the
 * meter at 30 FPS regardless of host load.
 *
 * The 60s hard-cap is enforced inside `useVoiceCapture`; this bar shows
 * a tiny mm:ss counter on the right of the waveform so the user knows
 * roughly where they are without dominating the layout.
 */

import { Check, Loader2, X } from "lucide-react";
import { type ReactElement, useEffect, useRef } from "react";

import { Button } from "../ui/button";

import { AUDIO_LEVEL_BARS, type VoiceCaptureState } from "./useVoiceCapture";

export interface VoiceRecorderProps {
  state: VoiceCaptureState | "transcribing";
  duration_ms: number;
  /** Per-frame audio-level snapshot getter. Returns the SAME
   * Float32Array instance each call — the bar reads it on every rAF. */
  getAudioLevels: () => Float32Array;
  onStop: () => void;
  onCancel: () => void;
}

const _MAX_DURATION_MS = 60_000;

/** Minimum bar height (px) — silence still shows a flat line so the
 * meter looks "alive" instead of an empty strip. */
const _BAR_MIN_PX = 3;
/** Maximum bar height (px) — sized to fit inside the 32px tall meter. */
const _BAR_MAX_PX = 26;

function _formatMs(ms: number): string {
  const clamped = Math.max(0, Math.min(ms, _MAX_DURATION_MS));
  const seconds = Math.floor(clamped / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Waveform that mutates bar heights directly via refs — no React
 * re-renders during recording. */
function _Waveform({
  active,
  getAudioLevels,
}: {
  active: boolean;
  getAudioLevels: () => Float32Array;
}): ReactElement {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Freeze the meter at its last position when state flips to
      // stopping/transcribing — the user gets visual continuity.
      return;
    }

    const loop = () => {
      const levels = getAudioLevels();
      const bars = barRefs.current;
      // RTL flow: newest sample renders on the rightmost bar and the
      // wave appears to enter from the right + scroll left, matching
      // the convention used by Whisper / Apple voice memos / WhatsApp
      // voice notes. The hook's cursor is opaque, so we read the
      // buffer in reverse index order — bar[N-1] reads levels[0], etc.
      const last = bars.length - 1;
      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const level = levels[last - i] ?? 0;
        const px = Math.max(
          _BAR_MIN_PX,
          Math.round(_BAR_MIN_PX + level * (_BAR_MAX_PX - _BAR_MIN_PX)),
        );
        bar.style.height = `${px}px`;
      }
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, getAudioLevels]);

  return (
    <div className="flex flex-1 items-center justify-center gap-[2px] h-8 px-2" aria-hidden="true">
      {Array.from({ length: AUDIO_LEVEL_BARS }).map((_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional, never reordered, length is fixed
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className="w-[2px] rounded-full bg-foreground/80 transition-[height] duration-75"
          style={{ height: `${_BAR_MIN_PX}px` }}
        />
      ))}
    </div>
  );
}

export function VoiceRecorder({
  state,
  duration_ms,
  getAudioLevels,
  onStop,
  onCancel,
}: VoiceRecorderProps): ReactElement | null {
  if (state !== "recording" && state !== "stopping" && state !== "transcribing") return null;

  const isRecording = state === "recording";
  const isWorking = state === "stopping" || state === "transcribing";
  const timer = _formatMs(duration_ms);

  return (
    <output
      aria-live="polite"
      aria-label={isRecording ? "Recording" : "Transcribing"}
      data-feedback-id="feedback.voice_recorder"
      className="flex items-center gap-2 border-t border-input bg-background px-3 py-3"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={isWorking}
        aria-label="Discard recording"
        data-feedback-id="feedback.voice_cancel"
        className="rounded-full"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex-1 flex items-center gap-2 rounded-full bg-muted/40 px-2 py-1">
        {isWorking ? (
          <div className="flex flex-1 items-center justify-center gap-2 h-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Transcribing…</span>
          </div>
        ) : (
          <>
            <_Waveform active={isRecording} getAudioLevels={getAudioLevels} />
            <span
              className="shrink-0 pr-1 text-[10px] tabular-nums text-muted-foreground"
              aria-hidden="true"
            >
              {timer}
            </span>
          </>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        onClick={onStop}
        disabled={isWorking}
        aria-label="Stop and send"
        data-feedback-id="feedback.voice_stop"
        className="rounded-full"
      >
        <Check className="h-4 w-4" />
      </Button>
    </output>
  );
}
