/**
 * Input bar for the chat-first feedback sheet.
 *
 * Textarea + send button + mic toggle (S4). Enter (without Shift) sends;
 * Shift+Enter inserts a newline. Disabled while the bot is mid-stream
 * so the user can't fire two turns in parallel.
 *
 * The mic button is hidden when the browser doesn't support
 * `MediaRecorder` + `getUserMedia` (Safari < 14, HTTP-only origins) so
 * the chat still works text-only.
 */

import { Mic, SendHorizontal } from "lucide-react";
import { type KeyboardEvent, type ReactElement, useCallback, useState } from "react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

import { isVoiceCaptureSupported } from "./useVoiceCapture";

export interface ComposerProps {
  /** Called with the trimmed message. Returns when the request was dispatched. */
  onSend: (content: string) => Promise<void> | void;
  /** Disables the input while the bot is thinking / synthesizing. */
  disabled?: boolean;
  placeholder?: string;
  /** Called when the user taps the mic button. Parent toggles into
   * recording mode. When omitted, the mic button is hidden — keeps
   * pre-S4 hosts working unchanged. */
  onVoiceToggle?: () => void;
}

const DEFAULT_PLACEHOLDER = "Escribe lo que tienes en mente…";

export function Composer({
  onSend,
  disabled = false,
  placeholder,
  onVoiceToggle,
}: ComposerProps): ReactElement {
  const [value, setValue] = useState("");
  // Feature-detect once on mount — the answer never changes per session.
  // Hiding the mic when MediaRecorder is missing keeps the chat usable
  // text-only on Safari < 14 or HTTP-only origins.
  const voiceSupported = isVoiceCaptureSupported();
  const showVoice = typeof onVoiceToggle === "function" && voiceSupported;

  const submit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }, [disabled, onSend, value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  return (
    <div className="flex items-end gap-2 border-t border-input bg-background px-3 py-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
        rows={2}
        className="max-h-40 min-h-[2.5rem] resize-none text-sm"
        data-feedback-id="feedback.chat_composer"
      />
      {showVoice ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onVoiceToggle}
          disabled={disabled}
          aria-label="Grabar mensaje de voz"
          data-feedback-id="feedback.chat_mic"
        >
          <Mic className="h-4 w-4" />
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        onClick={() => void submit()}
        disabled={disabled || value.trim().length === 0}
        aria-label="Enviar"
        data-feedback-id="feedback.chat_send"
      >
        <SendHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}
