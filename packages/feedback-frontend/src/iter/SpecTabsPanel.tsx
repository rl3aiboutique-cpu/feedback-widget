/**
 * Left panel of the v0.7 focus view — the document, tabbed.
 *
 * Replaces the v0.6 vertical stack of section cards with Radix
 * Tabs over the four canonical sections (Personas / User Stories /
 * Spec / Diagrama). Tabs lock attention to one section at a time;
 * the active tab body fills the panel below.
 *
 * Behaviours:
 *
 *   - Auto-follow during stream: SSE `activeSection` swaps the
 *     active tab. User clicking a different tab cancels auto-follow
 *     for the rest of this stream.
 *   - Highlight-glow: when a new version arrives, the active tab's
 *     body gets a yellow tint that fades over 2s.
 *   - Per-tab edit: [Editar] swaps the tab body to a textarea with
 *     just that section's slice; save splices it back into the full
 *     markdown.
 *   - Diagrama tab: renders DiagramPanel (Mermaid SVG) directly.
 *
 * v0.7.0.
 */

import * as Tabs from "@radix-ui/react-tabs";
import { Pencil, Save, X } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { DiagramPanel } from "./DiagramPanel";
import {
  SECTION_LABEL,
  SPEC_SECTION_ORDER,
  type SpecSectionKey,
  type SpecSectionStates,
  spliceSectionInMarkdown,
  splitMarkdownByH2,
} from "./specSectionState";

export interface SpecTabsPanelProps {
  latestMarkdown: string;
  latestVersionId: string | null;
  streaming: boolean;
  sectionStates?: SpecSectionStates;
  activeStreamSection: SpecSectionKey | null;
  editable: boolean;
  onSaveEdit: (next: string) => Promise<unknown>;
  saving: boolean;
}

const _ALL_KEYS: ReadonlyArray<SpecSectionKey> = SPEC_SECTION_ORDER;

