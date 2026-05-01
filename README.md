# RL3 Feedback Widget

In-app feedback module that ships as **two installable packages** plus a **sandbox host** that doubles as demo and extraction validator. Drop it into any FastAPI + React app and you get bug + persona capture, redacted screenshots, magic-link triage, ticket comments and a per-tenant ticket workflow — without copy-paste.

> **Integrating into your project? → Read [`docs/INSTALL.md`](./docs/INSTALL.md)** — canonical guide with the host↔widget responsibility matrix, env reference and troubleshooting.

## Layout

```
feedback-widget/
├── packages/
│   ├── feedback-backend/   # Python package: rl3-feedback-widget
│   └── feedback-frontend/  # JS package:    @rl3/feedback-widget
├── apps/
│   └── sandbox-host/       # demo host — also produces the OpenAPI used to gen the JS SDK
├── docs/                   # integration guide + ADRs
└── tests/                  # e2e / contract suites
```

## Quickstart (5 minutes)

### 1. Bring up the sandbox

```bash
make sandbox-up
# → http://localhost:9001  open the demo app
# → http://localhost:9000  backend
# → http://localhost:9003  mailhog UI
```

### 2. Install into your host

**Backend (Python)**:

```bash
pip install "rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.2.4#subdirectory=packages/feedback-backend"
```

```python
from feedback_widget import mount_feedback_widget_for_async_host

mount_feedback_widget_for_async_host(
    app,
    secret_key=settings.SECRET_KEY,   # same SECRET_KEY that signs your JWTs
    algorithm="HS256",
    prefix="/api/v1/feedback",
)
```

**Frontend (TS/React)**:

```bash
pnpm add "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.2.4"
```

```tsx
import { FeedbackProvider, FeedbackButton } from "@rl3/feedback-widget"
import "@rl3/feedback-widget/styles.css"

<FeedbackProvider bindings={{
  useCurrentUser: () => useAuth().user,
  getCsrfToken: async () => "",
  apiBaseUrl: import.meta.env.VITE_API_URL,
  apiPathPrefix: "/api/v1/feedback",
}}>
  <FeedbackButton />
  <YourApp />
</FeedbackProvider>
```

Full guide: [`docs/INSTALL.md`](./docs/INSTALL.md). Short version: [`QUICKSTART.md`](./QUICKSTART.md).

## Status

Current release: **`v0.2.4`** — see [`CHANGELOG.md`](./CHANGELOG.md).

The widget is in beta: the schema may still change between minor releases. Pin to an exact tag and bump deliberately.

## Architecture decisions

See `docs/adr/` — every meaningful design choice has a record.

- ADR-001: workspace structure (pnpm + uv).
- ADR-002: vendoring shadcn primitives inside the widget.
- ADR-003: backend auth adapter as Protocol.
- ADR-004: package owns its Alembic chain (`version_table_schema="feedback_widget"`).
- ADR-005: distribution via git tags (no NPM/PyPI for v0.x).
- ADR-006: sync-initially, async follow-up.

## License

UNLICENSED — internal use.
