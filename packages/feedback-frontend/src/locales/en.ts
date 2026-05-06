/**
 * English fallback. The default translator looks up the active locale
 * first; missing keys fall through here.
 */
export const en: Record<string, string> = {
  "feedback.open_button": "Send feedback with RL3 Feedback",
  "feedback.open_button_with_pending": "RL3 Feedback — {count} ticket(s) updated recently",
  "feedback.tab.submit": "Submit feedback",
  "feedback.tab.mine": "My tickets",
  "feedback.mine.loading": "Loading your tickets…",
  "feedback.mine.empty": "You haven't submitted any feedback yet.",
  "feedback.mine.error": "Could not load your tickets. Please retry later.",
  "feedback.mine.action_hint":
    "We marked this resolved. Reply by email or file fresh feedback if it's still not right.",
  "feedback.mine.submitted_at": "Submitted {date} UTC",
  "feedback.mine.no_description": "(no description)",
  "feedback.mine.triage_note": "Note from the team",
  "feedback.mine.attachments": "Attachments ({count})",
  "feedback.mine.open": "Open",
  "feedback.mine.open_in_app": "Open in app →",
  "feedback.comments.thread_title": "Conversation",
  "feedback.comments.loading": "Loading messages…",
  "feedback.comments.error": "Could not load messages.",
  "feedback.comments.empty": "No messages yet — be the first to reply.",
  "feedback.comments.placeholder": "Write a reply…",
  "feedback.comments.send": "Send",
  "feedback.comments.sending": "Sending…",
  "feedback.comments.send_error": "Could not send the message. Please retry.",
  "feedback.comments.send_unauthorized":
    "You don't have permission to post on this ticket. Try refreshing the page.",
  "feedback.comments.admin_label": "Team",
  "feedback.comments.submitter_label": "Submitter",
  "feedback.comments.you_label": "You",
  "feedback.button_label": "Feedback",
  "feedback.panel_title": "RL3 Feedback",
  "feedback.panel_description":
    "Tell us what's happening, what you'd expect instead, and attach anything that helps. We capture page URL and basic context to help triage.",
  "feedback.powered_by": "powered by",
  "feedback.powered_by_aria": "Powered by RL3 AI Agency",

  "feedback.optional": "optional",

  "feedback.mode_label": "Capture",
  "feedback.mode_whole_page": "Whole page",
  "feedback.mode_select_element": "Select element",
  "feedback.mode_select_element_hint":
    "We'll take you to the page: hover over any element and click to lock it.",
  "feedback.element_locked": "Element locked",
  "feedback.clear_element": "Clear element",
  "feedback.element_selector_active": "Element-selector mode active. Click to lock, ESC to cancel.",
  "feedback.element_selector_hint": "Move the mouse to highlight · Click to lock · ESC to cancel",

  "feedback.type_label": "Type",
  "feedback.type_placeholder": "Pick a category…",
  "feedback.type.bug": "Bug",
  "feedback.type.bug_hint":
    "Something is broken or behaves wrong. Use this when reality doesn't match expectation.",
  "feedback.type.ui": "UI",
  "feedback.type.ui_hint":
    "Something on screen feels off — copy, layout, contrast, hierarchy, motion.",
  "feedback.type.performance": "Performance",
  "feedback.type.performance_hint": "Something is technically working but unacceptably slow.",
  "feedback.type.new_feature": "New feature",
  "feedback.type.new_feature_hint": "A capability that doesn't exist yet.",
  "feedback.type.extend_feature": "Extend feature",
  "feedback.type.extend_feature_hint": "Something exists but doesn't go far enough.",
  "feedback.type.other": "Other",
  "feedback.type.other_hint": "Anything that doesn't fit the categories above.",

  "feedback.field.title": "Title",
  "feedback.field.title_hint": "Short, specific summary. Will be the email subject.",
  "feedback.field.title_placeholder": "Short summary…",
  "feedback.field.description": "What's happening?",
  "feedback.field.description_placeholder":
    "Describe what you're seeing or what's missing. Be concrete.",
  "feedback.field.expected_outcome": "How should it work?",
  "feedback.field.expected_outcome_placeholder": "What you'd expect instead.",

  "feedback.attachments.label": "Attachments",
  "feedback.attachments.hint":
    "Wireframes, drawings, external logs, notes — up to 5 files of 10 MB each.",
  "feedback.attachments.dropzone": "Drop files here or click to choose",
  "feedback.attachments.too_many": "Up to {max} files per submission.",
  "feedback.attachments.too_big": "{name} is too large (max {max}).",
  "feedback.attachments.bad_type":
    "{name} has an unsupported file type. We accept images (PNG/JPG/GIF/WebP), PDFs, plain text, markdown, and JSON.",
  "feedback.attachments.remove": "Remove {name}",

  "feedback.metadata_disclosure":
    "We capture page URL and basic context (viewport, recent logs) to help triage. Tokens and cookies are redacted automatically.",

  "feedback.cancel": "Cancel",
  "feedback.submit": "Send feedback",
  "feedback.submitting": "Sending…",
  "feedback.submit_disabled_until_form": "Pick a type first",

  "feedback.toast_success": "Feedback sent · {id}",
  "feedback.toast_success_link": "Open in admin",
  "feedback.toast_error_generic": "Could not send the feedback. Try again.",
  "feedback.toast_error_429": "Too much feedback. Retry in {seconds}s.",
  "feedback.toast_error_required_field": "Required: {field}.",
  "feedback.toast_screenshot_failed":
    "Could not capture the screen. Sending the feedback without it.",
};
