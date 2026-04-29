# Install `@rl3/feedback-widget` into sapphira-clinic

Step-by-step for the **first real consumer** of the widget. Total touch
in `sapphira-clinic`: ~10 files, ~100 lines net additions, all on a
new branch `feat/feedback-widget` from `development`.

> Sapphira's stack: FastAPI 0.115 + asyncpg + SQLModel + Alembic +
> React 19 + Vite 7 + TanStack Router + shadcn/ui + Tailwind 4. Bearer
> auth (no CSRF). Single-tenant. No MinIO / SMTP installed yet — this
> install adds them to docker-compose.

## 0. Branch + dependencies

```bash
cd E:/rl3aiboutique-cpu/sapphira-clinic
git checkout development
git pull
git checkout -b feat/feedback-widget
```

Add to `backend/pyproject.toml`:

```toml
[project.dependencies]
# ...existing...
"rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.1.0#subdirectory=packages/feedback-backend"
```

Add to `frontend/package.json`:

```json
{
  "dependencies": {
    "@rl3/feedback-widget": "github:rl3aiboutique-cpu/feedback-widget#v0.1.0"
  }
}
```

Run installs:

```bash
cd backend && uv sync
cd ../frontend && pnpm install
```

## 1. docker-compose: add MinIO + MailHog

Append to `docker-compose.yml`:

```yaml
  minio:
    image: minio/minio:latest
    command: server --console-address ":9001" /data
    environment:
      MINIO_ROOT_USER: sapphira-feedback
      MINIO_ROOT_PASSWORD: sapphira-feedback-dev-key
    ports:
      - "9100:9000"
      - "9101:9001"
    volumes:
      - sapphira_minio:/data

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1026:1025"
      - "8026:8025"

volumes:
  # ...existing...
  sapphira_minio:
```

## 2. Env vars

Append to `.env.example` (and your local `.env`):

```bash
FEEDBACK_ENABLED=true
FEEDBACK_DATABASE_URL=postgresql://sapphira:sapphira@postgres:5432/sapphira
FEEDBACK_BUCKET=sapphira-feedback
FEEDBACK_S3_ENDPOINT_URL=http://minio:9000
FEEDBACK_S3_PUBLIC_ENDPOINT_URL=http://localhost:9100
FEEDBACK_S3_ACCESS_KEY=sapphira-feedback
FEEDBACK_S3_SECRET_KEY=sapphira-feedback-dev-key
FEEDBACK_SMTP_HOST=mailhog
FEEDBACK_SMTP_PORT=1025
FEEDBACK_EMAILS_FROM_EMAIL=feedback@sapphira.local
FEEDBACK_EMAILS_FROM_NAME="Sapphira Feedback"
FEEDBACK_NOTIFY_EMAILS=rl3aiboutique@gmail.com
FEEDBACK_BRAND_NAME=Sapphira
FEEDBACK_ADMIN_DEEP_LINK_BASE=http://localhost:5173
FEEDBACK_REPO_URL=https://github.com/rl3aiboutique-cpu/sapphira-clinic
FEEDBACK_CSRF_REQUIRED=false
FEEDBACK_MULTI_TENANT_MODE=false
FEEDBACK_RATE_LIMIT_PER_HOUR=20
VITE_FEEDBACK_ENABLED=true
```

## 3. Backend wiring

### 3a. New file `backend/app/api/feedback_adapter.py` (~30 lines):

```python
"""Sapphira-side glue between the feedback widget and our async auth."""
from __future__ import annotations

import asyncio
import uuid

from fastapi import Request
from feedback_widget import CurrentUserSnapshot, FeedbackAuthAdapter

from app.api.deps import get_current_user_from_request  # async helper you already export


class SapphiraFeedbackAuth(FeedbackAuthAdapter):
    def get_current_user(self, request: Request) -> CurrentUserSnapshot | None:
        # Bridge from sapphira's async auth to the package's sync API.
        # The package endpoints run inside FastAPI's threadpool (sync `def`),
        # so blocking on the async helper here is safe per ADR-006.
        try:
            user = asyncio.run(get_current_user_from_request(request))
        except Exception:
            return None
        if user is None:
            return None
        return CurrentUserSnapshot(
            user_id=uuid.UUID(str(user.id)),
            email=str(user.email),
            tenant_id=None,  # sapphira is single-tenant
            role=str(user.role or ""),
            full_name=str(user.full_name or "") or None,
        )

    def is_master_admin(self, user: CurrentUserSnapshot) -> bool:
        return user.role == "admin"
```

