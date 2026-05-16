/**
 * "Tickets" tab — unified ticket browser (Patrón A, 2026-05-16).
 *
 * Owns the management surface for both audiences:
 *
 *   - Submitter: scope = "mine" only. Sees their own tickets with
 *     search + status filter (no pagination — the user list is
 *     bounded to the most-recent 50).
 *   - Admin (``useCanTriageFeedback() === true``): scope toggle
 *     between "Mine" and "All". The "All" scope hits the admin
 *     endpoint and supports search + status + type filters with
 *     real pagination (page / page_size).
 *
 * Filter and pagination state lives in this component; switching
 * scope or tabs preserves it via the surrounding ChatSheet stays
 * mounted. Querystring sync is intentionally NOT done — the sheet
 * is an overlay, not a route.
 */

import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { type ReactElement, useState } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { useFeedbackListQuery, useMyFeedbackQuery } from "../adapter";
import type { FeedbackRead, FeedbackStatus, FeedbackType } from "../client";
import { useCanTriageFeedback } from "../hooks/useCanTriageFeedback";

import { TicketRow } from "./TicketRow";

export interface MineFeedTabProps {
  /** Called when the user clicks a row. The sheet swaps to the
   *  inline TicketDetail view. */
  onSelectFeedback?: (feedbackId: string) => void;
}

type Scope = "mine" | "all";

const _STATUS_OPTIONS: readonly FeedbackStatus[] = [
  "open",
  "in_review",
  "in_progress",
  "waiting_for_user",
  "resolved",
  "wont_fix",
  "closed",
];

const _TYPE_OPTIONS: readonly FeedbackType[] = [
  "bug",
  "ui",
  "performance",
  "new_feature",
  "extend_feature",
  "other",
];

const _PAGE_SIZE = 20;

export function MineFeedTab({ onSelectFeedback }: MineFeedTabProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const t = adapter.useTranslation();
  const currentUser = adapter.useCurrentUser();
  const canTriage = useCanTriageFeedback();

  const [scope, setScope] = useState<Scope>("mine");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "">("");
  const [page, setPage] = useState(1);

  const useAll = scope === "all" && canTriage;

  // Mine list — user-side; backend doesn't accept filters here, so we
  // post-filter + paginate client-side. Limit raised to 100 so the
  // 20-per-page UI can flip across at least 5 pages without an extra
  // round trip; users with > 100 tickets are an edge case that admins
  // can flip to scope=all to reach.
  const mineQuery = useMyFeedbackQuery(100);
  // Admin list — paginated; passes filters through to the backend.
  const allQuery = useFeedbackListQuery({
    page,
    pageSize: _PAGE_SIZE,
    status: statusFilter || null,
    type: typeFilter || null,
    q: search.trim() || undefined,
  });

  const isLoading = useAll ? allQuery.isLoading : mineQuery.isLoading;
  const isError = useAll ? allQuery.isError : mineQuery.isError;

  let rows: FeedbackRead[] = useAll
    ? (allQuery.data?.data ?? [])
    : (mineQuery.data ?? []);
  let total = useAll
    ? (allQuery.data?.count ?? 0)
    : (mineQuery.data?.length ?? 0);

  // Client-side filters + pagination for the "Mine" path so search,
  // status, type, and the 20-per-page slice work identically to the
  // admin scope. Cheap on the bounded 100-row list.
  if (!useAll) {
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    if (typeFilter) rows = rows.filter((r) => r.type === typeFilter);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.title ?? "").toLowerCase().includes(needle) ||
          (r.ticket_code ?? "").toLowerCase().includes(needle),
      );
    }
    total = rows.length;
    // Slice to the current page window so the rendered list matches
    // the admin path's page-of-20 contract.
    const start = (page - 1) * _PAGE_SIZE;
    rows = rows.slice(start, start + _PAGE_SIZE);
  }

  const totalPages = Math.max(1, Math.ceil(total / _PAGE_SIZE));

  const onResetFilters = (): void => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {/* Scope toggle (admin only) */}
      {canTriage ? (
        <div className="inline-flex w-full items-center gap-1 rounded-full bg-secondary p-0.5">
          <button
            type="button"
            onClick={() => {
              setScope("mine");
              setPage(1);
            }}
            data-feedback-id="feedback.tickets.scope_mine"
            className={[
              "flex-1 rounded-full px-3 py-1 text-xs font-medium transition",
              scope === "mine"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Mine
          </button>
          <button
            type="button"
            onClick={() => {
              setScope("all");
              setPage(1);
            }}
            data-feedback-id="feedback.tickets.scope_all"
            className={[
              "flex-1 rounded-full px-3 py-1 text-xs font-medium transition",
              scope === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            All
          </button>
        </div>
      ) : null}

      {/* Filters bar — search + status + type */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search title or code…"
            data-feedback-id="feedback.tickets.search"
            className="w-full rounded-md bg-secondary pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as FeedbackStatus | "");
            setPage(1);
          }}
          data-feedback-id="feedback.tickets.status_filter"
          className="rounded-md bg-secondary px-2 py-1 text-xs"
        >
          <option value="">All statuses</option>
          {_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as FeedbackType | "");
            setPage(1);
          }}
          data-feedback-id="feedback.tickets.type_filter"
          className="rounded-md bg-secondary px-2 py-1 text-xs"
        >
          <option value="">All types</option>
          {_TYPE_OPTIONS.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
        {search || statusFilter || typeFilter ? (
          <button
            type="button"
            onClick={onResetFilters}
            data-feedback-id="feedback.tickets.reset"
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        ) : null}
      </div>

      {/* List — scrollable. Rows are now two-line cards so 20 don't
          always fit in the viewport; the inner scrollbar keeps the
          pagination footer pinned at the bottom of the tab. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-4">
            {t("feedback.mine.loading")}
          </p>
        ) : isError ? (
          <p className="text-sm text-destructive p-4">{t("feedback.mine.error")}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No tickets yet
            </p>
            <p className="max-w-[280px] text-xs text-muted-foreground">
              Switch to the <span className="text-foreground">New feedback</span>{" "}
              tab to file your first one — every ticket lands here.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.id}>
                <TicketRow
                  row={r}
                  currentUserId={currentUser?.id ?? null}
                  onClick={() => onSelectFeedback?.(r.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination footer — applies to both scopes (Mine paginates
          client-side, All paginates against the backend). */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {(page - 1) * _PAGE_SIZE + 1}-
            {Math.min(page * _PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              data-feedback-id="feedback.tickets.prev"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] tabular-nums text-foreground">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              data-feedback-id="feedback.tickets.next"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
