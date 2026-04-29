/**
 * Per-type field definitions used by the FeedbackForm component.
 *
 * The widget intentionally keeps form fields data-driven so a future
 * v2 can add a 9th feedback type without touching React. Each entry
 * lists the fields that type requires (the labels, placeholders, and
 * widget kind), and whether the type also requires the persona +
 * linked-stories block.
 */

import type { FeedbackTypeKey } from "../types"

export type FieldKind = "textarea" | "text" | "number" | "select"

export interface FieldDef {
  /** key inside type_fields */
  name: string
  /** translation key for the label */
  labelKey: string
  /** translation key for the tooltip / hint (optional) */
  hintKey?: string
  /** translation key for the placeholder (optional) */
  placeholderKey?: string
  /** widget shape */
  kind: FieldKind
  /** select options as { value, labelKey } */
  options?: { value: string; labelKey: string }[]
  /** required for the type (default true) */
  required?: boolean
  /** for textareas, number of visible rows */
  rows?: number
}

export interface TypeDef {
  key: FeedbackTypeKey
  /** translation key for the chip label */
  labelKey: string
  /** translation key for the tooltip on the chip */
  hintKey: string
  /** required type-specific fields */
  fields: FieldDef[]
  /** persona block required for this type */
  requiresPersona: boolean
  /** at least one linked user story required for this type */
  requiresLinkedStories: boolean
}

const SEVERITY_OPTIONS: FieldDef["options"] = [
  { value: "blocker", labelKey: "feedback.severity.blocker" },
  { value: "high", labelKey: "feedback.severity.high" },
  { value: "medium", labelKey: "feedback.severity.medium" },
  { value: "low", labelKey: "feedback.severity.low" },
]

const PRIORITY_OPTIONS: FieldDef["options"] = [
  { value: "must", labelKey: "feedback.priority.must" },
  { value: "should", labelKey: "feedback.priority.should" },
  { value: "could", labelKey: "feedback.priority.could" },
  { value: "wont", labelKey: "feedback.priority.wont" },
]

const WHEN_OPTIONS: FieldDef["options"] = [
  { value: "on_load", labelKey: "feedback.when.on_load" },
  { value: "on_action", labelKey: "feedback.when.on_action" },
  { value: "intermittent", labelKey: "feedback.when.intermittent" },
  { value: "always", labelKey: "feedback.when.always" },
]

