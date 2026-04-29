# `@rl3/feedback-widget` (TypeScript / React)

React feedback widget: floating button, panel with 8 form types, redacted screenshot capture, admin triage page, magic-link landing pages.

Vendors its own shadcn/ui primitives — host doesn't need to ship them. Generates its own typed SDK from the package backend's OpenAPI.

## Install

```bash
pnpm add github:rl3-ai/feedback-widget#v0.1.0
```

## Public API

```ts
import {
  FeedbackProvider,
  FeedbackButton,
  FeedbackTriagePage,
  FeedbackActionPage,
  type FeedbackHostBindings,
} from "@rl3/feedback-widget"
import "@rl3/feedback-widget/styles.css"
```

See top-level [`docs/INTEGRATION-GUIDE.md`](../../docs/INTEGRATION-GUIDE.md).

## Status

`v0.1.0` — under construction. See top-level CHANGELOG.
