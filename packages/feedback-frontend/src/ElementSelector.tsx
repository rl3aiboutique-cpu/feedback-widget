/**
 * Hover-highlight + click-lock element selector.
 *
 * Activated when the user picks "select element" mode in the feedback
 * panel. Paints a 2px outline + label over whatever the mouse is on,
 * locks on click, cancels on ESC. Excludes the widget itself from
 * being a selection target.
 *
 * Implementation notes:
 *   * No transparent capture overlay — keeping native cursor + scroll
 *     intact. Mouse moves are tracked via a global mousemove listener
 *     plus document.elementFromPoint at the cursor.
 *   * The highlight box is a fixed-position <div>; we never mutate the
 *     hovered element or its surroundings.
 *   * The whole component renders inside a [data-feedback-widget-root]
 *     wrapper so the future screenshot capture filters it out.
 */

import { useEffect, useRef, useState } from "react";

import { useFeedbackAdapter } from "./FeedbackProvider";

const MIN_HIGHLIGHT_SIZE = 8;

export interface ElementSelectorProps {
	/** Fired when the user clicks on a target — the panel locks the selection. */
	onLock: (el: HTMLElement) => void;
	/** Fired on ESC or clicking outside any element. */
	onCancel: () => void;
}

interface HighlightRect {
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
}

function _isInsideWidget(el: Element): boolean {
	return Boolean(el.closest('[data-feedback-widget-root="true"]'));
}

function _accessibleName(el: Element): string {
	const aria = el.getAttribute("aria-label");
	if (aria) return aria;
	const title = el.getAttribute("title");
	if (title) return title;
	if (el instanceof HTMLElement && el.innerText) {
		return el.innerText.trim().slice(0, 60);
	}
	return el.tagName.toLowerCase();
}

export function ElementSelector({
	onLock,
	onCancel,
}: ElementSelectorProps): React.ReactElement {
	const [rect, setRect] = useState<HighlightRect | null>(null);
	const adapter = useFeedbackAdapter();
	const t = adapter.useTranslation();
	// Latest element under the mouse — used by mousedown so we don't have
	// to re-resolve in the click handler.
	const currentRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (typeof document === "undefined") return undefined;

		const onMove = (e: MouseEvent) => {
			const el = document.elementFromPoint(e.clientX, e.clientY);
			if (!el || !(el instanceof HTMLElement) || _isInsideWidget(el)) {
				currentRef.current = null;
				setRect(null);
				return;
			}
			const r = el.getBoundingClientRect();
			if (r.width < MIN_HIGHLIGHT_SIZE || r.height < MIN_HIGHLIGHT_SIZE) {
				currentRef.current = null;
				setRect(null);
				return;
			}
			currentRef.current = el;
			setRect({
				x: r.x,
				y: r.y,
				w: r.width,
				h: r.height,
				label: `${el.tagName.toLowerCase()} · ${_accessibleName(el)}`,
			});
		};

		const onClick = (e: MouseEvent) => {
			const target = currentRef.current;
			// Suppress the click on the underlying target so it doesn't also
			// trigger the page's own click handler.
			if (target) {
				e.preventDefault();
				e.stopPropagation();
				onLock(target);
			} else {
				onCancel();
			}
		};

		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			}
		};

		window.addEventListener("mousemove", onMove);
		// capture-phase click so we can preventDefault before page handlers fire
		window.addEventListener("click", onClick, true);
		window.addEventListener("keydown", onKey, true);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("click", onClick, true);
			window.removeEventListener("keydown", onKey, true);
		};
	}, [onLock, onCancel]);

	return (
		<div
			data-feedback-widget-root="true"
			role="dialog"
			aria-label={t("feedback.element_selector_active")}
			aria-live="polite"
			// The whole layer is fixed + pointer-events:none so the cursor
			// continues to interact with the page underneath. Click-lock is
			// handled by the document-level capture listener above.
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2147483645,
				pointerEvents: "none",
			}}
		>
			{/* Floating banner: tells the user how to escape. */}
			<div
				style={{
					position: "fixed",
					left: "50%",
					top: 16,
					transform: "translateX(-50%)",
					background: "#1E40AF",
					color: "#ffffff",
					padding: "6px 14px",
					borderRadius: 999,
					fontSize: 12,
					fontWeight: 600,
					boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
				}}
			>
				{t("feedback.element_selector_hint")}
			</div>

			{rect ? (
				<>
					<div
						style={{
							position: "fixed",
							left: rect.x,
							top: rect.y,
							width: rect.w,
							height: rect.h,
							border: "2px solid #1E40AF",
							borderRadius: 4,
							boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.35)",
							transition: "all 80ms ease-out",
						}}
					/>
					<div
						style={{
							position: "fixed",
							left: rect.x,
							top: Math.max(0, rect.y - 26),
							background: "#1E40AF",
							color: "#ffffff",
							padding: "2px 8px",
							borderRadius: 4,
							fontSize: 11,
							fontFamily:
								"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
							maxWidth: 360,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{rect.label}
					</div>
				</>
			) : null}
		</div>
	);
}

export default ElementSelector;
