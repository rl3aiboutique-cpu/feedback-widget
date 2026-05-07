/**
 * Canvas — single scrolling surface that replaces the v0.3.x
 * Submit / Mine tab pattern.
 *
 * Top: sticky `<Compose>` form. Below: vertical feed of the user's
 * feedback rows. Each row expands in place; expanding shows the
 * description, comments, and (when the user clicks Iterate) an
 * inline `<InlineIterPane>` — no modal-over-Sheet.
 *
 * Compose's submit pipeline calls `onSubmitted` with the new feedback
 * id; the canvas auto-expands that card and (if "Send and Iterate"
 * was used) starts an iter session inline.
 */

import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

import { Compose } from "./Compose";
import type { LockedElement } from "./FeedbackButton";
import { useFeedbackAdapter, useFeedbackBindings, useFeedbackConfig } from "./FeedbackProvider";
import { useMyFeedbackQuery } from "./adapter";
import type { FeedbackAttachmentRead, FeedbackRead } from "./client";
import { startIterSession } from "./client/iter";
import { CommentThread } from "./comments/CommentThread";
import { InlineIterPane } from "./iter/InlineIterPane";
import { IterFocusView } from "./iter/IterFocusView";
import type { FeedbackStatusKey } from "./types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function statusVariant(s: FeedbackStatusKey): "default" | "secondary" | "outline" | "destructive" {
  if (s === "new") return "default";
  if (s === "triaged" || s === "in_progress") return "secondary";
  if (s === "wont_fix") return "destructive";
  return "outline";
}

function humanStatus(s: FeedbackStatusKey): string {
  switch (s) {
    case "new":
      return "Submitted";
    case "triaged":
      return "Triaged";
    case "in_progress":
      return "In progress";
    case "done":
      return "Resolved";
    case "wont_fix":
      return "Closed (won't fix)";
    default:
      return s;
  }
}

export interface CanvasProps {
  locked: LockedElement | null;
  onActivatePicker: () => void;
  onClearLocked: () => void;
  /** Notifies the parent Sheet shell when focus mode toggles, so it
   * can widen its max-width while the focus pane needs the room. */
  onFocusChange?: (focused: boolean) => void;
}

