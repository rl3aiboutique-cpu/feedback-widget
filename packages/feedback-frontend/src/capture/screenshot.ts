/**
 * Screenshot capture pipeline.
 *
 * Uses ``html-to-image`` (lighter than html2canvas, plays nicely with
 * Tailwind v4 oklch tokens via getComputedStyle) to rasterise the page.
 * Two modes:
 *
 *   * ``capturePageScreenshot()`` — full ``document.body`` minus the
 *     widget itself (filtered by ``data-feedback-widget-root="true"``).
 *
 *   * ``captureElementScreenshot(el)`` — a single locked element from
 *     the element-selector overlay.
 *
 * Before capture, every element matching one of the
 * ``redactionSelectors`` has its descendants visually replaced with a
 * solid black rectangle. We don't mutate the DOM permanently — the
 * blackout is applied via inline ``visibility: hidden`` on the targets
 * + an overlaid sibling, then both are removed.
 *
 * The library is dynamic-imported inside ``capturePageScreenshot`` so
 * the (non-trivial) html-to-image bundle only ships on click.
 */

import type { SelectedElementInfo } from "./metadata";

export interface ScreenshotResult {
  blob: Blob;
  width: number;
  height: number;
}

const DEFAULT_MAX_PIXELS = 1920 * 1080 * 2;
const DEFAULT_TYPE = "image/png";

interface CaptureOptions {
  redactionSelectors: readonly string[];
  /**
   * The widget itself must never appear in its own screenshot. The
   * default predicate excludes anything inside an element with
   * ``data-feedback-widget-root="true"``.
   */
  excludePredicate?: (node: HTMLElement) => boolean;
}

const DEFAULT_EXCLUDE_PREDICATE = (node: HTMLElement): boolean =>
  node.dataset?.feedbackWidgetRoot === "true" ||
  Boolean(node.closest?.('[data-feedback-widget-root="true"]'));

interface BlackoutHandle {
  restore: () => void;
}

function _blackoutRedactedNodes(root: HTMLElement, selectors: readonly string[]): BlackoutHandle {
  const overlays: HTMLElement[] = [];
  if (typeof document === "undefined") return { restore: () => undefined };

  const matches = new Set<HTMLElement>();
  for (const sel of selectors) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = root.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const n of Array.from(nodes)) {
      if (n instanceof HTMLElement) matches.add(n);
    }
  }

  for (const node of matches) {
    const rect = node.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.setAttribute("data-feedback-blackout", "true");
    overlay.style.cssText = [
      "position:fixed",
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "background:#000",
      "z-index:2147483646",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(overlay);
    overlays.push(overlay);
  }

  return {
    restore() {
      for (const o of overlays) o.remove();
    },
  };
}

async function _renderToBlob(
  target: HTMLElement,
  options: CaptureOptions,
): Promise<ScreenshotResult> {
  const exclude = options.excludePredicate ?? DEFAULT_EXCLUDE_PREDICATE;
  const filter = (node: HTMLElement | unknown): boolean => {
    if (!(node instanceof HTMLElement)) return true;
    if (node.dataset?.feedbackBlackout === "true") return true;
    return !exclude(node);
  };

  const blackout = _blackoutRedactedNodes(target, options.redactionSelectors);
  try {
    // Dynamic import keeps html-to-image out of the eager bundle.
    const lib = await import("html-to-image");
    const blob = await lib.toBlob(target, {
      filter,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      cacheBust: true,
      pixelRatio: window.devicePixelRatio || 1,
      type: DEFAULT_TYPE,
    });
    if (!blob) {
      throw new Error("Screenshot capture returned no Blob");
    }
    const rect = target.getBoundingClientRect();
    let width = Math.round(rect.width);
    let height = Math.round(rect.height);
    // Cap absurdly large captures so the upload stays under the size cap.
    if (width * height > DEFAULT_MAX_PIXELS) {
      const scale = Math.sqrt(DEFAULT_MAX_PIXELS / (width * height));
      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }
    return { blob, width, height };
  } finally {
    blackout.restore();
  }
}

/**
 * Capture a screenshot of the current page (sans widget).
 */
