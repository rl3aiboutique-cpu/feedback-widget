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

import { Download } from "lucide-react";
import { useMemo, useState } from "react";

import type {
	FeedbackAttachmentRead,
	FeedbackRead,
	FeedbackStatus,
	FeedbackType,
} from "../client";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import { Textarea } from "../ui/textarea";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { Rl3Mark } from "../Rl3Mark";
import {
	useDeleteFeedbackMutation,
	useFeedbackDetailQuery,
	useFeedbackListQuery,
	useUpdateFeedbackStatusMutation,
} from "../adapter";
import { useCanTriageFeedback } from "../hooks/useCanTriageFeedback";

const TYPE_VALUES: FeedbackType[] = [
	"bug",
	"ui",
	"performance",
	"new_feature",
	"extend_feature",
	"other",
];

const STATUS_VALUES: FeedbackStatus[] = [
	"new",
	"triaged",
	"in_progress",
	"done",
	"wont_fix",
];

function statusVariant(
	s: FeedbackStatus,
): "default" | "secondary" | "outline" | "destructive" {
	if (s === "new") return "default";
	if (s === "triaged" || s === "in_progress") return "secondary";
	if (s === "wont_fix") return "destructive";
	return "outline";
}

export function FeedbackTriagePage(): React.ReactElement {
	const isAdmin = useCanTriageFeedback();
	const adapter = useFeedbackAdapter();

	const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
	const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">(
		"all",
	);
	const [q, setQ] = useState("");
	const [openId, setOpenId] = useState<string | null>(null);

	const list = useFeedbackListQuery({
		type: typeFilter === "all" ? null : typeFilter,
		status: statusFilter === "all" ? null : statusFilter,
		q,
		page: 1,
		pageSize: 50,
	});

	const detail = useFeedbackDetailQuery(openId);

	const patchStatus = useUpdateFeedbackStatusMutation();
	const remove = useDeleteFeedbackMutation();

	const rows = useMemo(() => list.data?.data ?? [], [list.data]);

	if (!isAdmin) {
		return (
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold">Feedback</h1>
				<p className="text-muted-foreground">
					Your role is not authorised to triage feedback. Configure
					<code className="mx-1">VITE_FEEDBACK_TRIAGE_ROLES</code>
					(or the host's <code>bindings.triageRoles</code>) to include your
					role.
				</p>
			</div>
		);
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
					<label
						htmlFor="triage-type-filter"
						className="block text-xs text-muted-foreground mb-1"
					>
						Type
					</label>
					<Select
						value={typeFilter}
						onValueChange={(v) => setTypeFilter(v as FeedbackType | "all")}
					>
						<SelectTrigger id="triage-type-filter">
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
					<label
						htmlFor="triage-status-filter"
						className="block text-xs text-muted-foreground mb-1"
					>
						Status
					</label>
					<Select
						value={statusFilter}
						onValueChange={(v) => setStatusFilter(v as FeedbackStatus | "all")}
					>
						<SelectTrigger id="triage-status-filter">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							{STATUS_VALUES.map((s) => (
								<SelectItem key={s} value={s}>
									{s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex-1 min-w-48">
					<label
						htmlFor="triage-search"
						className="block text-xs text-muted-foreground mb-1"
					>
						Search title
					</label>
					<Input
						id="triage-search"
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
				onOpenChange={(open: boolean) => {
					if (!open) setOpenId(null);
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
									{ id: detail.data?.id ?? "", status, triage_note: note },
									{
										onSuccess: () => adapter.toast.success("Status updated"),
										onError: (err) =>
											adapter.toast.error(`Could not update: ${String(err)}`),
									},
								);
							}}
							onDelete={() => {
								remove.mutate(detail.data?.id ?? "", {
									onSuccess: () => {
										adapter.toast.success("Feedback deleted");
										setOpenId(null);
									},
									onError: (err) =>
										adapter.toast.error(`Could not delete: ${String(err)}`),
								});
							}}
							busy={patchStatus.isPending || remove.isPending}
						/>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}

function DetailBody({
	data,
	onChangeStatus,
	onDelete,
	busy,
}: {
	data: FeedbackRead;
	onChangeStatus: (status: FeedbackStatus, note?: string) => void;
	onDelete: () => void;
	busy: boolean;
}) {
	const adapter = useFeedbackAdapter();
	const [status, setStatus] = useState<FeedbackStatus>(data.status);
	const [note, setNote] = useState<string>(data.triage_note ?? "");
	const screenshot = data.attachments?.find(
		(a: FeedbackAttachmentRead) => a.kind === "screenshot",
	)?.presigned_url;
	const userAttachments =
		data.attachments?.filter(
			(a: FeedbackAttachmentRead) => a.kind === "user_attachment",
		) ?? [];

	return (
		<div className="px-4 mt-4 space-y-5">
			<section>
				<h3 className="text-sm font-medium mb-1">What's happening?</h3>
				<pre className="whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border">
					{data.description}
				</pre>
			</section>

			{data.expected_outcome ? (
				<section>
					<h3 className="text-sm font-medium mb-1">How should it work?</h3>
					<pre className="whitespace-pre-wrap text-sm rounded-md bg-muted/50 p-3 border">
						{data.expected_outcome}
					</pre>
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

			{userAttachments.length > 0 ? (
				<section>
					<h3 className="text-sm font-medium mb-1">
						Attachments ({userAttachments.length})
					</h3>
					<ul className="space-y-1.5">
						{userAttachments.map((a) => (
							<li
								key={a.id}
								className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
							>
								<span className="truncate font-mono">
									{a.filename ?? a.object_key}
								</span>
								<span className="text-muted-foreground shrink-0">
									{(a.byte_size / 1024).toFixed(1)} KB · {a.content_type}
								</span>
								{a.presigned_url ? (
									<a
										href={a.presigned_url}
										target="_blank"
										rel="noreferrer"
										className="shrink-0 text-primary hover:underline"
									>
										Open
									</a>
								) : null}
							</li>
						))}
					</ul>
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
							{STATUS_VALUES.map((s) => (
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
								const { blob, filename } = await adapter.downloadFeedbackBundle(
									data.id,
								);
								const url = URL.createObjectURL(blob);
								const link = document.createElement("a");
								link.href = url;
								link.download = filename;
								document.body.appendChild(link);
								link.click();
								link.remove();
								URL.revokeObjectURL(url);
								adapter.toast.success(`Downloaded ${filename}`);
							} catch (err) {
								adapter.toast.error(`Could not download: ${String(err)}`);
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
									"Delete this feedback? This removes the row + attachments.",
								)
							) {
								onDelete();
							}
						}}
						disabled={busy}
					>
						Delete
					</Button>
				</div>
			</section>
		</div>
	);
}

export default FeedbackTriagePage;
