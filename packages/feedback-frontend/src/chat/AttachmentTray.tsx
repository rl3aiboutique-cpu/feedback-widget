/**
 * Square-thumbnail tray rendered above the composer.
 *
 * Consolidates every piece of evidence attached to the in-flight
 * chat session into one horizontal strip of 56×56 thumbnails:
 *
 *   1. Auto-captured screenshot (always first when present)
 *   2. Element-mode crop (replaces #1 when the user locked an element)
 *   3. User-uploaded files (S9 — fetched from the backend after each
 *      upload mutation)
 *
 * Click any thumbnail → modal lightbox with the full image or, for
 * non-image attachments, a metadata sheet (filename, size, MIME).
 *
 * Replaces the legacy ``<CapturePreview>`` card that lived above the
 * chat timeline as a separate row — that card was redundant with the
 * thumbnails tray and pushed the conversation down the viewport.
 */

import { File as FileIcon, FileText, Image as ImageIcon, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useDeleteChatAttachmentMutation, useFeedbackDetailQuery } from "../adapter";
import type { FeedbackAttachmentRead } from "../client";

import { Lightbox } from "./CapturePreview";

type ThumbKind = "screenshot_local" | "element_local" | "user_attachment";

interface ThumbItem {
  key: string;
  kind: ThumbKind;
  /** Object URL for an image preview, or null for icon-only types. */
  previewUrl: string | null;
  /** Human label shown in the detail modal. */
  label: string;
  /** Optional sub-line (selector path, byte size, etc). */
  sublabel: string | null;
  /** Bytes (or null when unknown — e.g. element-mode cropped blob). */
  byteSize: number | null;
  /** When set, the trash button calls this. */
  onRemove?: () => void;
}

export interface AttachmentTrayProps {
  /** Active chat session id; used to fetch the user-uploaded
   *  attachments from the backend. Null until openSheet completes. */
  sessionId: string | null;
  /** Auto-captured screenshot blob (FE-local until confirm). */
  screenshotBlob: Blob | null;
  /** Capture mode: drives the screenshot caption (full-page vs.
   *  cropped element). */
  captureMode: "page" | "element";
  /** Selector path when the user locked a DOM element. */
  elementSelector: string | null;
  /** Drop the local screenshot blob. */
  onClearScreenshot?: () => void;
  /** When false, the per-thumb × remove button is hidden. Defaults to
   *  true (compose path is always owner). The detail path passes
   *  ``isOwner`` so admins viewing someone else's ticket cannot trigger
   *  the owner-gated DELETE /chat/sessions/{sid}/attachments/{aid}. */
  canRemove?: boolean;
  /** When true, server-side attachments with ``kind=screenshot`` also
   *  render in the tray. Default false because the compose path
   *  already shows a local-blob preview. The detail path passes
   *  ``true`` so the user can see the screenshot captured at the
   *  moment they filed the ticket. */
  includeScreenshots?: boolean;
}

