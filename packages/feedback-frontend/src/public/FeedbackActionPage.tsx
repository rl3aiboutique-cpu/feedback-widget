/**
 * Public landing page for the magic-link accept/reject buttons.
 *
 * Lives INSIDE the widget folder so the widget owns the whole user flow.
 * The host's route file (routes/feedback.accept.tsx,
 * routes/feedback.reject.tsx) is a 3-line wrapper that renders this
 * component with the right action.
 *
 * The page is reachable WITHOUT authentication — the acceptance_token
 * in the URL IS the proof of identity. We POST it to
 * `/api/v1/feedback/action/{token}?action=accept|reject` and render
 * the server's response.
 */

import { useEffect, useState } from "react"

import { Button } from "../ui/button"
import { useFeedbackAdapter } from "../FeedbackProvider"
import { Rl3Mark } from "../Rl3Mark"

export type FeedbackActionKind = "accept" | "reject"

interface ActionResponseShape {
  status: string
  ticket_code: string
  message: string
  cascade_count?: number
}

interface FeedbackActionPageProps {
  action: FeedbackActionKind
  /** Token query param parsed from the URL by the host route. */
  token: string | null
  /**
   * Optional handler for the "submit a follow-up" CTA shown after a
   * reject. The host wires this to its in-app feedback widget — when
   * the user is also logged in, opening the widget pre-filled with
   * parent_ticket_code is the seamless follow-up flow.
   */
  onSubmitFollowUp?: (parentTicketCode: string) => void
}

type Phase =
  | { kind: "missing_token" }
  | { kind: "loading" }
  | { kind: "success"; result: ActionResponseShape }
  | { kind: "error"; message: string }

export function FeedbackActionPage({
  action,
  token,
  onSubmitFollowUp,
}: FeedbackActionPageProps): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const [phase, setPhase] = useState<Phase>(
    token ? { kind: "loading" } : { kind: "missing_token" },
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false
    void (async () => {
      try {
        const result = (await adapter.consumeActionToken(
          token,
          action,
        )) as unknown as ActionResponseShape
        if (!cancelled) setPhase({ kind: "success", result })
      } catch (err) {
        if (cancelled) return
        // The backend returns 404 for invalid/expired/already-used tokens.
        const msg =
          err instanceof Error ? err.message : "This link is no longer valid."
        setPhase({ kind: "error", message: msg })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [action, token, adapter])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Rl3Mark className="h-6 w-6" />
          <h1 className="text-lg font-semibold">RL3 Feedback</h1>
        </div>

        {phase.kind === "missing_token" ? (
          <div className="space-y-2">
            <h2 className="text-base font-medium">Missing token</h2>
            <p className="text-sm text-muted-foreground">
              This page expects a <code>?token=…</code> query parameter from the
              email button. If you copied the link manually, please use the
              button instead.
            </p>
          </div>
        ) : null}

        {phase.kind === "loading" ? (
          <div className="space-y-2">
            <h2 className="text-base font-medium">
              {action === "accept"
                ? "Recording your acceptance…"
                : "Recording your rejection…"}
            </h2>
            <p className="text-sm text-muted-foreground">One moment.</p>
          </div>
        ) : null}

        {phase.kind === "success" ? (
          <SuccessBlock
            action={action}
            result={phase.result}
            onSubmitFollowUp={onSubmitFollowUp}
          />
        ) : null}

        {phase.kind === "error" ? (
          <div className="space-y-2">
            <h2 className="text-base font-medium">
              This link is no longer valid.
            </h2>
            <p className="text-sm text-muted-foreground">
              The link may have already been used or has expired. If you still
              want to act on this ticket, please open the app and find the
              ticket in your feedback list.
            </p>
            <p className="text-xs text-muted-foreground/70 break-words">
              {phase.message}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SuccessBlock({
  action,
  result,
  onSubmitFollowUp,
}: {
  action: FeedbackActionKind
  result: ActionResponseShape
  onSubmitFollowUp?: (parentTicketCode: string) => void
}): React.ReactElement {
  const isAccept = action === "accept"
  const cascadeNote =
    isAccept && result.cascade_count && result.cascade_count > 0
      ? ` ${result.cascade_count} linked ticket${
          result.cascade_count === 1 ? "" : "s"
        } also auto-accepted.`
      : ""

  return (
    <div className="space-y-3">
      <h2 className="text-base font-medium">
        {isAccept ? "Thanks — closed." : "Got it — marked as not resolved."}
      </h2>
      <p className="text-sm text-muted-foreground">
        Ticket{" "}
        <code className="font-mono px-1 py-0.5 rounded bg-muted">
          {result.ticket_code}
        </code>{" "}
        is {isAccept ? "now closed" : "open for a follow-up"}.{cascadeNote}
      </p>

      {!isAccept ? (
        <div className="space-y-2 rounded-md border p-3 bg-muted/30">
          <p className="text-sm">
            Tell us what's still wrong — we'll open a fresh ticket linked to{" "}
            <strong>{result.ticket_code}</strong> so we can iterate.
          </p>
          {onSubmitFollowUp ? (
            <Button
              type="button"
              onClick={() => onSubmitFollowUp(result.ticket_code)}
            >
              Submit a follow-up
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Open the Compliance Brain app and click the floating feedback
              button — pre-fill the "Linked to" field with{" "}
              <code className="font-mono">{result.ticket_code}</code>.
            </p>
          )}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground pt-2">
        You can close this tab.
      </p>
    </div>
  )
}

export default FeedbackActionPage
