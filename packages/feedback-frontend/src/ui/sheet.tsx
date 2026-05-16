"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

interface SheetContentProps
  extends React.ComponentProps<typeof SheetPrimitive.Content> {
  side?: "top" | "right" | "bottom" | "left";
  /** When provided (right/left sides only) the sheet renders at this
   *  width in CSS pixels instead of the responsive default. Pair with
   *  ``onResizeStart`` to get a drag handle on the edge facing the
   *  rest of the page. */
  widthPx?: number;
  /** Bind to the drag handle's onMouseDown / onTouchStart. When
   *  omitted the handle is hidden. */
  onResizeStart?: (event: React.MouseEvent | React.TouchEvent) => void;
  /** When true the sheet skips its CSS width transition so the panel
   *  tracks the pointer 1:1 during a resize drag. */
  isDragging?: boolean;
}

function SheetContent({
  className,
  children,
  side = "right",
  widthPx,
  onResizeStart,
  isDragging = false,
  style,
  ...props
}: SheetContentProps) {
  const hasCustomWidth = widthPx !== undefined && (side === "right" || side === "left");
  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(hasCustomWidth ? { width: `${widthPx}px`, maxWidth: "100vw" } : {}),
    ...(isDragging ? { transition: "none" } : {}),
  };
  // The drag handle lives on the edge facing the rest of the page —
  // left edge for right-side sheets, right edge for left-side sheets.
  const handleSideClass =
    side === "right"
      ? "left-0 -translate-x-1/2 cursor-col-resize"
      : "right-0 translate-x-1/2 cursor-col-resize";
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        // The widget mounts its own modals (lightbox, hard-delete
        // confirm) via createPortal at document.body. Radix Dialog
        // listens for pointer events outside its content and would
        // otherwise close the sheet whenever the user clicks inside
        // those modals. Veto the close when the originating element
        // sits inside any node carrying our scope class — that means
        // the click came from another widget surface, not the host.
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.(".rl3-feedback-scope")) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.(".rl3-feedback-scope")) {
            event.preventDefault();
          }
        }}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            !hasCustomWidth &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "right" &&
            hasCustomWidth &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full border-l",
          side === "left" &&
            !hasCustomWidth &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "left" &&
            hasCustomWidth &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full border-r",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className,
        )}
        style={mergedStyle}
        {...props}
      >
        {onResizeStart && hasCustomWidth ? (
          // Drag-resize affordance — full-height invisible strip for
          // the hit target + a centered circular pill with chevrons so
          // users can see the handle. Mirrors the image-comparison
          // slider pattern: thin spine + visible round grip in the
          // middle. Pure dark-on-RL3-palette styling so it does not
          // clash with the brand.
          <div
            className={cn(
              "absolute top-0 z-20 h-full w-3 select-none cursor-ew-resize",
              handleSideClass,
            )}
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            data-feedback-id="feedback.sheet_resize_handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
          >
            {/* Minimalist pill grip — short vertical bar centered on
                the edge. The drag handlers live on the parent strip
                so the hit target is generous even though the visible
                affordance is tiny. */}
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
                "inline-flex h-12 w-3 items-center justify-center rounded-full",
                "bg-muted-foreground/40",
                "transition-colors duration-150 ease-out",
                isDragging
                  ? "bg-primary"
                  : "hover:bg-muted-foreground/70",
              )}
            />
            <span className="sr-only">Resize panel</span>
          </div>
        ) : null}
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
