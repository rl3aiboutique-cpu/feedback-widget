# `@rl3/feedback-widget` (TypeScript / React)

React feedback widget: floating button, panel with multiple form types, redacted screenshot capture, admin triage page, ticket comments, magic-link landing pages.

Vendors its own shadcn/ui primitives — host doesn't need to ship them. Generates its own typed SDK from the package backend's OpenAPI.

## Install

```bash
pnpm add "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.2.4"
```

## Public API

```ts
import {
  FeedbackProvider,
  FeedbackButton,
  FeedbackTriagePage,
  FeedbackActionPage,
  useCanTriageFeedback,
  type FeedbackHostBindings,
} from "@rl3/feedback-widget"
import "@rl3/feedback-widget/styles.css"
```

See top-level [`docs/INSTALL.md`](../../docs/INSTALL.md) for the full guide and [`QUICKSTART.md`](../../QUICKSTART.md) for the bindings shape.

## Status

`v0.2.4` — beta. See top-level [`CHANGELOG.md`](../../CHANGELOG.md).
