/**
 * Translator. English-only for the MVP — the user explicitly opted out
 * of the Spanish locale that originally shipped. The createTranslator
 * factory keeps the locale-shaped API so a future host can re-add
 * additional locales without changing every call site.
 */

import type { Translator } from "../types"
import { en } from "./en"

const _DICTIONARIES: Record<string, Record<string, string>> = { en }

export interface CreateTranslatorOptions {
  locale?: "en"
}

export function createTranslator(
  _options?: CreateTranslatorOptions,
): Translator {
  return function t(key: string, vars?: Record<string, string>): string {
    let msg = _DICTIONARIES.en?.[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        msg = msg.split(`{${k}}`).join(v)
      }
    }
    return msg
  }
}
