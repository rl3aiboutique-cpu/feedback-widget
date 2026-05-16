/**
 * Thumbnail of the auto-captured screenshot — rendered under the
 * CAPTURE picker so the user sees the visual evidence the LLM (and the
 * admin downstream) will attach when the chat is confirmed.
 *
 * Reflects the active capture mode:
 *   - mode = "page"        → caption "Página completa"
 *   - mode = "element"     → caption shows the locked element selector
 *     and the thumbnail itself is cropped to that element's bounding
 *     box (the crop happens upstream in ``useFeedbackChat``; this
 *     component just renders whatever blob it receives).
 *
 * Affordances:
 *   - Click the thumbnail → opens a modal lightbox over the sheet
 *     content with a dark backdrop. ESC or click outside closes it.
 *   - Click the × button → calls ``onClear`` so the user can drop the
 *     attachment entirely. Component returns null afterwards.
 */

import { Image as ImageIcon, X } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactElement } from "react";

export interface CapturePreviewProps {
  blob: Blob | null;
  mode?: "page" | "element";
  selector?: string | null;
  onClear?: () => void;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Exported so other components (AttachmentTray) reuse the same
 *  ESC-to-close + backdrop-click lightbox without duplicating the
 *  z-index hierarchy. */
export function Lightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}): ReactElement {
  // ESC closes — register on the document so it fires regardless of
  // which child currently holds focus.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    // Only close on actual backdrop click, not when click bubbles up
    // from the image itself.
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      // Above SheetContent's z-index so it covers the entire sheet.
      // shadcn Sheet content uses z-50; pick something higher.
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Attached capture — expanded view"
      onClick={onBackdropClick}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
        className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md transition hover:bg-background"
      >
        <X className="h-4 w-4" />
      </button>
      <img
        src={url}
        alt="Attached capture — expanded view"
        className="max-h-[90vh] max-w-[90vw] rounded-md border border-input/40 shadow-2xl"
      />
    </div>
  );
}

export function CapturePreview({
  blob,
  mode,
  selector,
  onClear,
}: CapturePreviewProps): ReactElement | null {
  const [url, setUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [blob]);

  if (!blob || !url) {
    return null;
  }

  const isElement = mode === "element" && selector;
  const captionPrimary = isElement ? "Captured element" : "Full page";

  // Minimalist redesign 2026-05-16 — was a ~80px card with a 64×96
  // thumbnail + multi-line caption + clear button. Now a single
  // inline chip: 24×24 thumb + one-line label + (X). Clicking the
  // thumb still opens the lightbox.
  return (
    <>
      <div className="mx-4 mt-1 mb-1 inline-flex items-center gap-2 rounded-full border border-input/60 bg-muted/30 px-2 py-1">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Expand capture"
          className="block shrink-0 overflow-hidden rounded transition hover:ring-2 hover:ring-primary/30"
        >
          <img
            src={url}
            alt="Attached capture"
            className="h-6 w-6 object-cover"
          />
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground">
          <ImageIcon className="h-3 w-3" />
          {captionPrimary}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {isElement ? (
            <code className="font-mono">{selector}</code>
          ) : (
            <>{formatBytes(blob.size)}</>
          )}
        </span>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove capture"
            className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {lightboxOpen ? (
        <Lightbox url={url} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}
