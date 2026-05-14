/**
 * Status pill — submitter-facing rendering of D-003 ticket lifecycle.
 *
 * D-008 hides `type` and `severity` from the submitter, but `status` IS
 * visible because the submitter needs to know whether the team has seen
 * the ticket and where it stands. Colors mirror the admin triage panel
 * so the same status reads the same across surfaces.
 *
 * Spanish copy is fixed — the sandbox runs in `es` and v1 hosts inherit
 * that; if a non-es host appears later we'll route via the translator.
 */

import type { ReactElement } from "react";

import type { FeedbackStatusKey } from "../types";

export interface StatusPillProps {
  status: FeedbackStatusKey;
}

interface PillStyle {
  label: string;
  classes: string;
}

const _STATUS_STYLES: Record<FeedbackStatusKey, PillStyle> = {
  new: {
    label: "Recibido",
    classes: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  triaged: {
    label: "En triaje",
    classes: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
  },
  in_progress: {
    label: "En curso",
    classes: "border-blue-500/30 bg-blue-500/10 text-blue-700",
  },
  done: {
    label: "Resuelto",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  },
  wont_fix: {
    label: "No se hará",
    classes: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function StatusPill({ status }: StatusPillProps): ReactElement {
  const style = _STATUS_STYLES[status] ?? _STATUS_STYLES.new;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${style.classes}`}
      data-feedback-id="feedback.status_pill"
      data-status={status}
    >
      {style.label}
    </span>
  );
}
