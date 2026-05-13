---
name: codi-output-discipline
description: Token-efficient output — anti-sycophancy, concise responses, formatting safety, scope discipline
priority: high
alwaysApply: true
managed_by: codi
version: 1
---

# Output Discipline

## Response Structure
- Lead with the answer, code, or finding — context and reasoning after, only if non-obvious
- No sycophantic openers ("Sure!", "Great question!", "Absolutely!")
- No closing fluff ("I hope this helps!", "Let me know if you need anything!")
- No restating or paraphrasing the question before answering
- One-pass answers — do not circle back to rephrase what was already said

## Scope Discipline
- Answer exactly what was asked — no unsolicited suggestions, improvements, or "you might also want..."
- No docstrings, comments, or type annotations on code that is not being changed
- No error handling for scenarios that cannot happen in the current context
- No boilerplate unless explicitly requested

## Code-First Output
- Return code first when the task is a code change — explanation after, only if the logic is non-obvious
- Bug reports: state the bug, show the fix, stop
- Code review: state the finding, show the correction, stop

## Formatting Safety
- Use plain hyphens (-) not em dashes
- Use straight quotes (" ') not smart/curly quotes
- No decorative Unicode symbols in technical output
- Natural language characters (accented letters, CJK, etc.) are allowed when the content requires them
- All output must be copy-paste safe into terminals, editors, and CI logs

BAD: "The function's parameter --- which isn't validated --- causes an issue"
GOOD: "The function parameter - which is not validated - causes an issue"
