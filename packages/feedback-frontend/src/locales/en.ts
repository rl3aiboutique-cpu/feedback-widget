/**
 * English fallback. Mirrors the keys in es.ts. The default translator
 * looks up the active locale first; missing keys fall through here.
 */
export const en: Record<string, string> = {
  "feedback.open_button": "Send feedback with RL3 Feedback",
  "feedback.open_button_with_pending":
    "RL3 Feedback — {count} ticket(s) need your confirmation",
  "feedback.tab.submit": "Submit feedback",
  "feedback.tab.mine": "My tickets",
  "feedback.mine.loading": "Loading your tickets…",
  "feedback.mine.empty": "You haven't submitted any feedback yet.",
  "feedback.mine.error": "Could not load your tickets. Please retry later.",
  "feedback.mine.action_hint":
    "We marked this resolved — check your email for the accept / reject links.",
  "feedback.button_label": "Feedback",
  "feedback.panel_title": "RL3 Feedback",
  "feedback.panel_description":
    "Tell us what you saw, what you expected, and what we should change. We attach a redacted screenshot and technical metadata.",
  "feedback.panel_skeleton_note": "Pick a feedback type to start.",
  "feedback.powered_by": "powered by",
  "feedback.powered_by_aria": "Powered by RL3 AI Agency",

  "feedback.mode_label": "Capture",
  "feedback.mode_whole_page": "Whole page",
  "feedback.mode_select_element": "Select element",
  "feedback.mode_select_element_hint":
    "We'll take you to the page: hover over any element and click to lock it.",
  "feedback.element_locked": "Element locked",
  "feedback.clear_element": "Clear element",
  "feedback.element_selector_active":
    "Element-selector mode active. Click to lock, ESC to cancel.",
  "feedback.element_selector_hint":
    "Move the mouse to highlight · Click to lock · ESC to cancel",

  "feedback.type_label": "Type",
  "feedback.type.bug": "Bug",
  "feedback.type.bug_hint":
    "Something is broken or behaves wrong. Use this when reality doesn't match expectation.",
  "feedback.type.new_feature": "New feature",
  "feedback.type.new_feature_hint": "A capability that doesn't exist yet.",
  "feedback.type.extend_feature": "Extend feature",
  "feedback.type.extend_feature_hint":
    "Something exists but doesn't go far enough.",
  "feedback.type.new_user_story": "New user story",
  "feedback.type.new_user_story_hint":
    "A discrete job to be done expressed as a user story.",
  "feedback.type.question": "Question / confusion",
  "feedback.type.question_hint":
    "You got stuck; the product didn't tell you what to do next.",
  "feedback.type.ux_polish": "UX polish",
  "feedback.type.ux_polish_hint":
    "Not a bug, not a missing feature; the surface just feels rough.",
  "feedback.type.performance": "Performance",
  "feedback.type.performance_hint":
    "Something is technically working but unacceptably slow.",
  "feedback.type.data_issue": "Data issue",
  "feedback.type.data_issue_hint":
    "The numbers, names, statuses or relationships in the system look wrong.",

  "feedback.field.title": "Title",
  "feedback.field.title_hint":
    "Short, specific summary. Will be the email subject.",
  "feedback.field.title_placeholder": "Short summary…",
  "feedback.field.description": "Description",
  "feedback.field.description_hint":
    "Markdown supported. The more concrete, the better.",
  "feedback.field.description_placeholder":
    "Tell it from the affected user's point of view…",
  "feedback.field.consent_metadata":
    "I accept that redacted technical data is captured (URL, viewport, recent logs).",

  "feedback.ticketing.section_label": "Ticket",
  "feedback.field.follow_up_email": "Follow-up email",
  "feedback.field.follow_up_email_hint":
    "Where we'll route status updates for this ticket.",
  "feedback.field.follow_up_email_placeholder": "you@example.com",
  "feedback.field.follow_up_email_help":
    "Pre-filled with your account email. Clear it to opt out of transition emails.",
  "feedback.field.parent_ticket": "Linked to (optional)",
  "feedback.field.parent_ticket_hint":
    "Reference a previous ticket — the parent auto-accepts when this one is accepted.",
  "feedback.field.parent_ticket_placeholder": "FB-2026-0042",
  "feedback.field.parent_ticket_help":
    "Format FB-YYYY-NNNN. Leave blank if this is a fresh issue.",
  "feedback.field.parent_ticket_link": "Linked to {code}",

  "feedback.field.severity": "Severity",
  "feedback.field.severity_hint":
    "Blocker = blocks work · High = severely degraded · Medium = annoying · Low = polish.",
  "feedback.severity.blocker": "Blocker",
  "feedback.severity.high": "High",
  "feedback.severity.medium": "Medium",
  "feedback.severity.low": "Low",

  "feedback.field.reproduction_steps": "Reproduction steps",
  "feedback.field.reproduction_steps_hint":
    "A numbered list, step by step. As concrete as possible.",
  "feedback.field.reproduction_steps_placeholder":
    "1. Log in as compliance officer.\n2. Open client X.\n3. Click 'Run KYC'.\n4. …",
  "feedback.field.expected_behavior": "Expected behavior",
  "feedback.field.actual_behavior": "Actual behavior",

  "feedback.field.problem_statement": "Problem statement",
  "feedback.field.problem_statement_placeholder":
    "Today, compliance officers chase signed PDFs by email; this slows onboarding by 3 to 5 days per client.",
  "feedback.field.proposed_solution": "Proposed solution",
  "feedback.field.business_value": "Business value",
  "feedback.field.business_value_placeholder":
    "Cuts onboarding cycle by 60 percent; unlocks tier 2 clients we currently turn away.",

  "feedback.field.existing_feature": "Existing feature",
  "feedback.field.gap_today": "Gap today",
  "feedback.field.proposed_extension": "Proposed extension",

  "feedback.field.user_story": "User story",
  "feedback.field.user_story_placeholder":
    "As María (Compliance Officer), I want to see a red badge on every client missing a UBO, so that I can clear the queue without opening each file.",
  "feedback.field.acceptance_criteria": "Acceptance criteria",
  "feedback.field.acceptance_criteria_placeholder":
    "Given a client with no UBO record, when I open the client list, then I see a red 'UBO missing' badge next to the name.",
  "feedback.field.priority": "Priority (MoSCoW)",
  "feedback.priority.must": "Must",
  "feedback.priority.should": "Should",
  "feedback.priority.could": "Could",
  "feedback.priority.wont": "Won't",

  "feedback.field.what_were_you_trying_to_do": "What were you trying to do?",
  "feedback.field.what_was_unclear": "What was unclear?",
  "feedback.field.where_did_you_look_first":
    "Where did you look first? (Helps us decide where to put help text)",

  "feedback.field.what_feels_off":
    "What feels off? (Copy, layout, contrast, hierarchy, motion…)",
  "feedback.field.suggested_change": "Suggested change",

  "feedback.field.what_was_slow": "What was slow?",
  "feedback.field.when_did_it_happen": "When did it happen?",
  "feedback.when.on_load": "On load",
  "feedback.when.on_action": "On action",
  "feedback.when.intermittent": "Intermittent",
  "feedback.when.always": "Always",
  "feedback.field.perceived_duration_seconds": "Perceived duration (s)",

  "feedback.field.which_record": "Which record? (id, name, or description)",
  "feedback.field.expected_data": "Expected data",
  "feedback.field.actual_data": "Actual data",
  "feedback.field.impact": "Impact",

  "feedback.persona.label": "User persona",
  "feedback.persona.hint":
    "Who is the affected user? The more concrete, the better.",
  "feedback.persona.insert_example": "Insert example",
  "feedback.persona.pick_existing": "Pick existing",
  "feedback.persona.pick_existing_help":
    "Reuse a persona from a previous submission",
  "feedback.persona.placeholder":
    "Persona: name and one-line label\nRole and seniority\nGoals when using the CRM\nTop pain points today\nTools used alongside the CRM\nFrequency of use\nWhat success looks like in this situation, one sentence.",
  "feedback.persona.example":
    "Persona: María, Senior Compliance Officer at a mid-size CSP firm.\nRole: Reports to MLRO; eight years of experience.\nGoals: Onboard new clients in under 48 hours; keep audit trail clean for FCA inspections.\nPain points: Has to chase signed PDFs across email and Dropbox; cannot tell if a UBO is missing without opening the PDF.\nTools: Outlook, Excel, World Check, the firm's DMS.\nFrequency: Daily, four to six hours, mostly mornings.\nSuccess here: She can clear today's KYC queue without opening a single PDF.",
  "feedback.stories.label": "Linked user stories",
  "feedback.stories.hint":
    "One or more stories in the form 'As {persona}, I want {capability}, so that {outcome}.'",
  "feedback.stories.add": "Add story",
  "feedback.stories.remove": "Remove",
  "feedback.stories.pick_existing": "Pick existing",
  "feedback.stories.pick_existing_help":
    "Reuse a story from a previous submission",
  "feedback.stories.story_placeholder":
    "As María (Compliance Officer), I want to see a red badge on every client missing a UBO, so that I can clear the queue without opening each file.",
  "feedback.stories.acceptance_placeholder":
    "Given a client with no UBO record, when I open the client list, then I see a red 'UBO missing' badge next to the name.",

  "feedback.metadata.title": "What is captured?",
  "feedback.metadata.summary":
    "URL, route, viewport, browser, last 50 console messages, last 20 failed network calls, breadcrumbs, app version, and commit SHA. Tokens and cookies are redacted automatically.",

  "feedback.cancel": "Cancel",
  "feedback.submit": "Send feedback",
  "feedback.submitting": "Sending…",
  "feedback.submit_disabled_until_form": "Pick a type first",

  "feedback.toast_success": "Feedback sent · {id}",
  "feedback.toast_success_link": "Open in admin",
  "feedback.toast_error_generic": "Could not send the feedback. Try again.",
  "feedback.toast_error_429": "Too much feedback. Retry in {seconds}s.",
  "feedback.toast_error_required_field": "Required: {field}.",
  "feedback.toast_type_change_warning":
    "Type-specific fields cleared when switching types.",
  "feedback.toast_screenshot_failed":
    "Could not capture the screen. Sending the feedback without it.",
}
