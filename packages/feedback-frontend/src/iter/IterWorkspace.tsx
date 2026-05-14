/**
 * IterWorkspace — v1.0.0 stub (S7 cleanup).
 *
 * The full iter workspace UI was removed in v1.0.0 because refinement now
 * lives inside the chat sheet itself (D-002 → admin refine via chat).
 *
 * This stub exists ONLY because the admin Triage page (capellai-ai-crm)
 * still imports the symbol while we wait for S6 to land the admin refine
 * trigger from the chat-first flow. Renders a neutral placeholder so the
 * admin page compiles + ships v1.0.0 without breaking host integration.
 *
 * REMOVE in v1.1.0 once host admin pages migrate to the chat-refine flow
 * (S6) and stop importing `IterWorkspace`.
 */

import type { ReactElement } from "react";

export interface IterWorkspaceProps {
  sessionId: string;
  feedbackId?: string;
  onExit?: () => void;
}

export function IterWorkspace({ sessionId, onExit }: IterWorkspaceProps): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-foreground">Iterate workspace deprecated</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Refinement now happens inside the chat-first feedback sheet (v1.0.0).
        This admin view will be replaced in v1.1.0 by the chat refine trigger.
      </p>
      <p className="text-[10px] text-muted-foreground/70 font-mono">session: {sessionId}</p>
      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="mt-2 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
        >
          ← Volver
        </button>
      ) : null}
    </div>
  );
}

export default IterWorkspace;
