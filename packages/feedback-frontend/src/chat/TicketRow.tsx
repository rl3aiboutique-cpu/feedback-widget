/**
 * Single-line dense ticket row used inside the "Tickets" tab list.
 *
 * Shows all metadata inline so 20 rows fit in the sheet's available
 * height without scrolling. Layout:
 *
 *   [Open] [blocker] FB-2026-0042  Title…   👤 You · 🐛 bug · 📎 2 · 6s ago
 *
 * Title truncates with ellipsis. Optional fields (severity, type,
 * attachments, creator hint) collapse into the metadata strip on
 * the right when present.
 */

import { Bug, Paperclip, User as UserIcon } from "lucide-react";
import type { ReactElement } from "react";

import type { FeedbackRead } from "../client";

import { StatusPill } from "./StatusPill";

export interface TicketRowProps {
  row: FeedbackRead;
  /** Current user id — when matches `row.user_id` we render "You"
   *  so the user recognises their own tickets at a glance. */
  currentUserId?: string | null;
  onClick: () => void;
}

function _relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function _shortId(id: string): string {
  if (!id || id.length <= 10) return id || "?";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const _SEVERITY_STYLES: Record<string, string> = {
  blocker: "border-destructive/40 bg-destructive/10 text-destructive",
  major: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  minor: "border-blue-500/30 bg-blue-500/10 text-blue-600",
  idea: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
};

export function TicketRow({
  row,
  currentUserId,
  onClick,
}: TicketRowProps): ReactElement {
  const lastActivity =
    row.last_admin_msg_at ?? row.last_user_msg_at ?? row.updated_at ?? row.created_at;
  const isOwnTicket = currentUserId && row.user_id === currentUserId;
  const creatorLabel = isOwnTicket ? "You" : _shortId(row.user_id);
  const attachmentCount = row.attachments?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      data-feedback-id="feedback.tickets.row"
      title={row.title ?? "(no title yet)"}
      className="flex w-full items-center gap-2 rounded-md border border-input/60 bg-background px-2.5 py-1.5 text-left text-xs transition hover:border-primary/40 hover:bg-accent/50"
    >
      <StatusPill status={row.status} />
      {row.severity ? (
        <span
          className={`hidden md:inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${
            _SEVERITY_STYLES[row.severity] ??
            "border-muted-foreground/30 bg-muted text-muted-foreground"
          }`}
        >
          {row.severity}
        </span>
      ) : null}
      <code className="hidden sm:inline shrink-0 font-mono text-[10px] text-muted-foreground">
        {row.ticket_code || "—"}
      </code>
      {row.user_action_required ? (
        <span
          className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
          title="Action required"
          aria-label="Action required"
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate text-foreground">
        {row.title ?? (
          <span className="italic text-muted-foreground">(no title yet)</span>
        )}
      </span>
      <span className="ml-auto hidden md:inline-flex shrink-0 items-center gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserIcon className="h-3 w-3" />
          <span className="font-mono">{creatorLabel}</span>
        </span>
        {row.type ? (
          <span className="inline-flex items-center gap-1">
            <Bug className="h-3 w-3" />
            {row.type}
          </span>
        ) : null}
        {attachmentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {attachmentCount}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {_relativeTime(lastActivity)}
      </span>
    </button>
  );
}
