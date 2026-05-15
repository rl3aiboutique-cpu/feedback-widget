/**
 * Input bar for the chat-first feedback sheet.
 *
 * Single-line pill (post-baseline-audit refresh 2026-05-15) modelled
 * after the ChatGPT / Claude AI composer:
 *
 *   ╭───────────────────────────────────────────────────╮
 *   │  Escribe lo que tienes en mente…       🎙   ➤   │
 *   ╰───────────────────────────────────────────────────╯
 *
 * - Rounded full pill wraps the textarea + mic + send buttons.
 * - Textarea starts at one row and auto-grows up to ~6 rows; resize
 *   handle suppressed so the pill stays the dominant shape.
 * - Send button gains a primary gradient when text is present.
 * - No keyboard hint row — Enter / Shift+Enter behaviour matches the
 *   broader ecosystem and the placeholder copy alone is enough.
 *
 * Enter sends; Shift+Enter inserts a newline. Disabled while the bot is
 * mid-stream so the user can't fire two turns in parallel. The mic
 * button is hidden when MediaRecorder is unavailable so the composer
 * still works text-only on Safari < 14 / HTTP-only origins.
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

import { isVoiceCaptureSupported } from "./useVoiceCapture";

export interface ComposerProps {
  /** Called with the trimmed message. Returns when the request was dispatched. */
  onSend: (content: string) => Promise<void> | void;
  /** Disables the input while the bot is thinking / synthesizing. */
  disabled?: boolean;
  placeholder?: string;
  /** Called when the user taps the mic button. Parent toggles into
   * recording mode. When omitted, the mic button is hidden. */
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

// Auto-grow caps. min keeps the pill compact when empty; max prevents
// the textarea from eating the whole sheet when the user pastes a wall
// of text.
const MIN_TEXTAREA_HEIGHT = 24; // 1 line at 14px / 1.5 leading
const MAX_TEXTAREA_HEIGHT = 160; // ~6 lines before scrolling

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
  const [focused, setFocused] = useState(false);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : localValue;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const voiceSupported = isVoiceCaptureSupported();
  const showVoice = typeof onVoiceToggle === "function" && voiceSupported;

  // Auto-grow: reset height to read scrollHeight, then clamp inside
  // [MIN, MAX]. Runs on every value change so paste / IME also adjust.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(
      MAX_TEXTAREA_HEIGHT,
      Math.max(MIN_TEXTAREA_HEIGHT, el.scrollHeight),
    );
    el.style.height = `${next}px`;
  }, [value]);

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

  const hasText = value.trim().length > 0;

  return (
    <div className="border-t border-input/40 bg-background/95 px-3 py-3 backdrop-blur">
      <div
        className={[
          "flex items-center gap-1 rounded-full border bg-muted/30 px-3 py-1.5 transition",
          focused ? "border-primary/50 ring-2 ring-primary/20" : "border-input/50",
        ].join(" ")}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none disabled:opacity-50"
          style={{ minHeight: `${MIN_TEXTAREA_HEIGHT}px`, maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
          data-feedback-id="feedback.chat_composer"
        />
        {showVoice ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onVoiceToggle}
            disabled={disabled}
            aria-label="Grabar mensaje de voz"
            data-feedback-id="feedback.chat_mic"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Mic className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={disabled || !hasText}
          aria-label="Enviar"
          data-feedback-id="feedback.chat_send"
          className={[
            "h-8 w-8 shrink-0 rounded-full transition",
            hasText
              ? "bg-gradient-to-br from-primary to-primary/70 shadow-sm hover:shadow-md"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
