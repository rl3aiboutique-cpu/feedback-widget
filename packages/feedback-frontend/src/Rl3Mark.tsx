/**
 * Inline RL3 maker mark — the widget's own identity.
 *
 * Distinct from the host application's brand (set via FEEDBACK_BRAND_NAME):
 *
 *   - The HOST brand (Capellai / Compliance Brain / etc.) shows up in
 *     email subjects, deep links, and anywhere FEEDBACK_BRAND_NAME is
 *     interpolated. It identifies the application the user is sending
 *     feedback ABOUT.
 *
 *   - The MAKER brand (RL3) shows up on the floating launcher and in
 *     the panel header. It identifies the TOOL being used to send the
 *     feedback. Same idea as the "Powered by Stripe" mark on a checkout.
 *
 * The mark is inlined here so the widget folder stays self-contained:
 * extracting the widget into another web app preserves the RL3
 * identity unless the new host explicitly forks this file. The visual
 * mirrors the project's existing src/components/Common/RL3Badge.tsx so
 * the inline copy stays in sync.
 */

export interface Rl3MarkProps {
	className?: string;
	/** Override the gradient ID so multiple marks on one page don't collide. */
	gradientId?: string;
}

export function Rl3Mark({
	className,
	gradientId = "rl3-feedback-grad",
}: Rl3MarkProps): React.ReactElement {
	return (
		<svg
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32"
			fill="none"
			role="img"
			aria-label="RL3"
		>
			<defs>
				<linearGradient
					id={gradientId}
					x1="0"
					y1="0"
					x2="32"
					y2="32"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0%" stopColor="#14b8a6" />
					<stop offset="100%" stopColor="#0ea5e9" />
				</linearGradient>
			</defs>
			<rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
			<text
				x="16"
				y="22"
				textAnchor="middle"
				fontFamily="system-ui, -apple-system, sans-serif"
				fontSize="15"
				fontWeight="800"
				fill="#ffffff"
				letterSpacing="-0.5"
			>
				RL3
			</text>
		</svg>
	);
}
