/**
 * Final synthesis card for the chat-first feedback flow (D-015, D-012,
 * Sprint B / capture_v3).
 *
 * Rendered once the backend emits the `synthesis` SSE event. Surfaces
 * the base shape (title / summary / user_story / acceptance criteria /
 * open questions) plus the Sprint B enrichment that recovers the
 * legacy iter-module output: personas, additional user_stories,
 * assumptions and an optional Mermaid diagram block.
 *
 * Type + severity are deliberately NOT rendered (D-008: admin-only).
 *
 * Bottom buttons (Confirmar / Sigamos iterando) live in the Sheet
 * footer via `<FooterActions>` per S3F shell-hybrid — this card is
 * content-only.
 *
 * Spanish copy is fixed — the sandbox runs in `es` and v1 hosts
 * inherit that. Locale-aware copy lands later if a non-es host
 * appears.
 */

import type { ReactElement } from "react";

import type { Synthesis, SynthesisPersona } from "./types";

export interface SynthesisCardProps {
  synthesis: Synthesis;
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
            <p className="text-xs text-muted-foreground">
              Objetivo: {p.goal}
            </p>
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
  // Host may not have a mermaid runtime; render the source verbatim
  // inside a code block so the user (and any admin reviewer) can
  // still see the structure. Hosts that DO have mermaid can intercept
  // the data attribute and replace the block at runtime.
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

export function SynthesisCard({ synthesis }: SynthesisCardProps): ReactElement {
  const extraStories = (synthesis.user_stories ?? []).filter(
    (s) => s && s !== synthesis.user_story,
  );
  return (
    <div
      className="mx-4 my-3 flex flex-col gap-3 rounded-lg border border-input bg-card p-4 shadow-sm"
      data-feedback-id="feedback.chat_synthesis_card"
    >
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
    </div>
  );
}
