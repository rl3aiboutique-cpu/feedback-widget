/**
 * Synthesis card for the chat-first feedback flow.
 *
 * Lives INSIDE the chat timeline as one bubble per spec emission so the
 * user can compare iterations. Each card has its own Approve button;
 * only one version per chat can be confirmed (one-winner invariant —
 * server-enforced). Click the card to enter edit mode and tweak title /
 * summary / user_story / acceptance_criteria manually; press Confirm to
 * persist the edit (does NOT auto-approve).
 *
 * Read-only mode renders the full enriched payload (personas, diagram,
 * etc.). Edit mode shows only the four user-editable fields — the rest
 * stays LLM-owned to keep the surface small.
 */

import { Check, Pencil, X } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import type { Synthesis, SynthesisPersona } from "./types";

export interface SynthesisCardProps {
  synthesis: Synthesis;
  /** Whether THIS card is the approved winner. Drives the green badge
   *  + disables further Approve / Edit. */
  confirmed?: boolean;
  /** True when ANY OTHER card in the same chat is already confirmed.
   *  Locks Approve + Edit on this one (the ticket has a winner). */
  lockedByOtherWinner?: boolean;
  /** Async approve handler — called when user presses Approve.
   *  Omit to render the card read-only (e.g. the legacy detail view). */
  onApprove?: () => void | Promise<void>;
  /** Async edit handler — called with the patched fields when the user
   *  presses Confirm in edit mode. Omit to render read-only. */
  onEdit?: (patch: {
    title?: string;
    summary?: string;
    user_story?: string;
    acceptance_criteria?: string[];
  }) => void | Promise<void>;
  /** Disables both buttons while a mutation is in-flight. */
  busy?: boolean;
}

function SectionTitle({ label }: { label: string }): ReactElement {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
  );
}

function PersonasBlock({ personas }: { personas: SynthesisPersona[] }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <SectionTitle label="Personas" />
      <ul className="flex flex-col gap-2 text-sm text-foreground">
        {personas.map((p, idx) => (
          <li
            key={`persona-${idx}-${p.name.slice(0, 16)}`}
            className="rounded border border-input/60 bg-muted/30 px-2 py-1"
          >
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">Objetivo: {p.goal}</p>
            <p className="text-xs text-muted-foreground">
              Fricción: {p.frustration}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulletList({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: string[];
  muted?: boolean;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <SectionTitle label={label} />
      <ul
        className={`list-disc space-y-1 pl-5 text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {items.map((item, idx) => (
          <li key={`${label}-${idx}-${item.slice(0, 16)}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DiagramBlock({ source }: { source: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <SectionTitle label="Diagrama" />
      <pre
        data-feedback-mermaid-source="true"
        className="overflow-x-auto rounded border border-input/60 bg-muted/40 p-2 text-xs text-foreground"
      >
        <code>{source}</code>
      </pre>
    </div>
  );
}

export function SynthesisCard({
  synthesis,
  confirmed = false,
  lockedByOtherWinner = false,
  onApprove,
  onEdit,
  busy = false,
}: SynthesisCardProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(synthesis.title);
  const [draftSummary, setDraftSummary] = useState(synthesis.summary);
  const [draftStory, setDraftStory] = useState(synthesis.user_story);
  const [draftCriteria, setDraftCriteria] = useState(
    synthesis.acceptance_criteria.join("\n"),
  );

  const editable = Boolean(onEdit) && !confirmed && !lockedByOtherWinner;
  const approvable = Boolean(onApprove) && !confirmed && !lockedByOtherWinner;

  const enterEdit = () => {
    if (!editable || busy) return;
    setDraftTitle(synthesis.title);
    setDraftSummary(synthesis.summary);
    setDraftStory(synthesis.user_story);
    setDraftCriteria(synthesis.acceptance_criteria.join("\n"));
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const submitEdit = async () => {
    if (!onEdit) return;
    const patch = {
      title: draftTitle.trim(),
      summary: draftSummary.trim(),
      user_story: draftStory.trim(),
      acceptance_criteria: draftCriteria
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    await onEdit(patch);
    setEditing(false);
  };

  const headerBadge = confirmed ? (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
      <Check className="h-3 w-3" /> Confirmed
    </span>
  ) : lockedByOtherWinner ? (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      Superseded
    </span>
  ) : null;

  const extraStories = (synthesis.user_stories ?? []).filter(
    (s) => s && s !== synthesis.user_story,
  );

  return (
    <div
      className={[
        "flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm",
        confirmed ? "border-emerald-500/50 bg-emerald-500/5" : "border-input",
        editable && !editing ? "cursor-pointer hover:border-primary/40" : "",
      ].join(" ")}
      data-feedback-id="feedback.chat_synthesis_card"
      onClick={editing ? undefined : enterEdit}
    >
      {/* Header — always visible */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          Spec card
        </span>
        {headerBadge}
      </div>

      {editing ? (
        <div
          className="flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Title</span>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Summary</span>
            <Textarea
              value={draftSummary}
              onChange={(e) => setDraftSummary(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">User story</span>
            <Textarea
              value={draftStory}
              onChange={(e) => setDraftStory(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">
              Acceptance criteria · one per line
            </span>
            <Textarea
              value={draftCriteria}
              onChange={(e) => setDraftCriteria(e.target.value)}
              rows={4}
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEdit}
              disabled={busy}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submitEdit}
              disabled={busy}
              data-feedback-id="feedback.chat_synthesis_confirm_edit"
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Confirm edit
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="text-base font-bold text-foreground">{synthesis.title}</h3>

          <p className="text-sm text-muted-foreground">{synthesis.summary}</p>

          <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-foreground">
            {synthesis.user_story}
          </blockquote>

          {extraStories.length > 0 ? (
            <BulletList label="Historias de usuario adicionales" items={extraStories} />
          ) : null}

          {synthesis.personas && synthesis.personas.length > 0 ? (
            <PersonasBlock personas={synthesis.personas} />
          ) : null}

          {synthesis.acceptance_criteria.length > 0 ? (
            <BulletList
              label="Criterios de aceptación"
              items={synthesis.acceptance_criteria}
            />
          ) : null}

          {synthesis.assumptions && synthesis.assumptions.length > 0 ? (
            <BulletList label="Supuestos" items={synthesis.assumptions} muted />
          ) : null}

          {synthesis.diagram ? <DiagramBlock source={synthesis.diagram} /> : null}

          {synthesis.open_questions.length > 0 ? (
            <BulletList
              label="Preguntas abiertas"
              items={synthesis.open_questions}
              muted
            />
          ) : null}

          {(approvable || editable) && (
            <div
              className="flex items-center justify-end gap-2 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              {editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={enterEdit}
                  disabled={busy}
                  data-feedback-id="feedback.chat_synthesis_edit"
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
              ) : null}
              {approvable ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onApprove}
                  disabled={busy}
                  data-feedback-id="feedback.chat_synthesis_approve"
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
