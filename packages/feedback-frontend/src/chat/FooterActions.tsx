import { Check, Loader2, RotateCcw } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "../ui/button";
import type { ChatState } from "./types";

export interface FooterActionsProps {
  state: ChatState;
  onConfirm: () => void;
  onAdjust: () => void;
  onRetry?: () => void;
}

export function FooterActions({
  state,
  onConfirm,
  onAdjust,
  onRetry,
}: FooterActionsProps): ReactElement | null {
  if (state === "error") {
    return (
      <div className="flex gap-2 px-3 py-3 border-t border-border bg-background">
        <Button type="button" variant="default" onClick={onRetry} className="w-full">
          ↻ Reintentar
        </Button>
      </div>
    );
  }

  if (state === "confirming" || state === "synthesizing" || state === "finalizing") {
    const disabled = state !== "confirming";
    return (
      <div className="flex gap-2 px-3 py-3 border-t border-border bg-background">
        <Button
          type="button"
          variant="outline"
          onClick={onAdjust}
          disabled={disabled}
          className="flex-1"
          data-feedback-id="feedback.footer.adjust"
        >
          {state === "synthesizing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-1" />
          )}
          ↺ Sigamos iterando
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={onConfirm}
          disabled={disabled}
          className="flex-1"
          data-feedback-id="feedback.footer.confirm"
        >
          {state === "finalizing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          ✓ Confirmar
        </Button>
      </div>
    );
  }

  return null;
}
