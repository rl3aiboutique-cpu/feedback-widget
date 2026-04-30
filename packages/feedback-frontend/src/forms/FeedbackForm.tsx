/**
 * Single data-driven feedback form. Renders the common fields plus the
 * per-type fields defined in ``./types``. Switching feedback types
 * preserves the common values and clears the type-specific ones (with
 * a sonner toast warning when the user actually had data in them).
 */

import { ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Input } from "../ui/input"
import { Label } from "../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Textarea } from "../ui/textarea"

import { useFeedbackAdapter } from "../FeedbackProvider"
import type { FeedbackTypeKey, LinkedUserStory } from "../types"
import { LinkedUserStoriesField } from "./LinkedUserStoriesField"
import { PersonaField } from "./PersonaField"
import { getTypeDef, TYPE_DEFS } from "./types"

export interface FeedbackFormValues {
  type: FeedbackTypeKey | null
  title: string
  description: string
  type_fields: Record<string, string | number>
  persona: string
  linked_user_stories: LinkedUserStory[]
  consent_metadata_capture: boolean
  /** Email address for status-transition notifications. Defaults to the
   * authenticated user's email but the submitter can override. Empty
   * string ⇒ opt out of transition emails (the row is still saved). */
  follow_up_email: string
  /** Optional reference to a previous ticket (FB-YYYY-NNNN). When set
   * the new feedback is linked as a child; on accept the parent
   * cascades to ACCEPTED_BY_USER. */
  parent_ticket_code: string
}

export const EMPTY_FORM: FeedbackFormValues = {
  type: null,
  title: "",
  description: "",
  type_fields: {},
  persona: "",
  linked_user_stories: [],
  consent_metadata_capture: true,
  follow_up_email: "",
  parent_ticket_code: "",
}

export interface FeedbackFormProps {
  values: FeedbackFormValues
  onChange: (next: FeedbackFormValues) => void
  /** Field-level error messages. Key is the field name returned by
   * `validate()` in FeedbackPanel (e.g. "title", "severity", "persona").
   * Empty/absent ⇒ no error to display. When set, the corresponding
   * Label gets a red asterisk and the input gets `border-destructive`
   * styling. */
  errors?: Record<string, string>
}

const _RequiredMark = (): React.ReactElement => (
  <span aria-hidden="true" className="ml-0.5 text-destructive">
    *
  </span>
)

