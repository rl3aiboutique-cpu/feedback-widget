/**
 * Transient toast announcing a model-fallback walk.
 *
 * Built on Radix Toast (the only new dependency in v0.5; ~3KB gz)
 * because we need:
 *   - `aria-live="polite"` semantics out of the box
 *   - keyboard dismissal (`Esc`)
 *   - pause-on-hover so a user reading mid-iteration doesn't lose
 *     the message before they finish reading it
 *   - reliable portal that lands above the focus Sheet's z-stack
 *
 * Behaviour:
 *   - Auto-dismisses after 6 s.
 *   - Hovering the toast pauses the timer.
 *   - `Esc` while focus is anywhere on the page closes the toast
 *     (Radix' default).
 *   - Once dismissed, the badge in the rail keeps the active model
 *     visible — the toast is a transient announcement, not the
 *     persistent state.
 *
 * v0.5.0 — Block C.
 */

import * as Toast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";

export interface FallbackToastProps {
  /** Most recent fallback. The component re-opens whenever this
   * value's identity changes (each new walk = each new toast).
   * Pass `null` when no fallback has happened. */
  fallback: { fromModel: string; toModel: string; reason: string } | null;
}

export function FallbackToast({ fallback }: FallbackToastProps): ReactElement {
  const [open, setOpen] = useState(false);
  const lastIdRef = useRef<string | null>(null);

  // Open the toast each time the fallback identity changes — even if
  // the user previously dismissed an earlier walk, a fresh walk
  // re-announces.
  useEffect(() => {
    if (!fallback) return;
    const id = `${fallback.fromModel}>${fallback.toModel}:${fallback.reason}`;
    if (id === lastIdRef.current) return;
    lastIdRef.current = id;
    setOpen(true);
  }, [fallback]);

  return (
    <Toast.Provider duration={6000} swipeDirection="right">
      <Toast.Root
        open={open}
        onOpenChange={setOpen}
        aria-live="polite"
        className={[
          "rounded-md border p-2",
          "border-amber-300 bg-amber-50 text-amber-900",
          "dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        ].join(" ")}
        style={{ fontSize: "0.7rem" }}
      >
        <div className="flex items-start gap-2">
          <span aria-hidden="true">⚡</span>
          <div className="flex-1 space-y-1">
            <Toast.Title className="font-semibold">Cambio de modelo</Toast.Title>
            <Toast.Description className="leading-relaxed">
              {fallback ? (
                <>
                  <code
                    className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-900/40"
                    style={{ fontSize: "0.6rem" }}
                  >
                    {fallback.fromModel}
                  </code>{" "}
                  →{" "}
                  <code
                    className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-900/40"
                    style={{ fontSize: "0.6rem" }}
                  >
                    {fallback.toModel}
                  </code>
                  <span className="block text-amber-800/90 dark:text-amber-200/90">
                    {fallback.reason}
                  </span>
                </>
              ) : null}
            </Toast.Description>
          </div>
          <Toast.Close asChild>
            <Button
              size="sm"
              variant="ghost"
              className="-mr-1 h-6 w-6 p-0 text-amber-900 hover:bg-amber-200/50 dark:text-amber-100"
              title="Cerrar (Esc)"
              aria-label="Cerrar"
            >
              <X className="h-3 w-3" />
            </Button>
          </Toast.Close>
        </div>
      </Toast.Root>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2" />
    </Toast.Provider>
  );
}
