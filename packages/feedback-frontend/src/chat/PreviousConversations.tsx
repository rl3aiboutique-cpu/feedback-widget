/**
 * Collapsible "Conversaciones previas" header for the chat sheet (S3C).
 *
 * Replaces the legacy "Mine" feed: presents a unified list of the
 * user's previous chats and submitted tickets at the top of the chat
 * Sheet so the chat surface stays the protagonist while the resume +
 * unread cues remain one tap away.
 *
 * Behaviour (per F1 + F2 in the task brief):
 *   - Header is COLLAPSED by default; expands on click.
 *   - The parent decides initial expansion via `defaultExpanded`
 *     (computed from "resume available" + "unread admin reply" cues).
 *   - Unread badge in the header turns red when any item has
 *     `unread_admin_replies > 0`.
 *   - Each row is a button; admin-reply contents stay HIDDEN until the
 *     user clicks the row (S3E ships the inline reply rendering).
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactElement, useEffect, useRef, useState } from "react";

import { Badge } from "../ui/badge";
import type { PreviousConversationItem } from "./types";

export interface PreviousConversationsProps {
  items: PreviousConversationItem[];
  onSelectItem: (item: PreviousConversationItem) => void;
  /** Initial expanded state — parent computes from resume / unread cues. */
  defaultExpanded?: boolean;
}

function _statusVariant(
  status: string | undefined,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "new") return "default";
  if (status === "triaged" || status === "in_progress") return "secondary";
  if (status === "wont_fix") return "destructive";
  return "outline";
}

function _humanStatus(status: string | undefined): string {
  switch (status) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Won't fix";
    default:
      return status ?? "—";
  }
}

/** Short Spanish relative time ("hace 2h"). Keeps the UI compact and
 * matches the chat sheet's voice. Falls back to a date for entries
 * older than 30 days. */
function _relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  if (diffMs < 0) return "ahora";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "hace unos s";
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `hace ${day} d`;
  // Older than ~1 month: show the date.
  return new Date(then).toLocaleDateString();
}

export function PreviousConversations({
  items,
  onSelectItem,
  defaultExpanded = false,
}: PreviousConversationsProps): ReactElement {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  // Honour the initial cue once items finish loading. The hook's items
  // array starts empty, then populates after the parallel fetches
  // resolve — at that point `defaultExpanded` may flip from false to
  // true (e.g. the most recent item is an in-progress chat). We apply
  // the flip exactly once, then let the user's explicit clicks own the
  // state for the rest of the sheet's lifetime.
  const appliedRef = useRef<boolean>(false);
  useEffect(() => {
    if (appliedRef.current) return;
    if (items.length === 0) return;
    appliedRef.current = true;
    setExpanded(defaultExpanded);
  }, [items.length, defaultExpanded]);

  const unreadCount = items.reduce((acc, it) => acc + (it.unread_admin_replies ?? 0), 0);
  const hasUnread = unreadCount > 0;
  const count = items.length;

  return (
    <div className="border-b border-input bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
        data-feedback-id="feedback.chat.previous-toggle"
      >
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="font-medium">Conversaciones previas</span>
        <span className="text-xs text-muted-foreground">({count})</span>
        {hasUnread ? (
          <span
            className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground"
            aria-label={`${unreadCount} respuestas sin leer`}
          >
            {unreadCount}
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div className="max-h-64 overflow-y-auto px-2 pb-2">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No tienes conversaciones previas. Empieza una abajo.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((it) => {
                const key = it.kind === "submitted" ? `s-${it.feedback_id}` : `c-${it.session_id}`;
                const unread = (it.unread_admin_replies ?? 0) > 0;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => onSelectItem(it)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                      data-feedback-id="feedback.chat.previous-row"
                    >
                      {it.kind === "submitted" && it.ticket_code ? (
                        <code className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                          {it.ticket_code}
                        </code>
                      ) : null}
                      <Badge variant={_statusVariant(it.status)} className="shrink-0 text-[10px]">
                        {_humanStatus(it.status)}
                      </Badge>
                      <span className="flex-1 truncate font-medium">{it.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {_relativeTime(it.updated_at)}
                      </span>
                      {unread ? (
                        <span
                          aria-label="respuesta sin leer"
                          className="h-2 w-2 shrink-0 rounded-full bg-destructive"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