export function FeedbackForm({
  values,
  onChange,
  errors = {},
}: FeedbackFormProps): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const t = adapter.useTranslation()

  const activeDef = useMemo(
    () => (values.type ? getTypeDef(values.type) : null),
    [values.type],
  )

  // Track previous type so we can warn when type-specific data is dropped.
  const [previousType, setPreviousType] = useState<FeedbackTypeKey | null>(
    values.type,
  )
  useEffect(() => {
    if (previousType !== values.type) {
      const hadData = Object.values(values.type_fields).some(
        (v) => v !== "" && v !== null && v !== undefined,
      )
      if (previousType !== null && hadData) {
        adapter.toast.warning(t("feedback.toast_type_change_warning"))
      }
      setPreviousType(values.type)
    }
  }, [values.type, previousType, t, values.type_fields, adapter])

  const setField = <K extends keyof FeedbackFormValues>(
    key: K,
    val: FeedbackFormValues[K],
  ): void => {
    onChange({ ...values, [key]: val })
  }

  const setTypeFieldValue = (name: string, val: string | number): void => {
    onChange({
      ...values,
      type_fields: { ...values.type_fields, [name]: val },
    })
  }

  const handleTypeChange = (next: FeedbackTypeKey): void => {
    if (next === values.type) return
    onChange({
      ...values,
      type: next,
      // Clear type_fields on switch so we don't smuggle stale fields
      // into the next type's payload.
      type_fields: {},
    })
  }

  return (
    <div className="space-y-5">
      {/* Type chips */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("feedback.type_label")}
        </Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TYPE_DEFS.map((def) => {
            const active = values.type === def.key
            return (
              <button
                key={def.key}
                type="button"
                title={t(def.hintKey)}
                onClick={() => handleTypeChange(def.key)}
                data-feedback-id={`feedback.type.${def.key}`}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors
                  ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input hover:bg-accent hover:text-accent-foreground"
                  }`}
              >
                <span>{t(def.labelKey)}</span>
                <ChevronRight className="h-3 w-3 opacity-50" />
              </button>
            )
          })}
        </div>
      </div>

      {activeDef ? (
        <>
          {/* Common: title + description */}
          <div className="space-y-2">
            <Label
              htmlFor="feedback-title"
              title={t("feedback.field.title_hint")}
            >
              {t("feedback.field.title")}
              <_RequiredMark />
            </Label>
            <Input
              id="feedback-title"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder={t("feedback.field.title_placeholder")}
              data-feedback-id="feedback.field.title"
              maxLength={200}
              aria-invalid={!!errors.title}
              aria-required="true"
              className={errors.title ? "border-destructive ring-1 ring-destructive" : ""}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="feedback-description"
              title={t("feedback.field.description_hint")}
            >
              {t("feedback.field.description")}
              <_RequiredMark />
            </Label>
            <Textarea
              id="feedback-description"
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder={t("feedback.field.description_placeholder")}
              rows={4}
              data-feedback-id="feedback.field.description"
              aria-invalid={!!errors.description}
              aria-required="true"
              className={errors.description ? "border-destructive ring-1 ring-destructive" : ""}
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : null}
          </div>

          {/* Type-specific fields */}
          {activeDef.fields.map((field) => {
            const fieldId = `feedback-tf-${field.name}`
            const value = values.type_fields[field.name] ?? ""
            const isRequired = field.required !== false
            const fieldError = errors[field.name]
            const errorClass = fieldError
              ? "border-destructive ring-1 ring-destructive"
              : ""
            return (
              <div key={field.name} className="space-y-2">
                <Label
                  htmlFor={fieldId}
                  title={field.hintKey ? t(field.hintKey) : undefined}
                >
                  {t(field.labelKey)}
                  {isRequired ? <_RequiredMark /> : null}
                </Label>
                {field.kind === "textarea" ? (
                  <Textarea
                    id={fieldId}
                    value={String(value)}
                    onChange={(e) =>
                      setTypeFieldValue(field.name, e.target.value)
                    }
                    placeholder={
                      field.placeholderKey ? t(field.placeholderKey) : undefined
                    }
                    rows={field.rows ?? 3}
                    data-feedback-id={`feedback.field.${field.name}`}
                    aria-invalid={!!fieldError}
                    aria-required={isRequired}
                    className={errorClass}
                  />
                ) : field.kind === "number" ? (
                  <Input
                    id={fieldId}
                    type="number"
                    inputMode="numeric"
                    value={String(value)}
                    onChange={(e) =>
                      setTypeFieldValue(
                        field.name,
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder={
                      field.placeholderKey ? t(field.placeholderKey) : undefined
                    }
                    data-feedback-id={`feedback.field.${field.name}`}
                    aria-invalid={!!fieldError}
                    aria-required={isRequired}
                    className={errorClass}
                  />
                ) : field.kind === "select" ? (
                  <Select
                    value={String(value || "")}
                    onValueChange={(v) => setTypeFieldValue(field.name, v)}
                  >
                    <SelectTrigger
                      id={fieldId}
                      data-feedback-id={`feedback.field.${field.name}`}
                      aria-invalid={!!fieldError}
                      aria-required={isRequired}
                      className={errorClass}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={fieldId}
                    value={String(value)}
                    onChange={(e) =>
                      setTypeFieldValue(field.name, e.target.value)
                    }
                    placeholder={
                      field.placeholderKey ? t(field.placeholderKey) : undefined
                    }
                    data-feedback-id={`feedback.field.${field.name}`}
                    aria-invalid={!!fieldError}
                    aria-required={isRequired}
                    className={errorClass}
                  />
                )}
                {fieldError ? (
                  <p className="text-xs text-destructive">{fieldError}</p>
                ) : null}
              </div>
            )
          })}

          {/* Persona + linked stories for the three mapping types */}
          {activeDef.requiresPersona ? (
            <div className={errors.persona ? "rounded-md ring-1 ring-destructive p-1 -m-1" : ""}>
              <PersonaField
                value={values.persona}
                onChange={(v) => setField("persona", v)}
              />
              {errors.persona ? (
                <p className="text-xs text-destructive mt-1 px-1">{errors.persona}</p>
              ) : null}
              <LinkedUserStoriesField
                value={values.linked_user_stories}
                onChange={(v) => setField("linked_user_stories", v)}
              />
              {errors.linked_user_stories ? (
                <p className="text-xs text-destructive mt-1 px-1">
                  {errors.linked_user_stories}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Ticketing — follow-up email + parent ticket reference. */}
          <div className="rounded-md border border-input p-3 space-y-3 bg-muted/40">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("feedback.ticketing.section_label")}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="feedback-follow-up-email"
                title={t("feedback.field.follow_up_email_hint")}
              >
                {t("feedback.field.follow_up_email")}
              </Label>
              <Input
                id="feedback-follow-up-email"
                type="email"
                value={values.follow_up_email}
                onChange={(e) => setField("follow_up_email", e.target.value)}
                placeholder={t("feedback.field.follow_up_email_placeholder")}
                data-feedback-id="feedback.field.follow_up_email"
                maxLength={320}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("feedback.field.follow_up_email_help")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="feedback-parent-ticket"
                title={t("feedback.field.parent_ticket_hint")}
              >
                {t("feedback.field.parent_ticket")}
              </Label>
              <Input
                id="feedback-parent-ticket"
                value={values.parent_ticket_code}
                onChange={(e) =>
                  setField("parent_ticket_code", e.target.value.toUpperCase())
                }
                placeholder={t("feedback.field.parent_ticket_placeholder")}
                data-feedback-id="feedback.field.parent_ticket"
                maxLength={24}
                pattern="^FB-\d{4}-\d{4}$"
                className="font-mono"
              />
              {values.parent_ticket_code ? (
                <p className="text-[11px] text-primary">
                  {t("feedback.field.parent_ticket_link", {
                    code: values.parent_ticket_code,
                  })}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {t("feedback.field.parent_ticket_help")}
                </p>
              )}
            </div>
          </div>

          {/* Consent checkbox */}
          <label
            className={`flex items-start gap-2 text-xs cursor-pointer ${
              errors.consent_metadata_capture
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            <input
              type="checkbox"
              checked={values.consent_metadata_capture}
              onChange={(e) =>
                setField("consent_metadata_capture", e.target.checked)
              }
              className={`mt-0.5 ${errors.consent_metadata_capture ? "ring-1 ring-destructive" : ""}`}
              data-feedback-id="feedback.field.consent_metadata"
              aria-invalid={!!errors.consent_metadata_capture}
              aria-required="true"
            />
            <span>
              {t("feedback.field.consent_metadata")}
              <_RequiredMark />
            </span>
          </label>
        </>
      ) : null}
    </div>
  )
}
