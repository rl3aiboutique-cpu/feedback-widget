/**
 * TranscriptionPreview — DEPRECATED in v1.0.0 chat-first.
 *
 * @deprecated Voice transcripts now land directly in the Composer
 * textarea (Claude-AI voice pattern). The user edits + sends inline via
 * the normal send button — no separate confirmation card. This file is
 * retained on disk so external hosts that still import it keep
 * compiling; it is NOT mounted by `FeedbackChatSheet` anymore. Physical
 * delete is scheduled for v1.1.0.
 *
 * Original v0 behaviour: the user just dictated a clip; the backend
 * transcribed it; the textarea surfaced the result and the user either
 * confirmed (sending into the chat with `via: "voice"`) or discarded.
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
