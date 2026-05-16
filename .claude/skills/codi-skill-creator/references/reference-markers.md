# Resource Reference Markers

## Why markers exist

Every file path written inside a skill (from `template.ts` to any
`references/*.md`) that points at another file in the same skill must be
wrapped with `[[/path]]` markers. The pre-commit hook
`codi-skill-resource-check` walks every marker and confirms the target
file actually exists; a bare path inside prose is invisible to the hook
and rots silently when files are renamed or moved.

The Claude Code adapter strips `[[...]]` at generate time, so end-users
never see the markers. Every other adapter (Cline, Cursor, Windsurf,
Agents CLI, Codex) keeps them verbatim — they are inert to the AI and
only meaningful to the validator.

## The two syntaxes

The marker syntax differs by where the reference lives:

| Where it appears          | Correct syntax                                | What gets stripped |
|---------------------------|-----------------------------------------------|--------------------|
| `template.ts` / `SKILL.md` | <example>${CLAUDE_SKILL_DIR}[[/scripts/run.py]]</example>     | Only `[[...]]`; `${CLAUDE_SKILL_DIR}` is substituted by Claude Code at runtime |
| `references/*.md`          | <example>[[/scripts/run.py]]</example>                         | The whole marker; no variable prefix |

The reason for the difference: Claude Code substitutes
`${CLAUDE_SKILL_DIR}` only in files it actively injects (SKILL.md). Static
reference files under `references/` are read directly with the `Read`
tool — no substitution happens, so there is no variable to place.

## Path resolution rules

- Markers resolve relative to the skill directory, not the file they
  appear in. <example>[[/scripts/run.py]]</example> means
  `<skill-dir>/scripts/run.py`, regardless of whether the reference is
  written from `template.ts`, `references/foo.md`, or
  `references/deeply/nested/bar.md`.
- A leading `/` is mandatory. <example>[[scripts/run.py]]</example> (no leading slash) is
  tolerated by the extractor but conventionally wrong.
- The inner path must not contain glob characters, URL schemes, or the
  literal word `path`. These are excluded by the hook to avoid matching
  example syntax.

## Documenting the syntax itself

When a reference *documents* the syntax (rather than actually pointing at
a file), wrap the marker in `<example>...</example>` tags. The hook skips
everything inside `<example>` blocks:

```
<example>${CLAUDE_SKILL_DIR}/scripts/run.py</example>
```

Without the wrapper, the validator treats the documented path as a real
reference and fails the commit.

## Common mistakes

1. **Bare paths in prose** — <example>scripts/run.py</example> or <example>./scripts/run.py</example>
   written inline. The hook catches some of these via
   `codi-skill-path-wrap-check`, but not all. Wrap everything.
2. **Wrong variable prefix in `references/*.md`** — writing
   <example>${CLAUDE_SKILL_DIR}[[/path]]</example> in a reference file produces a literal
   `${CLAUDE_SKILL_DIR}` in output. Use bare <example>[[/path]]</example> there.
3. **Spaced markers** — <example>[[ /path ]]</example> is tolerated for backward
   compatibility but should not appear in new content. Use the compact
   form.
4. **Markers for non-file content** — do not use <example>[[/path]]</example> for URLs,
   section anchors, or external documentation links. Markers are for
   on-disk paths only.

## Verification

The pre-commit hook's diagnostic block describes how to debug a failing
reference check, including how to tell whether the failure is in the
source template or in an already-installed copy. When in doubt, read the
hook output end-to-end before assuming which layer is broken.
