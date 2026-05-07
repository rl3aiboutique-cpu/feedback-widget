/**
 * Modal dialog for the original feedback (the user's submission +
 * screenshot + attachments + technical metadata).
 *
 * v0.6.0 — the original-feedback content used to live in the right
 * rail's `IterContextPanel` component, which competed with the
 * spec for attention. The new layout puts the spec front and centre
 * and pushes Contexto behind a header button (⚙). Click → modal
 * opens with the same content. Close to return to the focus view.
 *
 * Reuses Radix Dialog (already in the deps via @radix-ui/react-dialog
 * via Sheet primitive). Re-exports IterContextPanel inside the
 * dialog body so the data shape stays exactly the same — we only
 * wrap it in a different surface.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import type { FeedbackRead } from "../client";
import { Button } from "../ui/button";
import { IterContextPanel } from "./IterContextPanel";

export interface ContextDialogProps {
  feedback: FeedbackRead | null | undefined;
  trigger: ReactNode;
}

export function ContextDialog({ feedback, trigger }: ContextDialogProps): ReactElement {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,40rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-md border border-input bg-background p-4 shadow-lg"
          aria-label="Contexto original del feedback"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Dialog.Title
              className="font-semibold tracking-tight"
              style={{ fontSize: "clamp(0.95rem, 0.85rem + 0.4cqi, 1.15rem)" }}
            >
              Contexto original
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                title="Cerrar (Esc)"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-3 text-muted-foreground" style={{ fontSize: "0.7rem" }}>
            Esto es exactamente lo que enviaste al abrir el ticket. Sirve de referencia mientras
            refinas el spec.
          </Dialog.Description>
          <IterContextPanel feedback={feedback} defaultOpen streaming={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