export const TYPE_DEFS: TypeDef[] = [
  {
    key: "bug",
    labelKey: "feedback.type.bug",
    hintKey: "feedback.type.bug_hint",
    // Spec §"Type 1: Bug" — user_persona: textarea (required).
    // The persona is required even for bugs because the team needs to
    // know which actor's job is broken, not just what the symptom is.
    // Linked user stories are zero-or-more allowed for Bug.
    requiresPersona: true,
    requiresLinkedStories: false,
    fields: [
      {
        name: "severity",
        labelKey: "feedback.field.severity",
        hintKey: "feedback.field.severity_hint",
        kind: "select",
        options: SEVERITY_OPTIONS,
      },
      {
        name: "reproduction_steps",
        labelKey: "feedback.field.reproduction_steps",
        hintKey: "feedback.field.reproduction_steps_hint",
        placeholderKey: "feedback.field.reproduction_steps_placeholder",
        kind: "textarea",
        rows: 5,
      },
      {
        name: "expected_behavior",
        labelKey: "feedback.field.expected_behavior",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "actual_behavior",
        labelKey: "feedback.field.actual_behavior",
        kind: "textarea",
        rows: 2,
      },
    ],
  },
  {
    key: "new_feature",
    labelKey: "feedback.type.new_feature",
    hintKey: "feedback.type.new_feature_hint",
    requiresPersona: true,
    requiresLinkedStories: true,
    fields: [
      {
        name: "problem_statement",
        labelKey: "feedback.field.problem_statement",
        placeholderKey: "feedback.field.problem_statement_placeholder",
        kind: "textarea",
        rows: 3,
      },
      {
        name: "proposed_solution",
        labelKey: "feedback.field.proposed_solution",
        kind: "textarea",
        rows: 3,
      },
      {
        name: "business_value",
        labelKey: "feedback.field.business_value",
        placeholderKey: "feedback.field.business_value_placeholder",
        kind: "textarea",
        rows: 2,
      },
    ],
  },
  {
    key: "extend_feature",
    labelKey: "feedback.type.extend_feature",
    hintKey: "feedback.type.extend_feature_hint",
    requiresPersona: true,
    requiresLinkedStories: true,
    fields: [
      {
        name: "existing_feature",
        labelKey: "feedback.field.existing_feature",
        kind: "text",
      },
      {
        name: "gap_today",
        labelKey: "feedback.field.gap_today",
        kind: "textarea",
        rows: 3,
      },
      {
        name: "proposed_extension",
        labelKey: "feedback.field.proposed_extension",
        kind: "textarea",
        rows: 3,
      },
      {
        name: "business_value",
        labelKey: "feedback.field.business_value",
        kind: "textarea",
        rows: 2,
      },
    ],
  },
  {
    key: "new_user_story",
    labelKey: "feedback.type.new_user_story",
    hintKey: "feedback.type.new_user_story_hint",
    requiresPersona: true,
    requiresLinkedStories: true,
    fields: [
      {
        name: "user_story",
        labelKey: "feedback.field.user_story",
        placeholderKey: "feedback.field.user_story_placeholder",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "acceptance_criteria",
        labelKey: "feedback.field.acceptance_criteria",
        placeholderKey: "feedback.field.acceptance_criteria_placeholder",
        kind: "textarea",
        rows: 4,
      },
      {
        name: "priority",
        labelKey: "feedback.field.priority",
        kind: "select",
        options: PRIORITY_OPTIONS,
      },
    ],
  },
  {
    key: "question",
    labelKey: "feedback.type.question",
    hintKey: "feedback.type.question_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "what_were_you_trying_to_do",
        labelKey: "feedback.field.what_were_you_trying_to_do",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "what_was_unclear",
        labelKey: "feedback.field.what_was_unclear",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "where_did_you_look_first",
        labelKey: "feedback.field.where_did_you_look_first",
        kind: "textarea",
        rows: 2,
      },
    ],
  },
  {
    key: "ux_polish",
    labelKey: "feedback.type.ux_polish",
    hintKey: "feedback.type.ux_polish_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "what_feels_off",
        labelKey: "feedback.field.what_feels_off",
        kind: "textarea",
        rows: 3,
      },
      {
        name: "suggested_change",
        labelKey: "feedback.field.suggested_change",
        kind: "textarea",
        rows: 3,
      },
    ],
  },
  {
    key: "performance",
    labelKey: "feedback.type.performance",
    hintKey: "feedback.type.performance_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "what_was_slow",
        labelKey: "feedback.field.what_was_slow",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "when_did_it_happen",
        labelKey: "feedback.field.when_did_it_happen",
        kind: "select",
        options: WHEN_OPTIONS,
      },
      {
        name: "perceived_duration_seconds",
        labelKey: "feedback.field.perceived_duration_seconds",
        kind: "number",
      },
    ],
  },
  {
    key: "data_issue",
    labelKey: "feedback.type.data_issue",
    hintKey: "feedback.type.data_issue_hint",
    requiresPersona: false,
    requiresLinkedStories: false,
    fields: [
      {
        name: "which_record",
        labelKey: "feedback.field.which_record",
        kind: "text",
      },
      {
        name: "expected_data",
        labelKey: "feedback.field.expected_data",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "actual_data",
        labelKey: "feedback.field.actual_data",
        kind: "textarea",
        rows: 2,
      },
      {
        name: "impact",
        labelKey: "feedback.field.impact",
        kind: "textarea",
        rows: 2,
      },
    ],
  },
]

export function getTypeDef(key: FeedbackTypeKey): TypeDef {
  const found = TYPE_DEFS.find((d) => d.key === key)
  if (!found) {
    throw new Error(`Unknown feedback type: ${key}`)
  }
  return found
}