### 3b. Wire the package in `backend/app/api/main.py`:

```python
# ... existing imports ...
from sqlalchemy import create_engine

from feedback_widget import FeedbackSettings, register_feedback_router

from app.api.feedback_adapter import SapphiraFeedbackAuth
from app.core.config import settings as host_settings  # adapt to your config name

# Sync engine for the widget. Sapphira's primary DB is async (asyncpg);
# we spin up a sync engine alongside per ADR-006.
_feedback_settings = FeedbackSettings()
_feedback_engine = create_engine(
    _feedback_settings.DATABASE_URL,
    pool_size=10,
    pool_pre_ping=True,
)

register_feedback_router(
    api_router,                         # whatever your APIRouter aggregator is named
    auth=SapphiraFeedbackAuth(),
    engine=_feedback_engine,
    settings=_feedback_settings,
    prefix="/api/v1/feedback",
)
```

### 3c. Migrations on boot

Edit `backend/Dockerfile` (or your entrypoint script) to run the
package's migrations alongside sapphira's:

```bash
# in entrypoint.sh, before uvicorn:
alembic upgrade head                         # sapphira's chain
python -m feedback_widget migrate            # widget's chain (separate version table)
```

Or add a Makefile target:

```makefile
feedback-migrate:
	cd backend && uv run python -m feedback_widget migrate
```

## 4. Frontend wiring (5 files)

### 4a. `frontend/src/lib/feedback-bindings.ts` (~25 lines):

```ts
import type { CurrentUserSnapshot, FeedbackHostBindings } from "@rl3/feedback-widget"
import useAuth from "@/hooks/useAuth"

export function useFeedbackBindings(): FeedbackHostBindings {
  return {
    useCurrentUser: (): CurrentUserSnapshot | null => {
      const { user } = useAuth()
      if (!user) return null
      return {
        user_id: String(user.id),
        email: String(user.email ?? ""),
        tenant_id: null,
        role: String((user as { role?: string }).role ?? ""),
        full_name: (user as { full_name?: string }).full_name ?? null,
      }
    },
    getCsrfToken: async () => "",  // sapphira uses Bearer; no CSRF
    apiBaseUrl: import.meta.env.VITE_API_URL ?? "",
    apiPathPrefix: "/api/v1/feedback",
  }
}
```

### 4b. `frontend/src/main.tsx` — wrap the router:

```tsx
import "@rl3/feedback-widget/styles.css"
import { FeedbackProvider, FeedbackButton } from "@rl3/feedback-widget"
import { useFeedbackBindings } from "@/lib/feedback-bindings"

function AppRoot() {
  const bindings = useFeedbackBindings()
  return (
    <FeedbackProvider bindings={bindings}>
      <RouterProvider router={router} />
      <FeedbackButton />
    </FeedbackProvider>
  )
}
```

### 4c. `frontend/src/routes/_layout/feedback-admin.tsx` (~12 lines):

```tsx
import { FeedbackTriagePage } from "@rl3/feedback-widget"
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/feedback-admin")({
  beforeLoad: ({ context }) => {
    if (context.user?.role !== "admin") {
      throw redirect({ to: "/" })
    }
  },
  component: () => <FeedbackTriagePage />,
})
```

### 4d. `frontend/src/routes/feedback-accept.tsx` and `feedback-reject.tsx` (each ~10 lines):

```tsx
import { FeedbackActionPage } from "@rl3/feedback-widget"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/feedback-accept")({
  component: () => <FeedbackActionPage action="accept" />,
})
```

(Same for `feedback-reject` with `action="reject"`.)

### 4e. Tailwind preset

Edit `frontend/tailwind.config.ts`:

```ts
import feedbackPreset from "@rl3/feedback-widget/tailwind-preset"

export default {
  presets: [feedbackPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@rl3/feedback-widget/dist/**/*.{js,mjs}",
  ],
}
```

## 5. Verification (the 29-test battery)

From the widget repo (`E:/rl3aiboutique-cpu/feedback-widget`):

```bash
make verify-sapphira
```

This runs Suites A–E (29 tests). All must pass. See the plan file
`docs/plan/quiero-que-me-ayudes-typed-turtle.md` for the full matrix.

Quick smoke (manual):

```bash
cd ../sapphira-clinic
make up
make feedback-migrate
# open http://localhost:5173
# - login as staff: floating RL3 button visible, click it, submit a Bug
# - login as admin: open /feedback-admin, see the row, mark DONE
# - open MailHog at http://localhost:8026 → click the accept link
# - the row flips to ACCEPTED_BY_USER
```