export function SpecTabsPanel(props: SpecTabsPanelProps): ReactElement {
  const {
    latestMarkdown,
    latestVersionId,
    streaming,
    sectionStates,
    activeStreamSection,
    editable,
    onSaveEdit,
    saving,
  } = props;

  const derivedStates = useMemo<SpecSectionStates>(() => {
    if (streaming && sectionStates) return sectionStates;
    if (latestMarkdown) return splitMarkdownByH2(latestMarkdown);
    return {
      personas: { status: "pending", markdown: "" },
      user_stories: { status: "pending", markdown: "" },
      spec: { status: "pending", markdown: "" },
      diagram: { status: "pending", markdown: "" },
    };
  }, [streaming, sectionStates, latestMarkdown]);

  const [activeTab, setActiveTab] = useState<SpecSectionKey>("personas");
  const userOverrodeRef = useRef(false);

  useEffect(() => {
    if (!streaming) {
      userOverrodeRef.current = false;
      return;
    }
    if (userOverrodeRef.current) return;
    if (!activeStreamSection) return;
    setActiveTab(activeStreamSection);
  }, [streaming, activeStreamSection]);

  const onTabChange = (next: string) => {
    if (streaming) userOverrodeRef.current = true;
    setActiveTab(next as SpecSectionKey);
  };

  const [glow, setGlow] = useState(false);
  const lastSeenVersionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!latestVersionId) return;
    if (lastSeenVersionRef.current === null) {
      lastSeenVersionRef.current = latestVersionId;
      return;
    }
    if (lastSeenVersionRef.current === latestVersionId) return;
    lastSeenVersionRef.current = latestVersionId;
    setGlow(true);
    const id = window.setTimeout(() => setGlow(false), 2000);
    return () => window.clearTimeout(id);
  }, [latestVersionId]);

  const [editing, setEditing] = useState<SpecSectionKey | null>(null);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(derivedStates[activeTab].markdown);
    setEditing(activeTab);
  };
  const cancelEditing = () => {
    setEditing(null);
    setDraft("");
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!draft.trim()) return;
    const next = spliceSectionInMarkdown(latestMarkdown, editing, draft);
    await onSaveEdit(next);
    setEditing(null);
    setDraft("");
  };

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={onTabChange}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex items-center gap-2 border-b border-input px-2 pt-1">
        <Tabs.List className="flex flex-1 gap-0.5">
          {_ALL_KEYS.map((k) => (
            <Tabs.Trigger
              key={k}
              value={k}
              className={[
                "rounded-t border-b-2 border-transparent px-2.5 py-1.5",
                "data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary",
                "text-muted-foreground hover:text-foreground",
                derivedStates[k].status === "streaming"
                  ? "after:ml-1 after:inline-block after:h-1.5 after:w-1.5 after:animate-pulse after:rounded-full after:bg-primary"
                  : "",
              ].join(" ")}
              style={{ fontSize: "0.75rem" }}
            >
              {SECTION_LABEL[k]}
              {derivedStates[k].status === "done" ? (
                <span className="ml-1 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                  {" "}
                  ✓
                </span>
              ) : null}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {editable && !editing ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={startEditing}
            className="h-7 px-2"
            disabled={!latestMarkdown}
            title={`Editar ${SECTION_LABEL[activeTab]}`}
          >
            <Pencil className="h-3 w-3" /> <span style={{ fontSize: "0.7rem" }}>Editar</span>
          </Button>
        ) : null}
        {editing ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelEditing}
              className="h-7 px-2"
              disabled={saving}
              title="Cancelar edición"
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              onClick={saveEdit}
              className="h-7 px-2"
              disabled={saving || !draft.trim()}
              title="Guardar"
            >
              <Save className="h-3 w-3" />{" "}
              <span style={{ fontSize: "0.7rem" }}>{saving ? "Guardando…" : "Guardar"}</span>
            </Button>
          </div>
        ) : null}
      </div>

      {_ALL_KEYS.map((k) => (
        <Tabs.Content
          key={k}
          value={k}
          className={[
            "flex-1 min-h-0 overflow-auto",
            glow
              ? "bg-yellow-500/10 transition-colors duration-1000"
              : "transition-colors duration-1000",
          ].join(" ")}
        >
          {editing === k ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={28}
              className="m-3 min-h-[60vh] resize-y font-mono"
              style={{ fontSize: "0.75rem" }}
              placeholder={`Escribe el contenido de ${SECTION_LABEL[k]} en Markdown…`}
            />
          ) : k === "diagram" ? (
            <div className="p-3">
              <DiagramPanel markdown={derivedStates[k].markdown} status={derivedStates[k].status} />
            </div>
          ) : (
            <_TabBody
              status={derivedStates[k].status}
              markdown={derivedStates[k].markdown}
              sectionKey={k}
            />
          )}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

function _TabBody({
  status,
  markdown,
  sectionKey,
}: {
  status: "pending" | "streaming" | "done";
  markdown: string;
  sectionKey: SpecSectionKey;
}): ReactElement {
  const bodyRef = useRef<HTMLElement | null>(null);

  const bodyMarkdown = useMemo(() => {
    if (!markdown) return markdown;
    const newlineIdx = markdown.indexOf("\n");
    const firstLine = newlineIdx === -1 ? markdown : markdown.slice(0, newlineIdx);
    const labelLower = SECTION_LABEL[sectionKey].toLowerCase();
    const headingRegex = /^#{1,6}\s+(.+?)$/.exec(firstLine);
    if (headingRegex && headingRegex[1]?.trim().toLowerCase() === labelLower) {
      return markdown.slice(newlineIdx + 1).trimStart();
    }
    return markdown;
  }, [markdown, sectionKey]);

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

  if (status === "pending") {
    return (
      <div
        className="flex h-full items-center justify-center text-muted-foreground"
        style={{ fontSize: "0.75rem" }}
      >
        Esperando que el AI escriba esta sección…
      </div>
    );
  }

  if (status === "done" && !markdown.trim()) {
    return (
      <div
        className="flex h-full items-center justify-center italic text-muted-foreground"
        style={{ fontSize: "0.75rem" }}
      >
        Esta versión del spec no incluye contenido para esta sección.
      </div>
    );
  }

  return (
    <article
      ref={bodyRef}
      className={[
        "px-4 py-3 leading-snug",
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-2.5 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:mb-0.5 [&_h3]:text-[0.85rem] [&_h3]:font-semibold",
        "[&_p]:my-1 [&_p]:text-foreground/90",
        "[&_ul]:my-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-0.5",
        "[&_ol]:my-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-0.5",
        "[&_li]:text-foreground/90",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8em] [&_code]:text-primary",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-slate-50 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.7rem] dark:[&_pre]:bg-slate-900/40",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-foreground",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:bg-primary/5 [&_blockquote]:py-1 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-muted-foreground",
        "[&_hr]:my-2.5 [&_hr]:border-border",
        "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[0.7rem]",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-1.5 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_td]:py-1",
      ].join(" ")}
      style={{ fontSize: "0.8rem" }}
    />
  );
}
