# RL3 Feedback Widget

In-app feedback module that ships as **two installable packages** plus a **sandbox host** that doubles as demo and extraction validator. Drop it into any RL3 / Capellai web app and you get bug + persona capture, redacted screenshots, magic-link triage, and a per-tenant ticket workflow — without copy-paste.

> First validation host: `sapphira-clinic` (single-tenant FastAPI + Vite). Second: `capellai-ai-crm` (multi-tenant + RLS).

## Layout

```
feedback-widget/
├── packages/
│   ├── feedback-backend/   # Python package: rl3-feedback-widget (async-only)
│   └── feedback-frontend/  # JS package:    @rl3/feedback-widget
├── apps/
│   └── sandbox-host/       # demo host — also produces the OpenAPI used to gen the JS SDK
├── docs/                   # integration guides + ADRs
└── tests/sapphira-e2e/     # the full battery that proves the install works in sapphira
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
pip install "git+https://github.com/rl3-ai/feedback-widget.git@v0.1.0#subdirectory=packages/feedback-backend"
python -m feedback_widget migrate --database-url=postgresql+asyncpg://...
```

```python
from feedback_widget import register_feedback_router, FeedbackAuthAdapter, FeedbackSettings

class MyHostAuth(FeedbackAuthAdapter):
    async def get_current_user(self, request): ...
    async def get_tenant_id(self, request): ...
    def is_master_admin(self, user): ...

register_feedback_router(app, auth=MyHostAuth(), settings=FeedbackSettings())
```

**Frontend (TS/React)**:

```bash
pnpm add github:rl3-ai/feedback-widget#v0.1.0
```

```tsx
import { FeedbackProvider, FeedbackButton } from "@rl3/feedback-widget"
import "@rl3/feedback-widget/styles.css"

<FeedbackProvider bindings={{
  useCurrentUser: () => useAuth().user,
  getCsrfToken: async () => "",
  apiBaseUrl: import.meta.env.VITE_API_URL,
}}>
  <FeedbackButton />
  <YourApp />
</FeedbackProvider>
```

Full integration guide: [`docs/INTEGRATION-GUIDE.md`](./docs/INTEGRATION-GUIDE.md).
Sapphira-specific walkthrough: [`docs/INSTALL-SAPPHIRA.md`](./docs/INSTALL-SAPPHIRA.md).

## Status

`v0.1.0` — work in progress. See [`CHANGELOG.md`](./CHANGELOG.md).

The success criterion of v0.1.0 is `make verify-sapphira` returning 29/29 green: install + e2e flow + coupling + regression + CRM-sanity.

## Architecture decisions

See `docs/adr/` — every meaningful design choice has a record.

- ADR-001: workspace structure (pnpm + uv).
- ADR-002: vendoring shadcn primitives inside the widget (pays the original CRM ADR-042 debt).
- ADR-003: backend auth adapter as Protocol.
- ADR-004: package owns its Alembic chain (`version_table_schema="feedback_widget"`).
- ADR-005: distribution via git tags (no NPM/PyPI for v0.x — see CRM ADR-043).
- ADR-006: async-only backend (asyncpg + AsyncSession).

## License

Internal RL3 / Capellai use. UNLICENSED for now.
