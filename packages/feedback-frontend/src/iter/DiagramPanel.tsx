/**
 * Diagram panel — renders the spec's `## Diagram` section as a real
 * Mermaid SVG (cajitas + flechas) inside the iter focus rail.
 *
 * v0.5 — pulled OUT of the 5-card main stack so the diagram stays
 * "always visible" via the sticky rail position the spec promises
 * the user. Main column keeps 4 cards (Personas / User Stories /
 * Spec / Assumptions) at the 75ch text-width that's comfortable to
 * read; the diagram doesn't need text-width and lives next to the
 * scrolling spec text.
 *
 * Rendering strategy:
 *   - `mermaid` is dynamic-imported the first time we see content.
 *     Initial bundle stays small; users with no diagrams pay zero.
 *   - We extract the first ```mermaid ... ``` fence from the
 *     incoming markdown slice. If the diagram section is the
 *     model's free-text (no fence), we fall back to a code-block.
 *   - During streaming the source code may be incomplete; we wait
 *     until either (a) the section is `done`, or (b) the source
 *     contains a closing ``` fence — whichever fires first. Render
 *     attempts on a partial fence throw inside `mermaid.render`,
 *     which we catch and treat as "still streaming, try later".
 */

import { Check, Loader2 } from "lucide-react";
import { type ReactElement, useEffect, useRef, useState } from "react";

import type { SectionStatus } from "./specSectionState";

export interface DiagramPanelProps {
  markdown: string;
  status: SectionStatus;
}

const _MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/;

function _extractMermaidSource(markdown: string): string | null {
  const m = _MERMAID_FENCE_RE.exec(markdown);
  return m ? (m[1]?.trim() ?? null) : null;
}

let _mermaidInitPromise: Promise<typeof import("mermaid").default> | null = null;
function _loadMermaid(): Promise<typeof import("mermaid").default> {
  if (_mermaidInitPromise) return _mermaidInitPromise;
  _mermaidInitPromise = import("mermaid").then((mod) => {
    const m = mod.default;
    m.initialize({
      startOnLoad: false,
      theme: "default",
      logLevel: "fatal",
      securityLevel: "strict",
    });
    return m;
  });
  return _mermaidInitPromise;
}

let _mermaidRenderId = 0;

export function DiagramPanel({ markdown, status }: DiagramPanelProps): ReactElement {
  const [svg, setSvg] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const source = _extractMermaidSource(markdown);
  const shouldRender = status === "done" || source !== null;

  useEffect(() => {
    if (!shouldRender || !source) {
      setSvg(null);
      setRenderError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await _loadMermaid();
        const id = `iter-diagram-${++_mermaidRenderId}`;
        const { svg: rendered } = await mermaid.render(id, source);
        if (cancelled) return;
        setSvg(rendered);
        setRenderError(null);
      } catch (err) {
        if (cancelled) return;
        setSvg(null);
        setRenderError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldRender, source]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (svg) {
      const range = document.createRange();
      range.selectNodeContents(containerRef.current);
      const fragment = range.createContextualFragment(svg);
      containerRef.current.replaceChildren(fragment);
    } else {
      containerRef.current.replaceChildren();
    }
  }, [svg]);

  const headerStripCls =
    status === "done"
      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-900/10"
      : status === "streaming"
        ? "border-primary/40 bg-primary/5"
        : "border-input bg-muted/30";

  return (
    <section
      aria-label="Diagrama"
      className={[
        "rounded-md border transition-colors",
        status === "done"
          ? "border-emerald-200 dark:border-emerald-900/40"
          : status === "streaming"
            ? "border-primary/30"
            : "border-input",
      ].join(" ")}
    >
      <header
        className={`flex items-center gap-2 rounded-t-md border-b px-3 py-1.5 ${headerStripCls}`}
      >
        <h2
          className="font-semibold tracking-tight"
          style={{ fontSize: "clamp(0.85rem, 0.78rem + 0.3cqi, 1rem)" }}
        >
          Diagrama
        </h2>
        {status === "streaming" ? (
          <span
            className="flex items-center gap-1 text-primary"
            style={{ fontSize: "0.65rem" }}
            aria-live="polite"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            dibujando…
          </span>
        ) : null}
        {status === "done" ? (
          <span
            className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300"
            style={{ fontSize: "0.65rem" }}
          >
            <Check className="h-3 w-3" />
            listo
          </span>
        ) : null}
      </header>

      {status === "pending" ? (
        <div
          aria-hidden="true"
          className="flex items-center justify-center p-6 text-muted-foreground"
          style={{ minHeight: "10em", fontSize: "0.7rem" }}
        >
          Pendiente…
        </div>
      ) : status === "done" && !markdown.trim() ? (
        // v0.5.1 — match SpecSectionCard's empty-done message so the
        // green "listo" badge always corresponds to real content.
        <div className="p-3 italic text-muted-foreground" style={{ fontSize: "0.7rem" }}>
          Esta versión del spec no incluye un diagrama.
        </div>
      ) : svg ? (
        <div
          ref={containerRef}
          className="p-3 [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full"
          style={{ minHeight: "8em" }}
        />
      ) : renderError ? (
        <div className="p-3 space-y-2">
          <p className="text-muted-foreground" style={{ fontSize: "0.65rem" }}>
            No se pudo renderizar el diagrama (sintaxis Mermaid inválida); aquí está el código.
          </p>
          <pre
            className="overflow-x-auto rounded border border-input bg-muted/40 p-2 font-mono text-foreground/90"
            style={{ fontSize: "0.7rem" }}
          >
            {source ?? markdown.replace(/^## Diagram\s*/, "").trim()}
          </pre>
        </div>
      ) : (
        <div
          className="flex items-center justify-center p-6 text-muted-foreground"
          style={{ minHeight: "8em", fontSize: "0.7rem" }}
        >
          Esperando contenido…
        </div>
      )}
    </section>
  );
}
