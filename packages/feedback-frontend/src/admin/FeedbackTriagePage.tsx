/**
 * Admin triage page — lives INSIDE the widget folder so the host's
 * route file is a thin wrapper. When the widget is extracted to
 * another web app, this page comes along.
 *
 * Permissions: this component currently checks ``user.role ===
 * "MASTER_ADMIN"`` via the adapter. If a host wants a different gate,
 * they wrap or replace the adapter's ``useCurrentUser``.
 *
 * Data fetching goes through the adapter hooks so the SDK is not
 * imported directly here.
 */

import { Download } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import type { FeedbackRead, FeedbackStatus, FeedbackType } from "../client"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import { Textarea } from "../ui/textarea"

import {
  downloadFeedbackBundle,
  useDeleteFeedbackMutation,
  useFeedbackDetailQuery,
  useFeedbackListQuery,
  useUpdateFeedbackStatusMutation,
} from "../adapter"
import { useFeedbackAdapter } from "../FeedbackProvider"
import { Rl3Mark } from "../Rl3Mark"

const TYPE_VALUES: FeedbackType[] = [
  "bug",
  "new_feature",
  "extend_feature",
  "new_user_story",
  "question",
  "ux_polish",
  "performance",
  "data_issue",
]

// Statuses an admin can SET via the dropdown. accepted_by_user and
// rejected_by_user are set by the submitter via the magic link, never
// directly by an admin.
const ADMIN_STATUS_VALUES: FeedbackStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "done",
  "wont_fix",
]

// All statuses, used for the filter dropdown so admins can see closed-by-user
// rows when they want to.
const ALL_STATUS_VALUES: FeedbackStatus[] = [
  ...ADMIN_STATUS_VALUES,
  "accepted_by_user",
  "rejected_by_user",
]

function statusVariant(
  s: FeedbackStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (s === "new") return "default"
  if (s === "triaged" || s === "in_progress") return "secondary"
  if (s === "wont_fix" || s === "rejected_by_user") return "destructive"
  return "outline"
}

