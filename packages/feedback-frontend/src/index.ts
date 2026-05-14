/**
 * Public surface of @rl3/feedback-widget.
 *
 * Hosts import only from here:
 *
 *   import {
 *     FeedbackProvider,
 *     FeedbackButton,
 *     FeedbackTriagePage,
 *     type FeedbackHostBindings,
 *   } from "@rl3/feedback-widget"
 *   import "@rl3/feedback-widget/styles.css"
 *
 * Internal modules (capture/, forms/, locales/, ui/, client/) are
 * intentionally not re-exported — pinning the surface keeps the
 * package's API stable across versions.
 */

export { VERSION } from "./version";
export { useCanTriageFeedback } from "./hooks/useCanTriageFeedback";

// Telemetry installers — hosts call these once at app boot so the
// widget's metadata bundle includes errors / network / console.
export { installConsoleWrap } from "./capture/consoleWrap";
export { installNetworkWrap } from "./capture/networkWrap";
export { installErrorWrap } from "./capture/errorWrap";

export { FeedbackTriagePage } from "./admin/FeedbackTriagePage";
export {
  default as FeedbackButtonDefault,
  FeedbackButton,
} from "./FeedbackButton";

// v1.0.0 — chat-first surface. Hosts that want to mount the chat
// sheet directly (without the floating launcher) can import this.
export { FeedbackChatSheet } from "./chat/FeedbackChatSheet";
export type { FeedbackChatSheetProps } from "./chat/FeedbackChatSheet";
export { SynthesisCard } from "./chat/SynthesisCard";
export type { SynthesisCardProps } from "./chat/SynthesisCard";
export type { Synthesis } from "./chat/types";

// S3F shell-hybrid building blocks — exported so hosts can compose
// their own surface (admin views, embedded mounts) without re-binding
// the chrome by hand.
export {
  CapturePicker,
  type CapturePickerProps,
  type CaptureMode,
  type LockedElementInfo,
} from "./chat/CapturePicker";
export {
  FeedbackTabs,
  type FeedbackTabsProps,
  type FeedbackTab,
} from "./chat/FeedbackTabs";
export { FooterActions, type FooterActionsProps } from "./chat/FooterActions";
export { MineFeedTab, type MineFeedTabProps } from "./chat/MineFeedTab";
export { StatusPill, type StatusPillProps } from "./chat/StatusPill";
export { TicketDetail, type TicketDetailProps } from "./chat/TicketDetail";

export {
  type FeedbackConfig,
  type FeedbackPosition,
  FeedbackProvider,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig,
} from "./FeedbackProvider";

export {
  createAdapter,
  type FeedbackAdapter,
  type FeedbackHostBindings,
  SubmitFeedbackError,
} from "./adapter";

export type {
  CurrentUserSnapshot,
  FeedbackReadShape,
  FeedbackStatusKey,
  FeedbackTypeKey,
  ToastApi,
  ToastOptions,
  Translator,
} from "./types";

export type {
  FeedbackAttachmentRead,
  FeedbackListResponse,
  FeedbackRead,
  FeedbackStatus,
  FeedbackStatusUpdate,
  FeedbackType,
  IterAssumptionRead,
  IterAssumptionStatus,
  IterPackageRead,
  IterSessionRead,
  IterSessionStatus,
  IterVersionRead,
} from "./client/types";

// v1.0.0 — the submitter-facing `<IterWorkspace>` was removed in S7.
// Admin "Refinar" now reuses the chat sheet; the iter client + types
// stay exported (admin Triage page consumes them) but no React
// surface is public.
export {
  abandonIterSession,
  editIterVersionMarkdown,
  finalizeIterSession,
  getIterPackage,
  getIterSession,
  IterApiError,
  listIterAssumptions,
  listIterSessionsForFeedback,
  listIterVersions,
  newIdempotencyKey,
  resolveIterAssumption,
  startIterSession,
} from "./client/iter";