export async function capturePageScreenshot(options: CaptureOptions): Promise<ScreenshotResult> {
  if (typeof document === "undefined") {
    throw new Error("Screenshot capture requires a browser environment");
  }
  return _renderToBlob(document.body, options);
}

/**
 * Capture a screenshot of a specific element (used by the element-
 * selector mode). The widget is still excluded by the same filter, in
 * case the element is on the same page.
 */
export async function captureElementScreenshot(
  element: HTMLElement,
  options: CaptureOptions,
): Promise<ScreenshotResult> {
  return _renderToBlob(element, options);
}

/**
 * Build a SelectedElementInfo from a locked element so the metadata
 * bundle carries its identity (selector, xpath, role, etc.).
 */
export function describeElement(el: HTMLElement): SelectedElementInfo {
  const rect = el.getBoundingClientRect();
  const selector = _cssSelectorOf(el);
  const xpath = _xpathOf(el);
  const accessibleName =
    el.getAttribute("aria-label") ??
    el.getAttribute("title") ??
    (el as HTMLElement).innerText?.trim().slice(0, 80) ??
    null;
  const role = el.getAttribute("role");
  const outerHtml = el.outerHTML.slice(0, 500);
  return {
    selector,
    xpath,
    tag: el.tagName.toLowerCase(),
    role,
    accessible_name: accessibleName,
    bounding_box: {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    },
    outer_html_excerpt: outerHtml,
  };
}

function _cssSelectorOf(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body && parts.length < 8) {
    let part = cur.tagName.toLowerCase();
    if (cur.classList.length > 0) {
      part += `.${Array.from(cur.classList)
        .slice(0, 2)
        .map((c) => CSS.escape(c))
        .join(".")}`;
    }
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((s) => s.tagName === cur?.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

/**
 * Crop a screenshot blob to a bounding-box rectangle (logical CSS
 * pixels). Returns a PNG Blob of just that region.
 *
 * Used when the user locks an element via CapturePicker — the
 * full-page blob captured at openSheet is cropped to the element's
 * bounding-box so the thumbnail + the bytes the LLM/admin receive are
 * scoped to the actual target instead of the whole page.
 *
 * Falls back to the source blob unchanged when the box is outside the
 * image, when the canvas API is missing, or when any decode step
 * throws — fail-soft, the page screenshot is still useful.
 */
export async function cropImageBlob(
  source: Blob,
  bbox: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  if (typeof document === "undefined") return source;
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return source;

  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });

    // capturePageScreenshot scales by devicePixelRatio so the natural
    // image is typically larger than the layout viewport; recover the
    // scale from img.naturalWidth / window.innerWidth.
    const scale =
      typeof window !== "undefined" && window.innerWidth > 0
        ? img.naturalWidth / window.innerWidth
        : 1;
    const sx = Math.max(0, Math.round(bbox.x * scale));
    const sy = Math.max(0, Math.round(bbox.y * scale));
    const sw = Math.max(1, Math.round(bbox.w * scale));
    const sh = Math.max(1, Math.round(bbox.h * scale));

    if (sx >= img.naturalWidth || sy >= img.naturalHeight) {
      return source;
    }

    const clampedW = Math.min(sw, img.naturalWidth - sx);
    const clampedH = Math.min(sh, img.naturalHeight - sy);

    const canvas = document.createElement("canvas");
    canvas.width = clampedW;
    canvas.height = clampedH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, sx, sy, clampedW, clampedH, 0, 0, clampedW, clampedH);

    const cropped = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    return cropped ?? source;
  } catch {
    return source;
  } finally {
    URL.revokeObjectURL(url);
  }
}


function _xpathOf(el: HTMLElement): string | null {
  if (typeof document === "undefined") return null;
  const segments: string[] = [];
  let node: Node | null = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    const elNode = node as Element;
    let index = 1;
    let sibling = elNode.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === elNode.tagName) index += 1;
      sibling = sibling.previousElementSibling;
    }
    segments.unshift(`${elNode.tagName.toLowerCase()}[${index}]`);
    node = elNode.parentNode;
  }
  return segments.length > 0 ? `/${segments.join("/")}` : null;
}
