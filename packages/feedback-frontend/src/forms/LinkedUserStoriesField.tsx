/**
 * Repeatable list of {story, acceptance_criteria, priority} rows.
 * Required (≥1) for NEW_FEATURE / EXTEND_FEATURE / NEW_USER_STORY;
 * the form already gates rendering for those.
 *
 * Each row exposes a "Pick existing" dropdown sourced from
 * ``GET /api/v1/feedback/user-stories`` so the user can reuse stories
 * already submitted in the tenant's pool — same accumulator logic as
 * PersonaField.
 */

import { ChevronDown, Trash2 } from "lucide-react"

import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
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

import { useUserStoriesQuery } from "../adapter"
import { useFeedbackAdapter } from "../FeedbackProvider"
import type { LinkedUserStory } from "../types"

const PRIORITY_KEYS = [
  { value: "must", labelKey: "feedback.priority.must" },
  { value: "should", labelKey: "feedback.priority.should" },
  { value: "could", labelKey: "feedback.priority.could" },
  { value: "wont", labelKey: "feedback.priority.wont" },
]

export interface LinkedUserStoriesFieldProps {
  value: LinkedUserStory[]
  onChange: (next: LinkedUserStory[]) => void
}

export function LinkedUserStoriesField({
  value,
  onChange,
}: LinkedUserStoriesFieldProps): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const t = adapter.useTranslation()

  const stories = useUserStoriesQuery(100)

  const updateRow = (idx: number, patch: Partial<LinkedUserStory>): void => {
    const next = value.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    onChange(next)
  }

  const removeRow = (idx: number): void => {
    onChange(value.filter((_, i) => i !== idx))
  }

  const addRow = (): void => {
    onChange([
      ...value,
      { story: "", acceptance_criteria: "", priority: "must" },
    ])
  }

  const fillFromExisting = (idx: number, picked: LinkedUserStory): void => {
    onChange(
      value.map((row, i) =>
        i === idx
          ? {
              story: picked.story,
              acceptance_criteria: picked.acceptance_criteria ?? "",
              priority: picked.priority ?? "must",
            }
          : row,
      ),
    )
  }

  const items: LinkedUserStory[] =
    (stories.data as LinkedUserStory[] | undefined) ?? []

  // Field-level picker: appends a NEW row pre-filled with the chosen
  // story. Mirrors PersonaField's "Pick existing" UX so the submitter
  // can browse the tenant's accumulated story pool without first
  // having to click "+ Add".
  const appendFromExisting = (picked: LinkedUserStory): void => {
    onChange([
      ...value,
      {
        story: picked.story,
        acceptance_criteria: picked.acceptance_criteria ?? "",
        priority: picked.priority ?? "must",
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label title={t("feedback.stories.hint")}>
          {t("feedback.stories.label")}
        </Label>
        {items.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                data-feedback-id="feedback.stories.pick_existing_field"
              >
                <ChevronDown className="mr-1 h-3 w-3" />
                {t("feedback.stories.pick_existing")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[420px] max-w-[90vw]">
              <DropdownMenuLabel>
                {t("feedback.stories.pick_existing_help")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-72 overflow-y-auto">
                {items.map((s, sidx) => (
                  <DropdownMenuItem
                    key={`${sidx}-${s.story.slice(0, 12)}`}
                    onSelect={() => appendFromExisting(s)}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-sm font-medium line-clamp-1">
                      {s.story}
                    </span>
                    {s.priority ? (
                      <span className="text-[10px] text-muted-foreground">
                        [{s.priority}]
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t("feedback.stories.hint")}
        </p>
      ) : null}

      {value.map((row, idx) => (
        <div
          key={idx}
          className="rounded-md border border-input p-3 space-y-2 relative"
        >
          <div className="flex items-start justify-between gap-2">
            <Input
              value={row.story}
              onChange={(e) => updateRow(idx, { story: e.target.value })}
              placeholder={t("feedback.stories.story_placeholder")}
              data-feedback-id="feedback.stories.story"
            />
            {items.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs shrink-0"
                    data-feedback-id="feedback.stories.pick_existing"
                  >
                    <ChevronDown className="mr-1 h-3 w-3" />
                    {t("feedback.stories.pick_existing")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-[420px] max-w-[90vw]"
                >
                  <DropdownMenuLabel>
                    {t("feedback.stories.pick_existing_help")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-72 overflow-y-auto">
                    {items.map((s, sidx) => (
                      <DropdownMenuItem
                        key={`${sidx}-${s.story.slice(0, 12)}`}
                        onSelect={() => fillFromExisting(idx, s)}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="text-sm font-medium line-clamp-1">
                          {s.story}
                        </span>
                        {s.priority ? (
                          <span className="text-[10px] text-muted-foreground">
                            [{s.priority}]
                          </span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(idx)}
              aria-label={t("feedback.stories.remove")}
              data-feedback-id="feedback.stories.remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={row.acceptance_criteria ?? ""}
            onChange={(e) =>
              updateRow(idx, { acceptance_criteria: e.target.value })
            }
            placeholder={t("feedback.stories.acceptance_placeholder")}
            rows={2}
            data-feedback-id="feedback.stories.acceptance"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("feedback.field.priority")}
            </span>
            <Select
              value={row.priority ?? "must"}
              onValueChange={(v) => updateRow(idx, { priority: v })}
            >
              <SelectTrigger
                className="h-8 w-32"
                data-feedback-id="feedback.stories.priority"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_KEYS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        data-feedback-id="feedback.stories.add"
      >
        + {t("feedback.stories.add")}
      </Button>
    </div>
  )
}
