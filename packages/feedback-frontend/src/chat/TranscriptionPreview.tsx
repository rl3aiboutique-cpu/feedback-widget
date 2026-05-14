/**
 * TranscriptionPreview — editable card that surfaces Whisper output
 * before it lands in the chat (S4).
 *
 * The user just dictated a clip; the backend transcribed it; now they
 * see the text in a textarea and either ✓ confirm (send into the chat
 * as a normal user turn with `via: "voice"`) or ✕ discard (drop the
 * transcript and bounce back to the composer without sending anything).
 *
 * Whisper occasionally misrecognises product names or homophones, so
 * the textarea is fully editable — `onSend` receives whatever the user
 * has at the moment they click Enviar.
 */

import { Check, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export interface TranscriptionPreviewProps {
  /** The raw transcript Whisper produced. Seeds the textarea state. */
  transcript: string;
  /** Detected language code (e.g. "es", "en"). Display-only. */
  lang?: string;
  /** Called with the final (possibly edited) text. */
  onSend: (text: string) => void | Promise<void>;
  /** Called when the user discards the transcript. */
  onCancel: () => void;
  /** Disables the buttons while a parent operation is in flight (e.g.
   * the SSE send started). Defaults to false. */
  disabled?: boolean;
}

export function TranscriptionPreview({
  transcript,
  lang,
  onSend,
  onCancel,
  disabled = false,
}: TranscriptionPreviewProps): ReactElement {
  const [value, setValue] = useState(transcript);

  // If the transcript prop changes (re-recording), reset the textarea.
  // We don't use `key={transcript}` upstream because the parent does not
  // remount the component on each preview — it just swaps the prop.
  useEffect(() => {
    setValue(transcript);
  }, [transcript]);

  const trimmed = value.trim();
  const canSend = !disabled && trimmed.length > 0;

  return (
    <section
      className="m-3 rounded-md border border-input bg-card p-3 shadow-sm"
      aria-label="Revisar transcripción"
      data-feedback-id="feedback.voice_preview"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Revisa la transcripción
          {lang ? ` · ${lang}` : ""}
        </span>
      </div>

      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="resize-none text-sm"
        disabled={disabled}
        data-feedback-id="feedback.voice_preview_text"
      />

      <div className="mt-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
          aria-label="Descartar transcripción"
          data-feedback-id="feedback.voice_preview_cancel"
        >
          <X className="mr-1 h-4 w-4" />
          Descartar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void onSend(trimmed)}
          disabled={!canSend}
          aria-label="Enviar transcripción"
          data-feedback-id="feedback.voice_preview_send"
        >
          <Check className="mr-1 h-4 w-4" />
          Enviar
        </Button>
      </div>
    </section>
  );
}
