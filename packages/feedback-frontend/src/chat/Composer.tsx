/**
 * Input bar for the chat-first feedback sheet.
 *
 * Textarea + send button. Enter (without Shift) sends; Shift+Enter
 * inserts a newline. Disabled while the bot is mid-stream so the user
 * can't fire two turns in parallel.
 *
 * Batch A is text-only — voice / mic UI is owned by S4.
 */

import { SendHorizontal } from "lucide-react";
import { type KeyboardEvent, type ReactElement, useCallback, useState } from "react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export interface ComposerProps {
  /** Called with the trimmed message. Returns when the request was dispatched. */
  onSend: (content: string) => Promise<void> | void;
  /** Disables the input while the bot is thinking / synthesizing. */
  disabled?: boolean;
  placeholder?: string;
}

const DEFAULT_PLACEHOLDER = "Escribe lo que tienes en mente…";

export function Composer({ onSend, disabled = false, placeholder }: ComposerProps): ReactElement {
  const [value, setValue] = useState("");

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
