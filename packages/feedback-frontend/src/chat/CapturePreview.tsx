/**
 * Thumbnail of the auto-captured page screenshot — rendered under the
 * CAPTURE picker so the user sees the visual evidence the LLM (and the
 * admin downstream) will attach when the chat is confirmed.
 *
 * The screenshot is captured by ``useFeedbackChat.openSheet`` via
 * ``capturePageScreenshot`` and held as a Blob in hook state. This
 * component subscribes via prop, creates a short-lived object URL,
 * and revokes it on unmount / blob change so we don't leak memory in
 * long-lived sessions.
 *
 * Behavior:
 *   - ``blob === null`` → render nothing (component returns null)
 *   - blob present → 96px tall thumbnail rounded, click → open
 *     full-size in new tab (escape hatch for the user to verify the
 *     screenshot rendered correctly)
 */

import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";

export interface CapturePreviewProps {
  blob: Blob | null;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function CapturePreview({ blob }: CapturePreviewProps): ReactElement | null {
  const [url, setUrl] = useState<string | null>(null);

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

  return (
    <div className="mx-4 mt-2 mb-1 flex items-center gap-2 rounded-md border border-input/60 bg-muted/30 p-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0 overflow-hidden rounded border border-input"
        aria-label="Abrir captura en tamaño completo"
      >
        <img
          src={url}
          alt="Captura de la pantalla"
          className="h-16 w-24 object-cover"
        />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-xs font-medium text-foreground">
          <ImageIcon className="h-3 w-3" />
          Captura adjunta
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatBytes(blob.size)} · click para ampliar
        </span>
      </div>
    </div>
  );
}
