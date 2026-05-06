/**
 * Feedback widget context provider.
 *
 * The host mounts this once at the app root and passes its `bindings`
 * (auth hook, CSRF helper, API base URL). Every widget component reads
 * the resulting adapter via `useFeedbackAdapter()` — no widget file
 * imports from `@/*`.
 */

import { type ReactNode, createContext, useContext, useMemo } from "react";

import {
	type FeedbackAdapter,
	type FeedbackHostBindings,
	createAdapter,
} from "./adapter";

export type FeedbackPosition =
	| "bottom_right"
	| "bottom_left"
	| "top_right"
	| "top_left";

export interface FeedbackConfig {
	/** Master kill-switch — when false the widget renders nothing. */
	enabled?: boolean;
	/** Floating button corner. */
	position?: FeedbackPosition;
	/** Optional brand color override (otherwise inherits the host CSS var). */
	brandPrimaryHex?: string;
	/** UI locale. Currently English-only; kept here for future locales. */
	locale?: "en";
}

const _ENV_ENABLED =
	(import.meta.env.VITE_FEEDBACK_ENABLED ?? "true").toString().toLowerCase() !==
	"false";
const _ENV_POSITION = (import.meta.env.VITE_FEEDBACK_POSITION ??
	"bottom_right") as FeedbackPosition;
const _ENV_BRAND = import.meta.env.VITE_FEEDBACK_BRAND_PRIMARY_HEX || "";
const _ENV_LOCALE = "en" as const;

export const DEFAULT_CONFIG: Required<FeedbackConfig> = Object.freeze({
	enabled: _ENV_ENABLED,
	position: _ENV_POSITION,
	brandPrimaryHex: _ENV_BRAND,
	locale: _ENV_LOCALE,
});

interface FeedbackContextValue {
	bindings: FeedbackHostBindings;
	adapter: FeedbackAdapter;
	config: Required<FeedbackConfig>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export interface FeedbackProviderProps {
	children: ReactNode;
	/** Host-provided wiring — REQUIRED. See `FeedbackHostBindings`. */
	bindings: FeedbackHostBindings;
	/**
	 * Override the default adapter (advanced — most hosts pass `bindings`
	 * and let the provider build the adapter).
	 */
	adapter?: FeedbackAdapter;
	/** Optional non-secret tuning (button position, locale, etc.). */
	config?: FeedbackConfig;
}

export function FeedbackProvider({
	children,
	bindings,
	adapter,
	config,
}: FeedbackProviderProps) {
	if (!bindings || typeof bindings.useCurrentUser !== "function") {
		throw new Error(
			"FeedbackProvider: `bindings` prop is required and must include " +
				"`useCurrentUser`. See @rl3/feedback-widget README for the " +
				"FeedbackHostBindings contract.",
		);
	}

	const value = useMemo<FeedbackContextValue>(
		() => ({
			bindings,
			adapter: adapter ?? createAdapter(bindings),
			config: { ...DEFAULT_CONFIG, ...(config ?? {}) },
		}),
		[bindings, adapter, config],
	);
	return (
		<FeedbackContext.Provider value={value}>
			{children}
		</FeedbackContext.Provider>
	);
}

export function useFeedbackContext(): FeedbackContextValue {
	const ctx = useContext(FeedbackContext);
	if (!ctx) {
		throw new Error(
			"useFeedbackContext must be called inside <FeedbackProvider>. Mount " +
				"the provider at the app root before rendering any widget component.",
		);
	}
	return ctx;
}

export function useFeedbackAdapter(): FeedbackAdapter {
	return useFeedbackContext().adapter;
}

export function useFeedbackConfig(): Required<FeedbackConfig> {
	return useFeedbackContext().config;
}

export function useFeedbackBindings(): FeedbackHostBindings {
	return useFeedbackContext().bindings;
}
