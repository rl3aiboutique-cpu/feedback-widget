/**
 * Shared markdown rendering primitives for the iter UIs.
 *
 * Extracted from `IterWorkspace.tsx` in v0.4.1 so the new
 * `IterFocusView` (and any other iter surface that wants to show the
 * spec markdown growing live) can reuse the same look and the same
 * dynamic markdown-it import without lifting the entire admin
 * workspace component.
 *
 * No state, no data fetching here — pure rendering primitives:
 *
 * * `<RenderedMarkdown>` — async-imports `markdown-it`, parses HTML,
 *   replaces the article body. `markdown-it` is configured with
 *   `html: false` so raw HTML in the model output gets stripped.
 * * `<StreamingSkeleton>` — sectioned loading state shown while a
 *   `useIterRunStream` is active, with the active section highlighted.
 * * `_DOC_TYPOGRAPHY` — the long Tailwind class string applied to
 *   the rendered article so headings / lists / code blocks all look
 *   right inside the focus pane and the admin workspace alike.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type IterStreamSection = "personas" | "user_stories" | "spec" | "diagram" | "assumptions";

export const _DOC_TYPOGRAPHY = [
  "flex-1 overflow-auto rounded-lg border bg-card p-6 text-sm leading-relaxed shadow-sm",
  // H1 — gradient bar to give each top-level section visual weight.
  "[&_h1]:relative [&_h1]:scroll-mt-4 [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:first:mt-0",
  "[&_h1]:border-b [&_h1]:border-primary/20",
  "[&_h1]:bg-gradient-to-r [&_h1]:from-primary/5 [&_h1]:to-transparent [&_h1]:px-3 [&_h1]:py-2 [&_h1]:rounded",
  "[&_h2]:scroll-mt-4 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h2]:border-l-4 [&_h2]:border-primary/40 [&_h2]:pl-3",
  "[&_h3]:scroll-mt-4 [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground/90",
  "[&_p]:my-2 [&_p]:text-foreground/90",
  "[&_ul]:my-2 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1",
  "[&_ol]:my-2 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1",
  "[&_li]:text-foreground/90",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-primary",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-slate-50 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed [&_pre]:shadow-inner dark:[&_pre]:bg-slate-900/40",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:py-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-6 [&_hr]:border-border",
  "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
].join(" ");

export function RenderedMarkdown({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    void import("markdown-it").then(({ default: MarkdownIt }) => {
      if (cancelled || !ref.current) return;
      const md = new MarkdownIt({ html: false, breaks: false, linkify: true });
      const defaultHeadingOpen = md.renderer.rules.heading_open ?? null;
      md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
        const inline = tokens[idx + 1];
        const text = inline?.children ? inline.children.map((c) => c.content).join("") : "";
        const id = `iter-toc-${text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")}`;
        const token = tokens[idx];
        if (token) token.attrSet("id", id);
        return defaultHeadingOpen
          ? defaultHeadingOpen(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
      };
      const html = md.render(markdown);
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const fragment = range.createContextualFragment(html);
      ref.current.replaceChildren(fragment);
    });
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  return <article ref={ref} className={className ?? _DOC_TYPOGRAPHY} />;
}

const _SECTION_SKELETONS: Array<{
  key: Exclude<IterStreamSection, "assumptions">;
  heading: string;
  hint: string;
}> = [
  { key: "personas", heading: "Personas", hint: "Who uses this?" },
  { key: "user_stories", heading: "User Stories", hint: "What do they do?" },
  { key: "spec", heading: "Spec", hint: "How does it work?" },
  { key: "diagram", heading: "Diagram", hint: "Flow diagram" },
];

const _THINKING_MESSAGES: readonly string[] = [
  "Reading your feedback…",
  "Reading the attached files…",
  "Looking at the technical metadata…",
  "Imagining who'd use this…",
  "Drafting personas…",
  "Thinking through edge cases…",
  "Naming things (the hard part)…",
  "Writing user stories…",
  "Sketching Gherkin scenarios…",
  "Outlining the spec…",
  "Sketching the diagram…",
  "Re-reading my own draft…",
  "Counting hidden assumptions…",
  "Looking for the bits I'd otherwise hand-wave past…",
  "Asking myself: what would surprise this user?",
  "One last pass for consistency…",
];

function _useRotatingMessage(active: boolean): string {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const id = window.setInterval(() => {
      setIdx((cur) => (cur + 1) % _THINKING_MESSAGES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [active]);
  return _THINKING_MESSAGES[idx] ?? _THINKING_MESSAGES[0] ?? "Thinking…";
}

function ThinkingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-end gap-1">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
    </span>
  );
}

export function StreamingSkeleton({
  activeSection,
  modelHint,
}: {
  activeSection: IterStreamSection | null;
  modelHint: string;
}) {
  const message = _useRotatingMessage(true);
  return (
    <div className="flex-1 space-y-5 overflow-auto rounded-lg border bg-card p-6 text-sm">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <p className="flex items-center gap-2 font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI is drafting your spec
          <ThinkingDots />
        </p>
        <p className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground transition-opacity">
          {message}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground/80">
          {modelHint} Sections below turn green as they arrive.
        </p>
      </div>
      {_SECTION_SKELETONS.map((s, idx) => {
        const isActive = activeSection === s.key;
        const isPast =
          activeSection && _SECTION_SKELETONS.findIndex((x) => x.key === activeSection) > idx;
        const cardClass = isActive
          ? "border-primary bg-primary/5"
          : isPast
            ? "border-emerald-200 bg-emerald-50/40"
            : "border-input bg-muted/30";
        const titleClass = isActive ? "text-primary" : isPast ? "text-emerald-700" : "";
        const barBaseClass = isActive ? "animate-pulse bg-primary/30" : "bg-muted";
        return (
          <div key={s.key} className={`rounded-md border p-4 transition-colors ${cardClass}`}>
            <div className="flex items-center gap-2">
              <h4 className={`text-base font-semibold ${titleClass}`}>{s.heading}</h4>
              {isActive && <span className="text-xs text-primary">writing now…</span>}
              {isPast && <span className="text-xs text-emerald-700">done</span>}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{s.hint}</p>
            <div className="space-y-2">
              <div className={`h-3 w-[85%] rounded ${barBaseClass}`} />
              <div className={`h-3 w-[70%] rounded ${barBaseClass}`} />
              <div className={`h-3 w-[92%] rounded ${barBaseClass}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function modelLatencyHint(modelId: string): string {
  const m = modelId.toLowerCase();
  if (m.includes("flash-lite")) return "10–30s typical with Flash Lite.";
  if (m.includes("flash")) return "20–60s typical on Flash models.";
  if (m.startsWith("gemma-3")) return "60–180s typical on Gemma 3.";
  if (m.startsWith("gemma-4")) return "90–240s typical on Gemma 4.";
  if (m.startsWith("gemma")) return "60–240s typical on Gemma models.";
  if (m.startsWith("claude-haiku")) return "5–15s typical with Haiku.";
  if (m.startsWith("claude-sonnet")) return "15–45s typical with Sonnet.";
  if (m.startsWith("claude-opus")) return "30–90s typical with Opus.";
  if (m.startsWith("gpt") || m.startsWith("o1")) return "10–30s typical on OpenAI models.";
  return "May take a few minutes on the free tier.";
}
