/**
 * Public surface of @rl3/feedback-widget.
 *
 * Hosts import only from here:
 *
 *   import {
 *     FeedbackProvider,
 *     FeedbackButton,
 *     FeedbackTriagePage,
 *     FeedbackActionPage,
 *     type FeedbackHostBindings,
 *   } from "@rl3/feedback-widget"
 *   import "@rl3/feedback-widget/styles.css"
 *
 * Internal modules (capture/, forms/, locales/, ui/, client/) are
 * intentionally not re-exported — pinning the surface keeps the
 * package's API stable across versions.
 */

export { VERSION } from "./version"

export { FeedbackTriagePage } from "./admin/FeedbackTriagePage"
export {
  default as FeedbackButtonDefault,
  FeedbackButton,
} from "./FeedbackButton"
export { FeedbackActionPage } from "./public/FeedbackActionPage"

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
  type PublicActionResult,
  SubmitFeedbackError,
} from "./adapter"

export type {
  CurrentUserSnapshot,
  FeedbackReadShape,
  FeedbackStatusKey,
  FeedbackTypeKey,
  Translator,
} from "./types"

export {
  type FeedbackAttachmentRead,
  type FeedbackListResponse,
  type FeedbackRead,
  type FeedbackStatus,
  type FeedbackStatusUpdate,
  type FeedbackType,
  type LinkedUserStory,
} from "./client"
