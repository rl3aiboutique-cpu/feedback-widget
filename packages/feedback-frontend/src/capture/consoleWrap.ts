/**
 * Console capture: a ring buffer of the last N log/info/warn/error
 * messages. Installed early in `main.tsx` so it catches startup logs;
 * anything that fired before installation is unrecoverable (documented
 * in the widget README).
 *
 * The wrap is non-destructive: every original `console.{log,info,...}`
 * call still hits the real implementation. We just append a sanitized
 * snapshot to the buffer first.
 */

import { redactString } from "../redactors"

export interface ConsoleEntry {
  level: "log" | "info" | "warn" | "error"
  message: string
  timestamp: string
}

const DEFAULT_CAPACITY = 50
const _buffer: ConsoleEntry[] = []
let _capacity = DEFAULT_CAPACITY
let _installed = false

function _sanitize(args: unknown[]): string {
  // Convert each arg to a string, redact, and join with single spaces —
  // matching the way browsers concatenate console arguments.
  const parts = args.map((arg) => {
    if (typeof arg === "string") return redactString(arg)
    if (arg === null) return "null"
    if (arg === undefined) return "undefined"
    if (typeof arg === "object") {
      try {
        return redactString(JSON.stringify(arg))
      } catch {
        return Object.prototype.toString.call(arg)
      }
    }
    return redactString(String(arg))
  })
  // Cap individual entry length so a 10MB stack trace doesn't blow the
  // bundle.
  const joined = parts.join(" ")
  return joined.length > 4096
    ? `${joined.slice(0, 4096)}...[truncated]`
    : joined
}

function _push(entry: ConsoleEntry): void {
  _buffer.push(entry)
  while (_buffer.length > _capacity) _buffer.shift()
}

export function installConsoleWrap(capacity: number = DEFAULT_CAPACITY): void {
  if (_installed) return
  _capacity = capacity
  _installed = true

  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  } as const

  for (const level of ["log", "info", "warn", "error"] as const) {
    const original = originals[level]
    console[level] = function patched(...args: unknown[]) {
      try {
        _push({
          level,
          message: _sanitize(args),
          timestamp: new Date().toISOString(),
        })
      } catch {
        // never let the wrapper break console output
      }
      return original.apply(console, args)
    }
  }
}

/** Snapshot of the buffer for the metadata bundle. Returns a copy. */
export function getConsoleTail(): ConsoleEntry[] {
  return [..._buffer]
}

/** Test helper — clears the buffer. Not exported through index.ts. */
export function _clearForTests(): void {
  _buffer.length = 0
  _installed = false
}
