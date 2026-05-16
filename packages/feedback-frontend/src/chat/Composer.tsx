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

import { Mic, Paperclip, SendHorizontal } from "lucide-react";
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

/** Accept attribute mirrors the backend's legacy ``_ALLOWED_ATTACHMENT_TYPES``
 *  (images + PDF + plain text + markdown + JSON). The server re-validates
 *  via magic-byte sniff regardless, so this is purely a UX hint to the
 *  native file picker. */
const _ACCEPT_ATTRIBUTE =
  "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,application/json,.log";

export interface ComposerProps {
  /** Called with the trimmed message. Returns when the request was dispatched. */
  onSend: (content: string) => Promise<void> | void;
  /** Disables the input while the bot is thinking / synthesizing. */
  disabled?: boolean;
  placeholder?: string;
  /** Called when the user taps the mic button. Parent toggles into
   * recording mode. When omitted, the mic button is hidden. */
  onVoiceToggle?: () => void;
  /** Called when the user picks files via the paperclip. Receives the
   * raw ``File[]`` array; the parent runs the upload mutation and
   * surfaces errors. Omit to hide the paperclip. */
  onAttachFiles?: (files: File[]) => void;
  /** When true the paperclip is disabled (e.g. already at the
   * MAX_USER_ATTACHMENTS cap). Tooltip explains why upstream. */
  attachDisabled?: boolean;
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

const DEFAULT_PLACEHOLDER = "Type what's on your mind…";

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
  onAttachFiles,
  attachDisabled = false,
  value: valueProp,
  onValueChange,
  autoFocus = false,
}: ComposerProps): ReactElement {
  const [localValue, setLocalValue] = useState("");
  const [focused, setFocused] = useState(false);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : localValue;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const voiceSupported = isVoiceCaptureSupported();
  const showVoice = typeof onVoiceToggle === "function" && voiceSupported;
  const showAttach = typeof onAttachFiles === "function";

  const onPickFiles = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files;
      if (!picked || picked.length === 0) return;
      const arr = Array.from(picked);
      onAttachFiles?.(arr);
      // Reset so picking the same file twice still fires onChange.
      event.target.value = "";
    },
    [onAttachFiles],
  );

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
          "flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 transition shadow-sm",
          focused ? "ring-2 ring-primary/40" : "",
        ].join(" ")}
      >
        {showAttach ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={_ACCEPT_ATTRIBUTE}
              onChange={onPickFiles}
              hidden
              data-feedback-id="feedback.chat_attach_input"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || attachDisabled}
              aria-label="Attach files"
              title={
                attachDisabled
                  ? "Attachment limit reached (5 max)"
                  : "Attach files"
              }
              data-feedback-id="feedback.chat_attach"
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </>
        ) : null}

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
            aria-label="Record voice message"
            data-feedback-id="feedback.chat_mic"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Mic className="h-4 w-4" />
          </Button>
        ) : null}

        {/* Send morphs: dim secondary at rest, solid RL3 beige when
              text is present. Same pattern as the 2-row design,
              compressed into the single-line pill. */}
        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={disabled || !hasText}
          aria-label="Send"
          data-feedback-id="feedback.chat_send"
          className={[
            "h-8 w-8 shrink-0 rounded-full transition",
            hasText
              ? "bg-primary text-primary-foreground shadow-sm hover:opacity-90"
              : "bg-secondary text-muted-foreground cursor-not-allowed",
          ].join(" ")}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
