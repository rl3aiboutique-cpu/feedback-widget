/**
 * Resizable + responsive width state for the feedback sheet.
 *
 * The default sheet is a narrow right-side overlay (~480px). Power
 * users and admins working through long ticket lists want more
 * horizontal room; mobile users want the whole viewport. This hook
 * owns:
 *
 *   - a width in pixels, persisted across sessions via localStorage
 *   - drag handlers that the SheetContent attaches to a left-edge
 *     handle to grow / shrink the panel in real time
 *   - a responsive breakpoint that switches to full-screen below the
 *     ``MOBILE_BREAKPOINT_PX`` viewport width
 *   - clamps the width to ``[MIN, MAX]`` (MAX = 80% viewport so
 *     there's always context behind the overlay on desktop)
 *
 * No external dependencies — pure React + DOM event listeners. The
 * widget package stays portable: the host never has to wire the
 * resize behaviour.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "rl3-feedback-sheet-width";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 360;
/** Below this viewport width the sheet goes full-screen and the
 *  drag handle hides — narrow phones can't afford the overlay. */
const MOBILE_BREAKPOINT_PX = 768;

function _maxWidth(viewportWidth: number): number {
  return Math.floor(viewportWidth * 0.8);
}

function _clamp(width: number, viewportWidth: number): number {
  const max = _maxWidth(viewportWidth);
  return Math.max(MIN_WIDTH, Math.min(max, width));
}

function _readStoredWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
    /* Private mode / locked storage — fall through to default. */
  }
  return DEFAULT_WIDTH;
}

function _persistWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(width));
  } catch {
    /* Storage unavailable — silent fail; runtime state is enough. */
  }
}

export interface ResizableSheetState {
  /** Width in CSS pixels, already clamped to viewport constraints. */
  width: number;
  /** True when the viewport is too narrow for a side overlay; the
   *  caller should fall back to ``width: 100%`` and hide the handle. */
  isMobile: boolean;
  /** True while the user is mid-drag. Useful for disabling
   *  ``transition`` so the panel tracks the pointer 1:1. */
  isDragging: boolean;
  /** Bind to the drag handle's ``onMouseDown`` / ``onTouchStart``. */
  startResize: (event: React.MouseEvent | React.TouchEvent) => void;
}

export function useResizableSheet(): ResizableSheetState {
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  const [width, setWidth] = useState<number>(() => _readStoredWidth());
  const [isDragging, setIsDragging] = useState(false);

  // Track viewport changes so the clamp follows window resizes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Re-clamp whenever the viewport shrinks below the current width
  // (e.g. user rotates from landscape to portrait on a tablet).
  useEffect(() => {
    setWidth((prev) => _clamp(prev, viewportWidth));
  }, [viewportWidth]);

  const isMobile = viewportWidth < MOBILE_BREAKPOINT_PX;

  const startResize = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (isMobile) return; // No resize on phones.
      event.preventDefault();
      setIsDragging(true);

      const startX =
        "touches" in event ? event.touches[0]?.clientX ?? 0 : event.clientX;
      const startWidth = width;

      const move = (clientX: number) => {
        // The sheet sticks to the right edge; dragging the handle
        // LEFT must GROW the panel, hence ``startX - clientX``.
        const delta = startX - clientX;
        setWidth(_clamp(startWidth + delta, window.innerWidth));
      };

      const onMouseMove = (e: MouseEvent) => move(e.clientX);
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) move(e.touches[0].clientX);
      };
      const stop = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("touchmove", onTouchMove);
        document.removeEventListener("mouseup", stop);
        document.removeEventListener("touchend", stop);
        // Persist the final value so the next session restores it.
        setWidth((current) => {
          _persistWidth(current);
          return current;
        });
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("mouseup", stop);
      document.addEventListener("touchend", stop);
    },
    [isMobile, width],
  );

  return {
    width: isMobile ? viewportWidth : width,
    isMobile,
    isDragging,
    startResize,
  };
}
