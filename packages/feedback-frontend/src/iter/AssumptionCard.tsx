/**
 * One assumption card in the right column. Three actions:
 * Confirm, Correct (inline textarea), Mark irrelevant.
 */

import { useState } from "react";

import type { IterAssumptionRead } from "../client/types";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const _KIND_BADGE: Record<IterAssumptionRead["kind"], string> = {
  technical: "bg-blue-100 text-blue-900",
  business: "bg-amber-100 text-amber-900",
  ux: "bg-violet-100 text-violet-900",
  scope: "bg-emerald-100 text-emerald-900",
};

const _STATUS_BADGE: Record<IterAssumptionRead["status"], string> = {
  open: "bg-yellow-100 text-yellow-900",
  confirmed: "bg-green-100 text-green-900",
  corrected: "bg-blue-100 text-blue-900",
  irrelevant: "bg-gray-100 text-gray-700",
};

export interface AssumptionCardProps {
  assumption: IterAssumptionRead;
  onResolve: (body: {
    status: "confirmed" | "corrected" | "irrelevant";
    user_response?: string;
  }) => Promise<unknown> | undefined;
  disabled?: boolean;
}

export function AssumptionCard({ assumption, onResolve, disabled }: AssumptionCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Resolved cards become re-editable when the user clicks the
  // pencil icon — they get the same Confirm/Correct/Mark
  // irrelevant choices as an open card so they can fix a wrong
  // answer without having to wait for a new iteration.
  const [reopen, setReopen] = useState(false);

  const isOpen = assumption.status === "open" || reopen;

  const click = async (
    status: "confirmed" | "corrected" | "irrelevant",
    user_response?: string,
  ) => {
    setBusy(true);
    try {
      await onResolve({ status, user_response });
      setEditing(false);
      setText("");
      setReopen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border bg-card p-3 text-sm shadow-xs">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide ${
            _KIND_BADGE[assumption.kind]
          }`}
        >
          {assumption.kind}
        </span>
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[11px] uppercase tracking-wide ${
            _STATUS_BADGE[assumption.status]
          }`}
        >
          {assumption.status}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {Math.round(Number(assumption.confidence) * 100)}%
        </span>
      </div>

      <p className="mb-1 font-medium leading-snug">{assumption.statement}</p>
      <p className="mb-2 text-[12px] leading-snug text-muted-foreground">{assumption.rationale}</p>
      {/* slot_key is the carry-over correlation key the backend
          uses to track the same conceptual assumption across
          iterations. Not user-facing content; we keep it on the
          DOM for accessibility tools but visually hide it via
          ``sr-only`` so non-technical users never see jargon. */}
      <p className="sr-only" aria-label="Internal correlation key, hidden from view">
        {assumption.slot_key}
      </p>

      {assumption.status === "corrected" && assumption.user_response && (
        <div className="mb-2 rounded bg-muted p-2 text-[12px]">
          <div className="mb-1 font-semibold">Your correction:</div>
          {assumption.user_response}
        </div>
      )}

      {assumption.status !== "open" && !reopen && !disabled && (
        <button
          type="button"
          onClick={() => setReopen(true)}
          className="mb-2 text-[11px] font-medium text-primary hover:underline"
        >
          ✎ Change my answer
        </button>
      )}

      {isOpen && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || disabled} onClick={() => click("confirmed")}>
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || disabled}
            onClick={() => setEditing(true)}
          >
            Correct
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || disabled}
            onClick={() => click("irrelevant")}
          >
            Mark irrelevant
          </Button>
        </div>
      )}

      {isOpen && editing && (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's the correct answer?"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || disabled || !text.trim()}
              onClick={() => click("corrected", text.trim())}
            >
              Save correction
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
