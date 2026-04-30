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

export { VERSION } from "./version"
export { useCanTriageFeedback } from "./hooks/useCanTriageFeedback"

export { FeedbackTriagePage } from "./admin/FeedbackTriagePage"
export {
  default as FeedbackButtonDefault,
  FeedbackButton,
} from "./FeedbackButton"

export {
  type FeedbackConfig,
  type FeedbackPosition,
  FeedbackProvider,
  useFeedbackAdapter,
  useFeedbackBindings,
  useFeedbackConfig,
} from "./FeedbackProvider"

export {
  createAdapter,
  type FeedbackAdapter,
  type FeedbackHostBindings,
  SubmitFeedbackError,
} from "./adapter"

export type {
  CurrentUserSnapshot,
  FeedbackReadShape,
  FeedbackStatusKey,
  FeedbackTypeKey,
  ToastApi,
  ToastOptions,
  Translator,
} from "./types"

export {
  type FeedbackAttachmentRead,
  type FeedbackListResponse,
  type FeedbackRead,
  type FeedbackStatus,
  type FeedbackStatusUpdate,
  type FeedbackType,
} from "./client"