export function FeedbackTriagePage(): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const user = adapter.useCurrentUser()
  const isAdmin = user?.role === "MASTER_ADMIN"

  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
    "all",
  )
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const list = useFeedbackListQuery({
    type: typeFilter === "all" ? null : typeFilter,
    status: statusFilter === "all" ? null : statusFilter,
    q,
    page: 1,
    pageSize: 50,
  })

  const detail = useFeedbackDetailQuery(openId)

  const patchStatus = useUpdateFeedbackStatusMutation()
  const remove = useDeleteFeedbackMutation()

  const rows = useMemo(() => list.data?.data ?? [], [list.data])

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="text-muted-foreground">
          Only MASTER_ADMIN can see the triage queue.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <Rl3Mark className="h-7 w-7 shrink-0" />
            <span>RL3 Feedback — triage</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {list.data?.count ?? 0} total · Filter by type, status, or title.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-muted-foreground mb-1">
            Type
          </label>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as FeedbackType | "all")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {TYPE_VALUES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-muted-foreground mb-1">
            Status
          </label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as FeedbackStatus | "all")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {ALL_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-muted-foreground mb-1">
            Search title
          </label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="…"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Ticket</TableHead>
              <TableHead className="w-32">Date</TableHead>
              <TableHead className="w-32">Type</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-48">Route</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-6"
                >
                  No matching feedback.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row: FeedbackRead) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => setOpenId(row.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {row.ticket_code || "—"}
                    {row.parent_ticket_code ? (
                      <div className="text-[10px] text-muted-foreground">
                        ↳ {row.parent_ticket_code}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.created_at?.slice(0, 16) ?? ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-48">
                    {row.route_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail drawer */}
      <Sheet
        open={!!openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detail.data?.ticket_code ? (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">
                  {detail.data.ticket_code}
                </span>
              ) : null}
              <span className="truncate">{detail.data?.title ?? ""}</span>
            </SheetTitle>
            <SheetDescription>
              {detail.data ? (
                <span className="text-xs space-y-0.5 block">
                  <span>
                    {detail.data.type} · {detail.data.created_at?.slice(0, 16)}{" "}
                    · {detail.data.url_captured}
                  </span>
                  {detail.data.parent_ticket_code ? (
                    <span className="block text-primary">
                      ↳ Linked to {detail.data.parent_ticket_code}
                    </span>
                  ) : null}
                  {detail.data.follow_up_email ? (
                    <span className="block">
                      Follow-up: {detail.data.follow_up_email}
                    </span>
                  ) : null}
                </span>
              ) : (
                "Loading…"
              )}
            </SheetDescription>
          </SheetHeader>

          {detail.data ? (
            <DetailBody
              data={detail.data}
              onChangeStatus={(status, note) => {
                patchStatus.mutate(
                  { id: detail.data!.id, status, triage_note: note },
                  {
                    onSuccess: () => toast.success("Status updated"),
                    onError: (err) =>
                      toast.error(`Could not update: ${String(err)}`),
                  },
                )
              }}
              onDelete={() => {
                remove.mutate(detail.data!.id, {
                  onSuccess: () => {
                    toast.success("Feedback deleted")
                    setOpenId(null)
                  },
                  onError: (err) =>
                    toast.error(`Could not delete: ${String(err)}`),
                })
              }}
              busy={patchStatus.isPending || remove.isPending}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DetailBody({
  data,
  onChangeStatus,
  onDelete,
  busy,
}: {
  data: FeedbackRead
  onChangeStatus: (status: FeedbackStatus, note?: string) => void
  onDelete: () => void
  busy: boolean
}) {
  const [status, setStatus] = useState<FeedbackStatus>(data.status)
  const [note, setNote] = useState<string>(data.triage_note ?? "")
  const screenshot = data.attachments?.[0]?.presigned_url ?? null

  return (
    <div className="px-4 mt-4 space-y-5">
      <section>
        <h3 className="text-sm font-medium mb-1">Description</h3>
        <pre className="whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border">
          {data.description}
        </pre>
      </section>

      {Object.keys(data.type_fields ?? {}).length > 0 ? (
        <section>
          <h3 className="text-sm font-medium mb-1">Type-specific fields</h3>
          <dl className="rounded-md border divide-y">
            {Object.entries(data.type_fields).map(([k, v]) => (
              <div key={k} className="flex p-2 text-sm">
                <dt className="w-44 text-muted-foreground">{k}</dt>
                <dd className="flex-1 whitespace-pre-wrap">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {data.persona ? (
        <section>
          <h3 className="text-sm font-medium mb-1">Persona</h3>
          <pre className="whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border">
            {data.persona}
          </pre>
        </section>
      ) : null}

      {(data.linked_user_stories?.length ?? 0) > 0 ? (
        <section>
          <h3 className="text-sm font-medium mb-1">Linked user stories</h3>
          <ul className="space-y-2">
            {data.linked_user_stories.map((s, i) => {
              const story = s as Record<string, unknown>
              return (
                <li key={i} className="rounded-md border p-2 text-sm">
                  <div className="font-medium">{String(story.story ?? "")}</div>
                  {story.priority ? (
                    <Badge variant="outline" className="mt-1">
                      {String(story.priority)}
                    </Badge>
                  ) : null}
                  {story.acceptance_criteria ? (
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground mt-1">
                      {String(story.acceptance_criteria)}
                    </pre>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {screenshot ? (
        <section>
          <h3 className="text-sm font-medium mb-1">Screenshot</h3>
          <a href={screenshot} target="_blank" rel="noreferrer">
            <img
              src={screenshot}
              alt="Screenshot"
              className="w-full rounded-md border"
              loading="lazy"
            />
          </a>
        </section>
      ) : null}

      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-foreground">
          Technical metadata (redacted)
        </summary>
        <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 border mt-2 max-h-96 overflow-auto">
          {JSON.stringify(data.metadata_bundle, null, 2)}
        </pre>
      </details>

      <section className="rounded-md border p-3 space-y-3">
        <h3 className="text-sm font-medium">Triage</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-28">Status</span>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as FeedbackStatus)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_STATUS_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className="block text-xs text-muted-foreground mb-1">
            Triage note
          </span>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this status, what was done…"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            onClick={() => onChangeStatus(status, note || undefined)}
            disabled={busy}
          >
            Save status
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-feedback-id="feedback.triage.download"
            onClick={async () => {
              try {
                const { blob, filename } = await downloadFeedbackBundle(data.id)
                const url = URL.createObjectURL(blob)
                const link = document.createElement("a")
                link.href = url
                link.download = filename
                document.body.appendChild(link)
                link.click()
                link.remove()
                URL.revokeObjectURL(url)
                toast.success(`Downloaded ${filename}`)
              } catch (err) {
                toast.error(`Could not download: ${String(err)}`)
              }
            }}
            disabled={busy}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Download .zip
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (
                window.confirm(
                  "Delete this feedback? This removes the row + attachment.",
                )
              ) {
                onDelete()
              }
            }}
            disabled={busy}
          >
            Delete
          </Button>
        </div>
      </section>
    </div>
  )
}

export default FeedbackTriagePage
