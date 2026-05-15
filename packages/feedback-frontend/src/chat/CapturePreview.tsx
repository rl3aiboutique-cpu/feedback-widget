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

function _Lightbox({
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
      aria-label="Captura adjunta — vista ampliada"
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
        alt="Captura adjunta — vista ampliada"
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
  const captionPrimary = isElement ? "Elemento capturado" : "Página completa";

  return (
    <>
      <div className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-md border border-input/60 bg-muted/30 p-2">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Ampliar captura"
          className="block shrink-0 overflow-hidden rounded border border-input transition hover:ring-2 hover:ring-primary/30"
        >
          <img
            src={url}
            alt="Captura adjunta"
            className="h-16 w-24 object-cover"
          />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs font-medium text-foreground">
            <ImageIcon className="h-3 w-3" />
            {captionPrimary}
          </span>
          <span className="truncate text-[10px] text-muted-foreground">
            {isElement ? (
              <code className="font-mono">{selector}</code>
            ) : (
              <>{formatBytes(blob.size)} · click para ampliar</>
            )}
          </span>
          {isElement ? (
            <span className="text-[10px] text-muted-foreground">
              {formatBytes(blob.size)} · click para ampliar
            </span>
          ) : null}
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Quitar captura"
            className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {lightboxOpen ? (
        <_Lightbox url={url} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}
