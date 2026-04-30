/**
 * Single uniform feedback form. Six type chips, three text fields,
 * a multi-file attachment dropzone, and a metadata-capture disclosure.
 * Switching feedback types preserves every field — there are no
 * type-specific fields anymore.
 */

import { ChevronRight } from "lucide-react"

import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"

import { useFeedbackAdapter } from "../FeedbackProvider"
import type { FeedbackTypeKey } from "../types"
import { AttachmentsField } from "./AttachmentsField"
import { TYPE_DEFS } from "./types"

export interface FeedbackFormValues {
  type: FeedbackTypeKey | null
  title: string
  description: string
  expected_outcome: string
  attachments: File[]
}

export const EMPTY_FORM: FeedbackFormValues = {
  type: null,
  title: "",
  description: "",
  expected_outcome: "",
  attachments: [],
}

export interface FeedbackFormProps {
  values: FeedbackFormValues
  onChange: (next: FeedbackFormValues) => void
  /** Field-level error messages keyed by the same name validate()
   * returns (e.g. "title", "description"). */
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

  const setField = <K extends keyof FeedbackFormValues>(
    key: K,
    val: FeedbackFormValues[K],
  ): void => {
    onChange({ ...values, [key]: val })
  }

  const handleTypeChange = (next: FeedbackTypeKey): void => {
    if (next === values.type) return
    onChange({ ...values, type: next })
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

      {values.type ? (
        <>
          {/* Title */}
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
              className={
                errors.title ? "border-destructive ring-1 ring-destructive" : ""
              }
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title}</p>
            ) : null}
          </div>

          {/* Description — "What's happening?" */}
          <div className="space-y-2">
            <Label htmlFor="feedback-description">
              {t("feedback.field.description")}
              <_RequiredMark />
            </Label>
            <Textarea
              id="feedback-description"
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder={t("feedback.field.description_placeholder")}
              rows={5}
              data-feedback-id="feedback.field.description"
              aria-invalid={!!errors.description}
              aria-required="true"
              className={
                errors.description
                  ? "border-destructive ring-1 ring-destructive"
                  : ""
              }
            />
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : null}
          </div>

          {/* Expected outcome — "How should it work?" (optional) */}
          <div className="space-y-2">
            <Label htmlFor="feedback-expected-outcome">
              {t("feedback.field.expected_outcome")}
              <span className="ml-1 text-[11px] text-muted-foreground">
                ({t("feedback.optional")})
              </span>
            </Label>
            <Textarea
              id="feedback-expected-outcome"
              value={values.expected_outcome}
              onChange={(e) => setField("expected_outcome", e.target.value)}
              placeholder={t("feedback.field.expected_outcome_placeholder")}
              rows={3}
              data-feedback-id="feedback.field.expected_outcome"
            />
          </div>

          {/* Attachments dropzone */}
          <AttachmentsField
            value={values.attachments}
            onChange={(next) => setField("attachments", next)}
            error={errors.attachments}
          />

          {/* Metadata disclosure footer (no consent checkbox) */}
          <p className="text-[11px] text-muted-foreground">
            {t("feedback.metadata_disclosure")}
          </p>
        </>
      ) : null}
    </div>
  )
}
