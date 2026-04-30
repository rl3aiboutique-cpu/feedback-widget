/**
 * Multi-file attachment dropzone for the feedback form.
 *
 * Lets the submitter drop or pick up to MAX_ATTACHMENTS files —
 * wireframes, drawings, external logs, notes — that travel with the
 * ticket. Validates count, size, and MIME type client-side; the
 * backend re-validates with magic-byte sniffing.
 */

import { FileText, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useFeedbackAdapter } from "../FeedbackProvider";
import { Label } from "../ui/label";

const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIMES = new Set<string>([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"application/pdf",
	"text/plain",
	"text/markdown",
	"application/json",
	"application/x-ndjson",
]);

const ALLOWED_EXTENSIONS = new Set<string>([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".pdf",
	".txt",
	".log",
	".md",
	".json",
	".ndjson",
]);

const ACCEPT_ATTR = [
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".pdf",
	".txt",
	".log",
	".md",
	".json",
	".ndjson",
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"application/pdf",
	"text/plain",
	"text/markdown",
	"application/json",
	"application/x-ndjson",
].join(",");

function _formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function _isImage(file: File): boolean {
	return file.type.startsWith("image/");
}

function _hasAllowedExtension(filename: string): boolean {
	const lower = filename.toLowerCase();
	for (const ext of ALLOWED_EXTENSIONS) {
		if (lower.endsWith(ext)) return true;
	}
	return false;
}

function _isMimeAllowed(file: File): boolean {
	if (file.type && ALLOWED_MIMES.has(file.type)) return true;
	// Browsers sometimes report empty / octet-stream for plain text,
	// .log, or .md; fall back to extension allowlist.
	if (
		(file.type === "" || file.type === "application/octet-stream") &&
		_hasAllowedExtension(file.name)
	) {
		return true;
	}
	return false;
}

export interface AttachmentsFieldProps {
	value: File[];
	onChange: (next: File[]) => void;
	error?: string;
}

export function AttachmentsField({
	value,
	onChange,
	error,
}: AttachmentsFieldProps): React.ReactElement {
	const adapter = useFeedbackAdapter();
	const t = adapter.useTranslation();
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragActive, setDragActive] = useState(false);

	// Track preview URLs so we can revoke them on cleanup / list change.
	const previews = useMemo(() => {
		const map = new Map<File, string>();
		for (const f of value) {
			if (_isImage(f)) {
				map.set(f, URL.createObjectURL(f));
			}
		}
		return map;
	}, [value]);

	useEffect(() => {
		return () => {
			for (const url of previews.values()) {
				URL.revokeObjectURL(url);
			}
		};
	}, [previews]);

	const acceptIncoming = (files: FileList | File[]): void => {
		const incoming = Array.from(files);
		const accepted: File[] = [];
		const room = MAX_ATTACHMENTS - value.length;
		if (room <= 0) {
			adapter.toast.error(
				t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) }),
			);
			return;
		}
		let truncated = false;
		for (const file of incoming) {
			if (accepted.length >= room) {
				truncated = true;
				break;
			}
			if (file.size > MAX_BYTES) {
				adapter.toast.error(
					t("feedback.attachments.too_big", {
						name: file.name,
						max: "10 MB",
					}),
				);
				continue;
			}
			if (!_isMimeAllowed(file)) {
				adapter.toast.error(
					t("feedback.attachments.bad_type", { name: file.name }),
				);
				continue;
			}
			accepted.push(file);
		}
		if (truncated) {
			adapter.toast.error(
				t("feedback.attachments.too_many", { max: String(MAX_ATTACHMENTS) }),
			);
		}
		if (accepted.length > 0) {
			onChange([...value, ...accepted]);
		}
	};

	const onPick = (e: React.ChangeEvent<HTMLInputElement>): void => {
		if (e.target.files && e.target.files.length > 0) {
			acceptIncoming(e.target.files);
			// Reset so the same file can be re-added after removal.
			e.target.value = "";
		}
	};

	const onDrop = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			acceptIncoming(e.dataTransfer.files);
		}
	};

	const onDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(true);
	};

	const onDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);
	};

	const removeAt = (index: number): void => {
		const next = value.slice();
		next.splice(index, 1);
		onChange(next);
	};

	return (
		<div className="space-y-2">
			<Label
				htmlFor="feedback-attachments"
				title={t("feedback.attachments.hint")}
			>
				{t("feedback.attachments.label")}
				<span
					className="ml-1 cursor-help text-[11px] text-muted-foreground"
					aria-label={t("feedback.attachments.hint")}
				>
					ⓘ
				</span>
			</Label>

			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				aria-label={t("feedback.attachments.dropzone")}
				className={`w-full cursor-pointer rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors
          ${
						dragActive
							? "border-primary bg-primary/5 text-foreground"
							: error
								? "border-destructive bg-destructive/5 text-destructive"
								: "border-input bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
					}`}
				data-feedback-id="feedback.attachments.dropzone"
			>
				<p>{t("feedback.attachments.dropzone")}</p>
				<p className="mt-1 text-[11px] text-muted-foreground">
					{t("feedback.attachments.hint")}
				</p>
				<input
					ref={inputRef}
					id="feedback-attachments"
					type="file"
					multiple
					accept={ACCEPT_ATTR}
					onChange={onPick}
					className="hidden"
				/>
			</button>

			{error ? <p className="text-xs text-destructive">{error}</p> : null}

			{value.length > 0 ? (
				<ul className="space-y-1.5">
					{value.map((file, index) => {
						const previewUrl = previews.get(file);
						return (
							<li
								key={`${file.name}-${index}`}
								className="flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
							>
								{previewUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={previewUrl}
										alt={file.name}
										className="h-8 w-8 shrink-0 rounded object-cover"
									/>
								) : _isImage(file) ? (
									<ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
								) : (
									<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
								)}
								<span className="flex-1 truncate">{file.name}</span>
								<span className="text-[11px] text-muted-foreground">
									{_formatBytes(file.size)}
								</span>
								<button
									type="button"
									onClick={() => removeAt(index)}
									className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
									aria-label={t("feedback.attachments.remove", {
										name: file.name,
									})}
									data-feedback-id="feedback.attachments.remove"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							</li>
						);
					})}
				</ul>
			) : null}
		</div>
	);
}
