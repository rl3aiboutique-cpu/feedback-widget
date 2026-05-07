/**
 * Left sidebar of the iter focus view.
 *
 * All open assumptions visible as a roving-tabindex listbox — no
 * `+ N más` disclosure. Compact card per item: kind chip, confidence
 * %, title (`statement`) clamped to 2 lines. Active item highlighted
 * by `selectedId`.
 *
 * Below the open list, a `<details>` with the resolved assumptions
 * for at-a-glance progress without dominating the column.
 *
 * Keyboard:
 *   ↑ / ↓   cycle within the listbox
 *   Home    first item
 *   End     last item
 *   Enter   activate the focused item (= select it as the main card)
 *   Tab     leave the sidebar
 *
 * Focus model: roving tabindex — only the focused item is `tabIndex=0`,
 * the rest are `tabIndex=-1`. Click also selects.
 *
 * v0.5.0 — Block A.
 */

import {
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { IterAssumptionRead } from "../client/types";

const _KIND_CHIP: Record<IterAssumptionRead["kind"], string> = {
  technical: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  business: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  ux: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-200",
  scope: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
};

const _STATUS_DOT: Record<IterAssumptionRead["status"], string> = {
  open: "bg-yellow-500",
  confirmed: "bg-emerald-500",
  corrected: "bg-blue-500",
  irrelevant: "bg-muted-foreground",
};

export interface IterPendingSidebarProps {
  openAssumptions: IterAssumptionRead[];
  resolvedAssumptions: IterAssumptionRead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Disables click + Enter activation when the parent has finalized
   * or abandoned the session. Keyboard navigation still works (read-
   * only browsing). */
  disabled?: boolean;
}

export function IterPendingSidebar({
  openAssumptions,
  resolvedAssumptions,
  selectedId,
  onSelect,
  disabled = false,
}: IterPendingSidebarProps): ReactElement {
  const items = openAssumptions;
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Roving-tabindex: which item is currently the keyboard focus stop.
  // Initialise to the selected one if present, else 0. Stays in sync
  // with parent-driven `selectedId` so click-to-select also moves the
  // tab stop.
  const initialFocusIdx = useMemo(() => {
    const i = items.findIndex((a) => a.id === selectedId);
    return i >= 0 ? i : 0;
  }, [items, selectedId]);
  const [focusIdx, setFocusIdx] = useState<number>(initialFocusIdx);

  // Keep focusIdx in range when the open list shrinks (e.g. user just
  // resolved one).
  useEffect(() => {
    if (items.length === 0) return;
    if (focusIdx >= items.length) setFocusIdx(items.length - 1);
  }, [items.length, focusIdx]);

  const moveFocus = useCallback(
    (next: number) => {
      const len = items.length;
      if (len === 0) return;
      const wrapped = ((next % len) + len) % len;
      setFocusIdx(wrapped);
      itemRefs.current[wrapped]?.focus();
    },
    [items.length],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveFocus(focusIdx + 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus(focusIdx - 1);
          break;
        case "Home":
          e.preventDefault();
          moveFocus(0);
          break;
        case "End":
          e.preventDefault();
          moveFocus(items.length - 1);
          break;
        case "Enter":
          e.preventDefault();
          if (!disabled && items[focusIdx]) onSelect(items[focusIdx].id);
          break;
        default:
          break;
      }
    },
    [focusIdx, items, moveFocus, onSelect, disabled],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-input bg-card">
      {/* Sticky header — count + label. */}
      <div className="sticky top-0 z-10 border-b border-input bg-card/95 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-primary backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <span aria-hidden="true">❓</span>{" "}
        <span>Preguntas pendientes ({openAssumptions.length})</span>
      </div>

      {/* Open-assumption listbox. Scrolls inside the sidebar so the
          rest of the rail/main stays visible above the fold. */}
      <div
        // biome-ignore lint/a11y/useSemanticElements: listbox keyboard semantics intentional
        role="listbox"
        aria-label="Preguntas pendientes"
        aria-activedescendant={items[focusIdx] ? `iter-pending-${items[focusIdx].id}` : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex-1 min-h-0 overflow-auto px-2 py-2 space-y-1.5"
      >
        {items.length === 0 ? (
          <p className="px-1 py-3 text-center text-[0.7rem] text-muted-foreground">
            Nada pendiente.
          </p>
        ) : (
          items.map((a, i) => {
            const selected = a.id === selectedId;
            const tabStop = i === focusIdx;
            const confidencePct = Math.round((a.confidence ?? 0) * 100);
            return (
              <button
                key={a.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                id={`iter-pending-${a.id}`}
                // biome-ignore lint/a11y/useSemanticElements: <option> is for <select>; this is the WAI-ARIA listbox/option pattern with roving tabindex
                role="option"
                aria-selected={selected}
                tabIndex={tabStop ? 0 : -1}
                disabled={disabled}
                onClick={() => onSelect(a.id)}
                onFocus={() => setFocusIdx(i)}
                className={[
                  "block w-full rounded border px-2 py-1.5 text-left transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-input bg-background hover:bg-accent",
                ].join(" ")}
                style={{ fontSize: "clamp(0.7rem, 0.6rem + 0.2cqi, 0.8rem)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${_STATUS_DOT[a.status]}`}
                  />
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 font-mono uppercase tracking-wide ${_KIND_CHIP[a.kind]}`}
                    style={{ fontSize: "0.55rem" }}
                  >
                    {a.kind}
                  </span>
                  <span
                    className="ml-auto shrink-0 font-mono text-muted-foreground"
                    style={{ fontSize: "0.6rem" }}
                    title={`Confianza ${confidencePct}%`}
                  >
                    {confidencePct}%
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 leading-snug">{a.statement}</p>
              </button>
            );
          })
        )}
      </div>

      {/* Resolved disclosure — collapsed by default to keep the sidebar
          quiet during deep work. Counter visible on the summary line. */}
      <details className="border-t border-input">
        <summary className="cursor-pointer select-none px-3 py-1.5 text-[0.7rem] font-medium hover:bg-accent">
          <span>Resueltas</span>{" "}
          <span
            className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200"
            style={{ fontSize: "0.6rem" }}
          >
            {resolvedAssumptions.length}
          </span>
        </summary>
        <div className="max-h-[40vh] overflow-auto border-t border-input px-2 py-2 space-y-1">
          {resolvedAssumptions.length === 0 ? (
            <p
              className="px-1 py-2 text-center italic text-muted-foreground"
              style={{ fontSize: "0.65rem" }}
            >
              Nada resuelto todavía.
            </p>
          ) : (
            resolvedAssumptions.map((a) => (
              <div
                key={a.id}
                className="rounded border border-input bg-background px-1.5 py-1 leading-snug"
                style={{ fontSize: "0.65rem" }}
              >
                <div className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${_STATUS_DOT[a.status]}`}
                  />
                  <code
                    className="truncate font-mono text-muted-foreground"
                    style={{ fontSize: "0.6rem" }}
                  >
                    {a.slot_key}
                  </code>
                </div>
                <p className="mt-0.5 line-clamp-2">{a.statement}</p>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