function _formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function _iconFor(contentType: string): ReactElement {
  if (contentType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (contentType === "application/pdf") return <FileText className="h-5 w-5" />;
  if (contentType.startsWith("text/") || contentType === "application/json")
    return <FileText className="h-5 w-5" />;
  return <FileIcon className="h-5 w-5" />;
}

export function AttachmentTray({
  sessionId,
  screenshotBlob,
  captureMode,
  elementSelector,
  onClearScreenshot,
  canRemove = true,
  includeScreenshots = false,
}: AttachmentTrayProps): ReactElement | null {
  const detail = useFeedbackDetailQuery(sessionId);
  const deleteAttachment = useDeleteChatAttachmentMutation();
  const [activeThumb, setActiveThumb] = useState<ThumbItem | null>(null);

  // Manage object URL for the local screenshot so we don't leak.
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!screenshotBlob) {
      setScreenshotUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshotBlob);
    setScreenshotUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshotBlob]);

  const items: ThumbItem[] = [];

  // 1. Local screenshot / element capture is always first.
  if (screenshotBlob && screenshotUrl) {
    const isElement = captureMode === "element" && elementSelector;
    items.push({
      key: "local-screenshot",
      kind: isElement ? "element_local" : "screenshot_local",
      previewUrl: screenshotUrl,
      label: isElement ? "Captured element" : "Full page",
      sublabel: isElement ? elementSelector : _formatBytes(screenshotBlob.size),
      byteSize: screenshotBlob.size,
      onRemove: canRemove ? onClearScreenshot : undefined,
    });
  }

  // 2. Server-persisted user attachments. The detail query carries
  //    presigned URLs for image previews.
  const serverAttachments: FeedbackAttachmentRead[] =
    detail.data?.attachments ?? [];
  for (const a of serverAttachments) {
    // Skip the screenshot kind unless explicitly requested. Compose
    // flow shows the local blob already (no need to duplicate). Detail
    // flow opts in via ``includeScreenshots`` so the user sees the
    // exact frame the ticket was filed from.
    if (a.kind === "screenshot" && !includeScreenshots) continue;
    const isImage = a.content_type.startsWith("image/");
    items.push({
      key: `server-${a.id}`,
      kind: "user_attachment",
      previewUrl: isImage ? a.presigned_url ?? null : null,
      label: a.filename ?? "Attachment",
      sublabel: `${a.content_type} · ${_formatBytes(a.byte_size)}`,
      byteSize: a.byte_size,
      onRemove:
        canRemove && sessionId
          ? () =>
              deleteAttachment.mutate({
                sessionId,
                attachmentId: a.id,
              })
          : undefined,
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      <div
        className="flex items-center gap-2 overflow-x-auto px-3 py-2"
        data-feedback-id="feedback.attachment_tray"
      >
        {items.map((item) => (
          <_ThumbButton
            key={item.key}
            item={item}
            onClick={() => setActiveThumb(item)}
          />
        ))}
      </div>
      {activeThumb ? (
        <_ThumbDetailModal
          item={activeThumb}
          onClose={() => setActiveThumb(null)}
        />
      ) : null}
    </>
  );
}

function _ThumbButton({
  item,
  onClick,
}: {
  item: ThumbItem;
  onClick: () => void;
}): ReactElement {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-label={`View ${item.label}`}
        title={item.label}
        data-feedback-id="feedback.attachment_thumb"
        className="block h-14 w-14 overflow-hidden rounded-md border border-input/60 bg-muted/40 transition hover:ring-2 hover:ring-primary/40"
      >
        {item.previewUrl ? (
          <img
            src={item.previewUrl}
            alt={item.label}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            {_iconFor(item.sublabel?.split(" ")[0] ?? "")}
          </span>
        )}
      </button>
      {item.onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            item.onRemove?.();
          }}
          aria-label={`Remove ${item.label}`}
          data-feedback-id="feedback.attachment_remove"
          className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-input bg-background text-muted-foreground opacity-0 transition hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function _ThumbDetailModal({
  item,
  onClose,
}: {
  item: ThumbItem;
  onClose: () => void;
}): ReactElement {
  // Lightbox for images, metadata sheet for everything else.
  if (item.previewUrl) {
    return <Lightbox url={item.previewUrl} onClose={onClose} />;
  }
  // Non-image: simple modal with filename + MIME + size. Portal so
  // it escapes the SheetContent's transform / stacking context and
  // anchors to the viewport, not the sheet.
  if (typeof document === "undefined") return <></>;
  return createPortal(
    <div
      className="rl3-feedback-scope dark fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Attachment details — ${item.label}`}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-5 right-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-foreground/80 bg-background/40 text-foreground backdrop-blur-md shadow-lg transition hover:bg-background/70 hover:border-foreground"
      >
        <X className="h-5 w-5" strokeWidth={2.5} />
      </button>
      <div
        className="flex max-w-sm flex-col gap-2 rounded-md bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">{item.label}</h3>
        {item.sublabel ? (
          <p className="text-xs text-muted-foreground">{item.sublabel}</p>
        ) : null}
        {item.byteSize !== null ? (
          <p className="text-xs text-muted-foreground">
            Size: {_formatBytes(item.byteSize)}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
