/**
 * Helpers for the v0.5 progressive section-card rendering.
 *
 * The iter spec markdown follows a fixed FOUR-section structure (the
 * fifth — Assumptions — was a parser artifact: the prompt emits
 * assumptions as JSON, not as a markdown section, so the card was
 * always going to be empty. Removed in v0.5.1).
 *
 * The backend's `SectionDetector` (`iter_sse.py:94`) emits an SSE
 * `section` event the first time each canonical heading appears so
 * the client can light up sections progressively.
 *
 * v0.5.1 — bug fix: the prompt emits H1 (`# Personas`), not H2
 * (`## Personas`) — see `iter_prompts/system_v1.py:369`. Both the
 * frontend splitter and the backend SectionDetector were looking
 * for `## ` only, so they never matched and the cards rendered as
 * empty "done". The matchers are now level-agnostic regexes
 * (`/^#{1,6}\s+Personas\b/i`) so they catch H1 / H2 / H3 / etc.
 *
 * This module owns:
 *
 * 1. The fixed section order (`SPEC_SECTION_ORDER`).
 * 2. The regex per section — used by `splitMarkdownByH2()` AND
 *    by consumers that need to recognise a heading line.
 * 3. The `SectionStatus` enum + the per-section state shape used by
 *    `useIterRunStream`.
 *
 * Pre-flight on 2026-05-07: zero footnotes (`[^.*]:`) in real DB
 * samples → markdown-it per slice is safe (no link-def cross-refs).
 */

export const SPEC_SECTION_ORDER = ["personas", "user_stories", "spec", "diagram"] as const;

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

/** Heading-line regex per canonical section.
 *
 * Level-agnostic (`#{1,6}`) so the parser tolerates the prompt
 * emitting `# Personas` (H1, current) or `## Personas` (H2, what the
 * older comments assumed). Case-insensitive for safety. The trailing
 * `\b` anchors the label so `Spec` doesn't match `Specification`.
 */
export const SECTION_PATTERN: Record<SpecSectionKey, RegExp> = {
  personas: /^#{1,6}\s+Personas\b/i,
  user_stories: /^#{1,6}\s+User\s+Stories\b/i,
  spec: /^#{1,6}\s+Spec\b/i,
  diagram: /^#{1,6}\s+Diagram\b/i,
};

/** Human-friendly label per section. UI cards show this in the
 * header strip + as the skeleton hint when pending. */
export const SECTION_LABEL: Record<SpecSectionKey, string> = {
  personas: "Personas",
  user_stories: "User Stories",
  spec: "Spec",
  diagram: "Diagram",
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
};

export const _INITIAL_SECTION_STATES: SpecSectionStates = {
  personas: { status: "pending", markdown: "" },
  user_stories: { status: "pending", markdown: "" },
  spec: { status: "pending", markdown: "" },
  diagram: { status: "pending", markdown: "" },
};

/** Slice a completed `output_markdown` into per-section entries.
 *
 * Used when rendering a *past* version (no SSE replay) — finds the
 * heading boundaries via `SECTION_PATTERN` and assigns each region
 * to its section key. Anything before the first match (rare) is
 * dropped silently. Sections without their heading in the input
 * land as empty `done` entries (the version is complete from the
 * user's POV — no point showing a permanent skeleton). */
export function splitMarkdownByH2(markdown: string): SpecSectionStates {
  const out: SpecSectionStates = {
    personas: { status: "done", markdown: "" },
    user_stories: { status: "done", markdown: "" },
    spec: { status: "done", markdown: "" },
    diagram: { status: "done", markdown: "" },
  };
  if (!markdown.trim()) return out;

  const lines = markdown.split("\n");
  const sectionStart: Partial<Record<SpecSectionKey, number>> = {};
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (!line) continue;
    for (const key of SPEC_SECTION_ORDER) {
      if (sectionStart[key] !== undefined) continue;
      if (SECTION_PATTERN[key].test(line)) {
        sectionStart[key] = li;
      }
    }
  }

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
