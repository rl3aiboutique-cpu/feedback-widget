/**
 * Helpers for the v0.5 progressive section-card rendering.
 *
 * The iter spec markdown follows a fixed five-section structure with
 * known H2 headings (system prompt enforces this). The backend's
 * `SectionDetector` (`iter_sse.py:94`) emits an SSE `section` event
 * the first time each H2 appears so the client can light up sections
 * progressively.
 *
 * This module owns:
 *
 * 1. The fixed section order (`SPEC_SECTION_ORDER`).
 * 2. The H2 heading literal each section starts with — used by
 *    `splitMarkdownByH2()` when rendering a *completed* version's
 *    `output_markdown` (no streaming events available, so we slice
 *    by heading client-side instead).
 * 3. The `SectionStatus` enum + the per-section state shape used by
 *    `useIterRunStream`.
 *
 * Pre-flight on 2026-05-07: zero footnotes (`[^.*]:`) in real DB
 * samples → markdown-it per slice is safe (no link-def cross-refs to
 * worry about). Block B uses one markdown-it pass per slice.
 *
 * v0.5.0 — Block B.
 */

export const SPEC_SECTION_ORDER = [
  "personas",
  "user_stories",
  "spec",
  "diagram",
  "assumptions",
] as const;

export type SpecSectionKey = (typeof SPEC_SECTION_ORDER)[number];

export type SectionStatus = "pending" | "streaming" | "done";

export interface SpecSectionEntry {
  status: SectionStatus;
  /** Cumulative markdown for this section. While streaming this
   * grows token-by-token; for a completed past version it's the full
   * slice produced by `splitMarkdownByH2`. */
  markdown: string;
}

export type SpecSectionStates = Record<SpecSectionKey, SpecSectionEntry>;

/** Literal H2 prefix the system prompt emits for each section.
 * Order matches `SPEC_SECTION_ORDER`. The backend `SectionDetector`
 * uses the same strings (`iter_sse.py:94-100`); keep in sync. */
export const SECTION_H2_PREFIX: Record<SpecSectionKey, string> = {
  personas: "## Personas",
  user_stories: "## User Stories",
  spec: "## Spec",
  diagram: "## Diagram",
  assumptions: "## Assumptions",
};

/** Human-friendly label per section. UI cards show this in the
 * header strip + as the skeleton hint when pending. Spanish copy
 * for the user-facing context; the H2s in the markdown stay in
 * English because the system prompt locks them. */
export const SECTION_LABEL: Record<SpecSectionKey, string> = {
  personas: "Personas",
  user_stories: "User Stories",
  spec: "Spec",
  diagram: "Diagram",
  assumptions: "Assumptions",
};

/** Approximate vertical density per section. Used as `min-height`
 * (in `em`) on the SpecSectionCard skeleton so the layout doesn't
 * shift when content arrives. Ballpark estimates from prod data;
 * if real content is shorter the card has trailing blank space —
 * cosmetic only. */
export const SECTION_SKELETON_HEIGHT_EM: Record<SpecSectionKey, number> = {
  personas: 8,
  user_stories: 14,
  spec: 24,
  diagram: 6,
  assumptions: 12,
};

export const _INITIAL_SECTION_STATES: SpecSectionStates = {
  personas: { status: "pending", markdown: "" },
  user_stories: { status: "pending", markdown: "" },
  spec: { status: "pending", markdown: "" },
  diagram: { status: "pending", markdown: "" },
  assumptions: { status: "pending", markdown: "" },
};

/** Slice a completed `output_markdown` into per-section entries.
 *
 * Used when rendering a *past* version (no SSE replay) — finds the
 * H2 boundaries and assigns each region to its section key. Anything
 * before the first H2 (rare; should be empty by prompt design) is
 * dropped silently. Sections without their H2 in the input land as
 * empty `done` entries, NOT `pending`, because the version is
 * complete from the user's POV. */
export function splitMarkdownByH2(markdown: string): SpecSectionStates {
  const out: SpecSectionStates = {
    personas: { status: "done", markdown: "" },
    user_stories: { status: "done", markdown: "" },
    spec: { status: "done", markdown: "" },
    diagram: { status: "done", markdown: "" },
    assumptions: { status: "done", markdown: "" },
  };
  if (!markdown.trim()) return out;

  // Find the start index of each section by its literal H2 prefix.
  // We anchor at line starts to avoid matching `## Personas` inside a
  // code fence or a paragraph reference.
  const lines = markdown.split("\n");
  const sectionStart: Partial<Record<SpecSectionKey, number>> = {};
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    for (const key of SPEC_SECTION_ORDER) {
      if (line.startsWith(SECTION_H2_PREFIX[key]) && sectionStart[key] === undefined) {
        sectionStart[key] = li;
      }
    }
  }

  // Slice from each section's H2 line up to (but not including) the
  // next section's H2 line. Sections that never appeared stay empty.
  for (let i = 0; i < SPEC_SECTION_ORDER.length; i++) {
    const key = SPEC_SECTION_ORDER[i];
    if (key === undefined) continue;
    const start = sectionStart[key];
    if (start === undefined) continue;
    let end = lines.length;
    for (let j = i + 1; j < SPEC_SECTION_ORDER.length; j++) {
      const nextKey = SPEC_SECTION_ORDER[j];
      if (nextKey === undefined) continue;
      const nextStart = sectionStart[nextKey];
      if (nextStart !== undefined) {
        end = nextStart;
        break;
      }
    }
    out[key] = {
      status: "done",
      markdown: lines.slice(start, end).join("\n").trim(),
    };
  }
  return out;
}
