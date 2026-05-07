/**
 * Spec section card — one of five.
 *
 * Three visual states:
 *
 *   pending   — sectioned skeleton lines (em-based widths) while we
 *               wait for the SSE `section` event to fire. Reserves
 *               vertical space matching the section's expected
 *               density (`SECTION_SKELETON_HEIGHT_EM`) so the
 *               layout doesn't shift on transition.
 *   streaming — subtle pulse + the partial markdown rendered so far,
 *               hashed by `markdown-it` per chunk. Section header
 *               sticky inside the main column.
 *   done      — full markdown, success accent (left border + check
 *               icon in the header).
 *
 * Each card hashes ONE markdown slice with `markdown-it` — pre-flight
 * grep on real `output_markdown` rows confirmed zero footnote refs,
 * so isolated rendering per slice is safe.
 *
 * v0.5.0 — Block B.
 */

import { Check, Loader2 } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useRef } from "react";

import {
  SECTION_LABEL,
  SECTION_PATTERN,
  SECTION_SKELETON_HEIGHT_EM,
  type SectionStatus,
  type SpecSectionKey,
} from "./specSectionState";

export interface SpecSectionCardProps {
  sectionKey: SpecSectionKey;
  status: SectionStatus;
  markdown: string;
}

export function SpecSectionCard({
  sectionKey,
  status,
  markdown,
}: SpecSectionCardProps): ReactElement {
  const bodyRef = useRef<HTMLElement | null>(null);

  // v0.5.2 — strip the first heading line if it matches the section
  // label. The card header already shows "Personas" / "User Stories"
  // / etc., so rendering the model's literal `# Personas` H1 inside
  // the body just duplicates the label. We only strip the FIRST
  // line to avoid touching legitimate H1 sub-headings deeper in the
  // section (e.g. the model puts a `# Feature Name` inside Spec).
  const bodyMarkdown = useMemo(() => {
    if (!markdown) return markdown;
    const newlineIdx = markdown.indexOf("\n");
    const firstLine = newlineIdx === -1 ? markdown : markdown.slice(0, newlineIdx);
    if (SECTION_PATTERN[sectionKey].test(firstLine)) {
      return markdown.slice(newlineIdx + 1).trimStart();
    }
    return markdown;
  }, [markdown, sectionKey]);

  // Render the section's markdown slice into the body. Re-runs on
  // every status / markdown change because streaming chunks update
  // both. `markdown-it` is dynamic-imported the first time to avoid
  // pulling it into the initial bundle.
  useEffect(() => {
    let cancelled = false;
    if (status === "pending") return;
    const el = bodyRef.current;
    if (!el) return;
    void import("markdown-it").then(({ default: MarkdownIt }) => {
      if (cancelled || !bodyRef.current) return;
      const md = new MarkdownIt({ html: false, breaks: false, linkify: true });
      const html = md.render(bodyMarkdown);
      const range = document.createRange();
      range.selectNodeContents(bodyRef.current);
      const fragment = range.createContextualFragment(html);
      bodyRef.current.replaceChildren(fragment);
    });
    return () => {
      cancelled = true;
    };
  }, [status, bodyMarkdown]);

  const label = SECTION_LABEL[sectionKey];
  const minHeightEm = SECTION_SKELETON_HEIGHT_EM[sectionKey];

  const headerStripCls =
    status === "done"
      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-900/10"
      : status === "streaming"
        ? "border-primary/40 bg-primary/5"
        : "border-input bg-muted/30";

  const cardCls = [
    "rounded-md border transition-colors",
    status === "done"
      ? "border-emerald-200 dark:border-emerald-900/40"
      : status === "streaming"
        ? "border-primary/30"
        : "border-input",
  ].join(" ");

  return (
    <section
      aria-label={label}
      data-section-key={sectionKey}
      id={`iter-section-${sectionKey}`}
      className={cardCls}
      style={{ minHeight: `${minHeightEm}em` }}
    >
      <header
        className={`sticky top-0 z-[1] flex items-center gap-2 rounded-t-md border-b px-3 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-opacity-90 ${headerStripCls}`}
      >
        <h2
          className="font-semibold tracking-tight"
          style={{ fontSize: "clamp(0.85rem, 0.78rem + 0.3cqi, 1rem)" }}
        >
          {label}
        </h2>
        {status === "streaming" ? (
          <span
            className="flex items-center gap-1 text-primary"
            style={{ fontSize: "0.65rem" }}
            aria-live="polite"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            escribiendo…
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
          className="space-y-2 p-3"
          style={{ minHeight: `${Math.max(minHeightEm - 2, 4)}em` }}
        >
          <div className="h-3 w-[85%] rounded bg-muted" />
          <div className="h-3 w-[70%] rounded bg-muted" />
          <div className="h-3 w-[92%] rounded bg-muted" />
          <div className="h-3 w-[60%] rounded bg-muted" />
        </div>
      ) : status === "done" && !markdown.trim() ? (
        // v0.5.1 — never claim "listo" with empty content. NN/G H1
        // (Visibility of System Status) — the status badge must
        // accurately describe what's there. If the model finished
        // and produced no text for this section, say so explicitly
        // instead of leaving an empty card under a green badge.
        <div className="p-3 italic text-muted-foreground" style={{ fontSize: "0.7rem" }}>
          Esta versión del spec no incluye contenido para esta sección.
        </div>
      ) : (
        <article
          ref={bodyRef}
          className={[
            // v0.5.2 — asymmetric padding: tighter top so the body
            // sits right under the header strip (was creating a
            // visible jump). Sides + bottom keep the previous
            // breathing room.
            "px-3 pb-3 pt-1 text-sm leading-relaxed",
            "[&_h1]:mt-2 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold",
            "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold",
            "[&_h3]:mt-1.5 [&_h3]:mb-1 [&_h3]:text-[0.85rem] [&_h3]:font-semibold",
            "[&_p]:my-1.5 [&_p]:text-foreground/90",
            "[&_ul]:my-1.5 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-0.5",
            "[&_ol]:my-1.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-0.5",
            "[&_li]:text-foreground/90",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_em]:italic",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-primary",
            "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-slate-50 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.75rem] dark:[&_pre]:bg-slate-900/40",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
            "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:py-1.5 [&_blockquote]:pl-2.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
            "[&_hr]:my-3 [&_hr]:border-border",
            "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
            status === "streaming" ? "animate-pulse-slow" : "",
          ].join(" ")}
          style={{ fontSize: "clamp(0.8rem, 0.75rem + 0.15cqi, 0.95rem)" }}
        />
      )}
    </section>
  );
}