export function Canvas({
  locked,
  onActivatePicker,
  onClearLocked,
  onFocusChange,
}: CanvasProps): ReactElement {
  const adapter = useFeedbackAdapter();
  const bindings = useFeedbackBindings();
  const config = useFeedbackConfig();
  const t = adapter.useTranslation();
  const query = useMyFeedbackQuery(25);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [iterByFeedback, setIterByFeedback] = useState<Record<string, string>>({});
  const [iterStartingId, setIterStartingId] = useState<string | null>(null);
  const [iterError, setIterError] = useState<string | null>(null);
  // v0.4.1 focus mode — when set, the canvas hides Compose + the
  // card feed and renders <IterFocusView> instead. Click "← Volver"
  // (or session terminal state) clears it back to the feed.
  const [focusedFeedbackId, setFocusedFeedbackId] = useState<string | null>(null);
  // v0.4.3 — split compose vs feed into two tabs. The single-canvas
  // pattern from v0.4.0 turned out to be too noisy on the compose
  // surface (user explicitly: "demasiado ruido visual"). The tabs
  // are NOT a return to v0.3.x's modal-over-Sheet — focus mode
  // (v0.4.1) still takes over the whole panel for iter; the tabs
  // only gate the compose-vs-browse view.
  const [tab, setTab] = useState<"compose" | "mine">("compose");

  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const openIter = useCallback(
    async (feedbackId: string) => {
      setIterStartingId(feedbackId);
      setIterError(null);
      try {
        const session = await startIterSession(bindings, { feedback_id: feedbackId });
        setIterByFeedback((prev) => ({ ...prev, [feedbackId]: session.id }));
        setExpandedId(feedbackId);
        if (config.iterStyle === "focus") {
          setFocusedFeedbackId(feedbackId);
        }
      } catch (err) {
        const e = err as { detail?: string; message?: string };
        setIterError(e.detail ?? e.message ?? String(err));
      } finally {
        setIterStartingId(null);
      }
    },
    [bindings, config.iterStyle],
  );

  const handleSubmitted = useCallback(
    (feedbackId: string, opts: { thenIterate: boolean }) => {
      // Refresh the feed and snap-scroll to the new card.
      void query.refetch();
      setExpandedId(feedbackId);
      // Auto-flip to "Mine" so the user sees their freshly-submitted
      // card without having to click the tab. Same v0.3.x semantic;
      // matches the user's mental model of "I sent it, where is it".
      setTab("mine");
      // Defer scroll until the new row renders.
      setTimeout(() => {
        cardRefs.current[feedbackId]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 250);
      if (opts.thenIterate) {
        void openIter(feedbackId);
      }
    },
    [openIter, query],
  );

  useEffect(() => {
    // Keep the iter map clean when feedbacks disappear (e.g. admin
    // deletion). Avoids dangling session ids hanging around forever.
    const known = new Set((query.data ?? []).map((r) => r.id));
    setIterByFeedback((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (known.has(k)) next[k] = v;
      return next;
    });
  }, [query.data]);

  // Notify the parent Sheet whenever focus state flips so the panel
  // can widen / narrow to match.
  useEffect(() => {
    onFocusChange?.(focusedFeedbackId !== null);
  }, [focusedFeedbackId, onFocusChange]);

  // ── Focus mode short-circuit ──────────────────────────────────
  // When the user is iterating with focus style, replace the entire
  // canvas (compose + feed) with the focus view. Compose stays
  // unmounted so its sticky styles don't fight the focus layout;
  // the iter session continues running in the background even if
  // the user clicks "Volver".
  if (focusedFeedbackId && iterByFeedback[focusedFeedbackId]) {
    return (
      <div className="h-full">
        <IterFocusView
          sessionId={iterByFeedback[focusedFeedbackId] ?? ""}
          feedbackId={focusedFeedbackId}
          onExit={() => setFocusedFeedbackId(null)}
        />
      </div>
    );
  }

  const minePendingCount = (query.data ?? []).filter((r) => r.status === "done").length;
  const mineTotalCount = (query.data ?? []).length;

  return (
    <div className="space-y-3">
      {/* v0.4.3 — tab switcher to keep compose noise-free. The
          previous tickets live behind their own tab so the user
          isn't staring at a feed of old tickets while drafting a
          new one. The iter focus mode (v0.4.1) still takes over
          the whole panel above this. */}
      <div
        className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted text-xs font-medium"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "compose"}
          onClick={() => setTab("compose")}
          className={`px-3 py-1.5 rounded transition-colors ${
            tab === "compose"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-feedback-id="feedback.tab.compose"
        >
          ✎ Nuevo feedback
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mine"}
          onClick={() => setTab("mine")}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
            tab === "mine"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-feedback-id="feedback.tab.mine"
        >
          <span>📋 Mis feedbacks</span>
          {mineTotalCount > 0 ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                minePendingCount > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted-foreground/15 text-muted-foreground"
              }`}
              title={
                minePendingCount > 0
                  ? `${minePendingCount} con respuesta del equipo`
                  : `${mineTotalCount} en total`
              }
            >
              {minePendingCount > 0 ? minePendingCount : mineTotalCount}
            </span>
          ) : null}
        </button>
      </div>

      {tab === "compose" ? (
        <Compose
          locked={locked}
          onActivatePicker={onActivatePicker}
          onClearLocked={onClearLocked}
          onSubmitted={handleSubmitted}
        />
      ) : query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("feedback.mine.loading")}</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">{t("feedback.mine.error")}</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("feedback.mine.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {(query.data ?? []).map((r: FeedbackRead) => {
            const recentlyResolved = r.status === "done";
            const isOpen = expandedId === r.id;
            const iterSessionId = iterByFeedback[r.id] ?? null;
            return (
              <li
                key={r.id}
                ref={(el) => {
                  cardRefs.current[r.id] = el;
                }}
              >
                <div
                  className={`rounded-md border ${
                    recentlyResolved ? "border-primary bg-primary/5" : "border-input"
                  }`}
                >
                  <div className="w-full p-2 text-sm flex flex-col gap-1 hover:bg-accent rounded-md">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : r.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                        aria-expanded={isOpen}
                        aria-controls={`ticket-detail-${r.id}`}
                        data-feedback-id="feedback.canvas.row"
                      >
                        <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted shrink-0">
                          {r.ticket_code || "—"}
                        </code>
                        <Badge variant={statusVariant(r.status)} className="shrink-0">
                          {humanStatus(r.status)}
                        </Badge>
                        <span className="truncate flex-1 font-medium">{r.title}</span>
                        {isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                      {!iterSessionId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openIter(r.id);
                          }}
                          disabled={iterStartingId === r.id}
                          className="shrink-0"
                          data-feedback-id="feedback.canvas.iterate"
                          title="Iterate with AI"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {iterStartingId === r.id ? "Opening…" : "Iterate"}
                        </Button>
                      )}
                    </div>
                    {recentlyResolved && !isOpen ? (
                      <span className="text-[11px] text-primary">
                        {t("feedback.mine.action_hint")}
                      </span>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <div
                      id={`ticket-detail-${r.id}`}
                      className="border-t border-input px-3 py-3 space-y-3 text-xs"
                    >
                      {r.created_at ? (
                        <p className="text-muted-foreground">
                          {t("feedback.mine.submitted_at", {
                            date: r.created_at.slice(0, 16).replace("T", " "),
                          })}
                        </p>
                      ) : null}

                      <section>
                        <h4 className="font-semibold text-foreground mb-1">
                          {t("feedback.field.description")}
                        </h4>
                        <p className="whitespace-pre-wrap">
                          {r.description || (
                            <span className="italic text-muted-foreground">
                              {t("feedback.mine.no_description")}
                            </span>
                          )}
                        </p>
                      </section>

                      {r.expected_outcome ? (
                        <section>
                          <h4 className="font-semibold text-foreground mb-1">
                            {t("feedback.field.expected_outcome")}
                          </h4>
                          <p className="whitespace-pre-wrap">{r.expected_outcome}</p>
                        </section>
                      ) : null}

                      {r.triage_note ? (
                        <section className="rounded bg-muted/50 p-2">
                          <h4 className="font-semibold text-foreground mb-1">
                            {t("feedback.mine.triage_note")}
                          </h4>
                          <p className="whitespace-pre-wrap">{r.triage_note}</p>
                        </section>
                      ) : null}

                      {r.attachments && r.attachments.length > 0 ? (
                        <section>
                          <h4 className="font-semibold text-foreground mb-1">
                            {t("feedback.mine.attachments", {
                              count: String(r.attachments.length),
                            })}
                          </h4>
                          <ul className="space-y-1.5">
                            {r.attachments.map((a: FeedbackAttachmentRead) => {
                              const isImage = a.content_type.startsWith("image/");
                              const label = a.filename ?? a.kind;
                              return (
                                <li
                                  key={a.id}
                                  className="flex items-center gap-2 rounded border border-input bg-background p-1.5"
                                >
                                  {isImage && a.presigned_url ? (
                                    <a
                                      href={a.presigned_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0"
                                    >
                                      <img
                                        src={a.presigned_url}
                                        alt={label}
                                        className="h-10 w-10 rounded object-cover"
                                        loading="lazy"
                                      />
                                    </a>
                                  ) : null}
                                  <span className="flex-1 truncate font-mono">{label}</span>
                                  <span className="text-muted-foreground shrink-0">
                                    {(a.byte_size / 1024).toFixed(1)} KB
                                  </span>
                                  {a.presigned_url ? (
                                    <a
                                      href={a.presigned_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 text-primary hover:underline"
                                    >
                                      {t("feedback.mine.open")}
                                    </a>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ) : null}

                      <CommentThread feedbackId={r.id} />

                      {iterSessionId && config.iterStyle === "inline" ? (
                        <InlineIterPane
                          sessionId={iterSessionId}
                          onClose={() => {
                            setIterByFeedback((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            });
                          }}
                        />
                      ) : iterSessionId && config.iterStyle === "focus" ? (
                        <Button
                          size="sm"
                          onClick={() => setFocusedFeedbackId(r.id)}
                          data-feedback-id="feedback.canvas.resume-focus"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Resume iter
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openIter(r.id)}
                          disabled={iterStartingId === r.id}
                          data-feedback-id="feedback.canvas.iterate-inline"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {iterStartingId === r.id ? "Opening…" : "Iterate with AI"}
                        </Button>
                      )}
                      {iterError && iterStartingId === null ? (
                        <p className="text-xs text-destructive">{iterError}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
