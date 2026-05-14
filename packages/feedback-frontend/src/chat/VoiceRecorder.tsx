/**
 * VoiceRecorder — visual indicator for an active voice capture (S4).
 *
 * Shows 5 animated bars (waveform-ish), a `MM:SS / 00:30` timer, and a
 * red stop circle the user taps to end the recording. Visibility is
 * driven by the parent — this component renders only when the parent
 * passes `state === "recording"` or `"stopping"`.
 *
 * The 30s hard-cap is enforced inside `useVoiceCapture`, so the timer
 * here is purely informational.
 */

import { Square, X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "../ui/button";

import type { VoiceCaptureState } from "./useVoiceCapture";

export interface VoiceRecorderProps {
  state: VoiceCaptureState;
  duration_ms: number;
  onStop: () => void;
  onCancel: () => void;
}

const _MAX_DURATION_MS = 30_000;

function _formatMs(ms: number): string {
  const clamped = Math.max(0, Math.min(ms, _MAX_DURATION_MS));
  const seconds = Math.floor(clamped / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** 5 vertical bars whose height oscillates via CSS keyframes. The
 * delays stagger the bars so the waveform looks alive even though the
 * recorder produces no real per-frame amplitude data. */
function _Waveform({ active }: { active: boolean }): ReactElement {
  return (
    <div className="flex items-end gap-1 h-6" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-1 rounded-sm bg-destructive"
          style={{
            height: active ? `${30 + ((i * 17) % 70)}%` : "20%",
            animation: active
              ? `feedback-voice-bar 0.9s ease-in-out ${i * 0.12}s infinite alternate`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function VoiceRecorder({
  state,
  duration_ms,
  onStop,
  onCancel,
}: VoiceRecorderProps): ReactElement | null {
  if (state !== "recording" && state !== "stopping") return null;

  const isStopping = state === "stopping";
  const timer = _formatMs(duration_ms);

  return (
    <output
      className="flex items-center gap-3 border-t border-input bg-background px-3 py-3"
      aria-label={isStopping ? "Procesando grabación" : "Grabando"}
      data-feedback-id="feedback.voice_recorder"
    >
      {/* Inline keyframes — keeps the bundle from depending on a new
          stylesheet rule. The animation name is namespaced so it cannot
          collide with host CSS. */}
      <style>
        {`@keyframes feedback-voice-bar {
            0% { height: 18%; }
            50% { height: 80%; }
            100% { height: 32%; }
          }`}
      </style>

      <_Waveform active={!isStopping} />

      <div className="flex flex-col text-xs leading-tight">
        <span className="font-medium text-foreground">
          {isStopping ? "Procesando…" : "Grabando"}
        </span>
        <span className="tabular-nums text-muted-foreground">{timer} / 00:30</span>
      </div>

      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={isStopping}
        aria-label="Descartar grabación"
        data-feedback-id="feedback.voice_cancel"
      >
        <X className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={onStop}
        disabled={isStopping}
        aria-label="Detener grabación"
        data-feedback-id="feedback.voice_stop"
        className="rounded-full"
      >
        <Square className="h-4 w-4 fill-current" />
      </Button>
    </output>
  );
}
