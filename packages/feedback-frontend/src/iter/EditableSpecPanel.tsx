/**
 * Editable spec markdown panel — shared between the admin
 * `IterWorkspace` (v0.3.x) and the submitter `IterFocusView` (v0.4.4).
 *
 * Pure rendering: input is markdown + streaming flags; output is the
 * rendered article OR a textarea editor OR a streaming skeleton. The
 * caller owns the save mutation (`onSaveEdit`) so this component can
 * live in two surfaces with two different query keys to invalidate.
 *
 * Lifted from `IterWorkspace.tsx`'s `WorkingDocumentPanel` in v0.4.4
 * so the focus view can let non-technical users edit the spec
 * inline. The host's edit-in-place is the single biggest UX move
 * this release.
 */

import { Pencil, Save, X } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { type IterStreamSection, RenderedMarkdown, StreamingSkeleton } from "./markdownView";

export interface EditableSpecPanelProps {
  /** Rendered `output_markdown` for the latest version. Empty during streaming. */
  markdown: string;
  /** True while a stream is in flight; the panel renders the skeleton instead. */
  streaming: boolean;
  /** Which section the streaming parser detected; lights up in the skeleton. */
  activeSection: IterStreamSection | null;
  /** When false the [Edit] button is hidden (e.g. terminal session). */
  editable: boolean;
  /** Caller's save handler — wires to `editIterVersionMarkdown` mutation. */
  onSaveEdit: (next: string) => Promise<void>;
  /** True while the caller's save mutation is pending; disables the Save button. */
  saving: boolean;
  /** Model latency hint shown inside the streaming skeleton. */
  modelHint: string;
  /**
   * Tailwind min-height class for the textarea. Defaults to a comfortable
   * value for the admin workspace; the focus view passes a viewport-relative
   * value (`min-h-[60vh]`) so the editor takes the whole spec area.
   */
  textareaMinHeightClass?: string;
  /** Empty-state copy when no markdown exists yet. Defaults to the admin copy. */
  emptyStateMessage?: string;
  /** Optional — passed through to StreamingSkeleton for the
   * "Borrador N de hasta M" copy. */
  roundNumber?: number;
  maxRounds?: number;
}

const _DEFAULT_TEXTAREA_MIN_H = "min-h-[28rem]";
const _DEFAULT_EMPTY_MSG =
  'Press "Generate first version" or run an iteration to populate the working document.';

export function EditableSpecPanel(props: EditableSpecPanelProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(props.markdown);
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setDraft("");
  };
  const save = async () => {
    if (!draft.trim()) return;
    await props.onSaveEdit(draft);
    setEditing(false);
  };

  if (props.streaming) {
    return (
      <StreamingSkeleton
        activeSection={props.activeSection}
        modelHint={props.modelHint}
        roundNumber={props.roundNumber}
        maxRounds={props.maxRounds}
      />
    );
  }

  if (!props.markdown) {
    return (
      <div className="flex-1 rounded border bg-card p-6 text-center text-sm text-muted-foreground">
        {props.emptyStateMessage ?? _DEFAULT_EMPTY_MSG}
      </div>
    );
  }

  const textareaMinH = props.textareaMinHeightClass ?? _DEFAULT_TEXTAREA_MIN_H;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2 flex items-center justify-end gap-2">
        {!editing && props.editable && (
          <Button size="sm" variant="outline" onClick={startEditing} title="Editar el documento">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
        )}
        {editing && (
          <>
            <Button size="sm" variant="outline" onClick={cancelEditing} disabled={props.saving}>
              <X className="h-3 w-3" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={props.saving || !draft.trim()}>
              <Save className="h-3 w-3" />
              {props.saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )}
      </div>
      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={28}
          className={`flex-1 ${textareaMinH} font-mono text-xs`}
        />
      ) : (
        <RenderedMarkdown markdown={props.markdown} />
      )}
    </div>
  );
}
