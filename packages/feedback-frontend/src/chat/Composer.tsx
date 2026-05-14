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
 *
 * v1.0.0 chat-first (Claude-AI voice pattern): the Composer can be
 * **controlled** — pass `value` + `onValueChange` and the parent owns
 * the textarea state. This is what the voice flow needs: when a
 * transcript comes back from Whisper, the parent writes it into
 * `composerValue` and the Composer renders it pre-filled, ready to
 * edit + send. When `value` is omitted the Composer falls back to
 * uncontrolled local state (pre-S4 behaviour).
 */

import { Mic, SendHorizontal } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  /** Controlled textarea value. When provided, the parent owns the
   * input state; pair with `onValueChange`. Omit to fall back to
   * uncontrolled (local-state) mode. */
  value?: string;
  /** Notify the parent on every keystroke when running controlled. */
  onValueChange?: (next: string) => void;
  /** Focus the textarea once on mount. Used after a voice transcript
   * lands so the user can immediately edit + Enter. */
  autoFocus?: boolean;
}

const DEFAULT_PLACEHOLDER = "Escribe lo que tienes en mente…";

export function Composer({
  onSend,
  disabled = false,
  placeholder,
  onVoiceToggle,
  value: valueProp,
  onValueChange,
  autoFocus = false,
}: ComposerProps): ReactElement {
  const [localValue, setLocalValue] = useState("");
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : localValue;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Feature-detect once on mount — the answer never changes per session.
  // Hiding the mic when MediaRecorder is missing keeps the chat usable
  // text-only on Safari < 14 or HTTP-only origins.
  const voiceSupported = isVoiceCaptureSupported();
  const showVoice = typeof onVoiceToggle === "function" && voiceSupported;

  // When the parent flips autoFocus on (voice transcript just landed),
  // move caret to end so Enter sends immediately and the user sees the
  // cursor without hunting. The textarea's current value at the moment
  // the effect runs already reflects the transcript because the parent
  // updates `value` and `autoFocus` in the same React batch — reading
  // it via the DOM ref avoids a redundant `value` dep that biome flags.
  useEffect(() => {
    if (!autoFocus) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      /* Some browsers throw on setSelectionRange before the element is fully attached. */
    }
  }, [autoFocus]);

  const setValue = useCallback(
    (next: string) => {
      if (isControlled) onValueChange?.(next);
      else setLocalValue(next);
    },
    [isControlled, onValueChange],
  );

  const submit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSend(trimmed);
  }, [disabled, onSend, setValue, value]);

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
        ref={textareaRef}
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
