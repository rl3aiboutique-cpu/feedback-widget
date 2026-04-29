/**
 * Persona block: a multi-line textarea that lets the user either pick
 * a previously-submitted persona from the tenant's accumulated pool
 * or type a fresh one. The pool comes from
 * ``GET /api/v1/feedback/personas``.
 *
 * The "progressive business mapping" goal of the widget hinges on
 * this field — without persona reuse, every submission types its own
 * version of the same actor and the model never converges.
 */

import { ChevronDown, Pencil } from "lucide-react"
import { useState } from "react"

import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"

import { usePersonasQuery } from "../adapter"
import { useFeedbackAdapter } from "../FeedbackProvider"

const FIRST_LINE_MAX = 80

function _firstLine(s: string): string {
  const trimmed = s.trim()
  const nl = trimmed.indexOf("\n")
  const cut = nl === -1 ? trimmed : trimmed.slice(0, nl)
  return cut.length > FIRST_LINE_MAX ? `${cut.slice(0, FIRST_LINE_MAX)}…` : cut
}

export interface PersonaFieldProps {
  value: string
  onChange: (next: string) => void
}

export function PersonaField({
  value,
  onChange,
}: PersonaFieldProps): React.ReactElement {
  const adapter = useFeedbackAdapter()
  const t = adapter.useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const personas = usePersonasQuery(50)
  const items: string[] = personas.data ?? []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="feedback-persona" title={t("feedback.persona.hint")}>
          {t("feedback.persona.label")}
        </Label>
        <div className="flex items-center gap-2">
          {items.length > 0 ? (
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  data-feedback-id="feedback.persona.pick_existing"
                >
                  <ChevronDown className="mr-1 h-3 w-3" />
                  {t("feedback.persona.pick_existing")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[420px] max-w-[90vw]"
              >
                <DropdownMenuLabel>
                  {t("feedback.persona.pick_existing_help")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-72 overflow-y-auto">
                  {items.map((persona, idx) => (
                    <DropdownMenuItem
                      key={`${idx}-${persona.slice(0, 12)}`}
                      onSelect={() => {
                        onChange(persona)
                        setIsOpen(false)
                      }}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <span className="text-sm font-medium">
                        {_firstLine(persona)}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-clamp-2">
                        {persona.slice(0, 200)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(t("feedback.persona.example"))}
            data-feedback-id="feedback.persona.insert_example"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
          >
            <Pencil className="h-3 w-3" />
            {t("feedback.persona.insert_example")}
          </button>
        </div>
      </div>
      <Textarea
        id="feedback-persona"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("feedback.persona.placeholder")}
        rows={7}
        data-feedback-id="feedback.persona"
      />
    </div>
  )
}
