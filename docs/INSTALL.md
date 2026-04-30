# Installing `@rl3/feedback-widget`

This is the canonical integration guide for any host that wants to mount the feedback widget. The widget is a Python + npm plugin: the host provides the plumbing (DB, S3, SMTP, JWT secret) and mounts two extension points (a FastAPI router + a React provider). The widget provides everything else — routes, models, migrations, mailer, UI components, screenshot redactor.

For host-specific walkthroughs see [`INSTALL-SAPPHIRA.md`](./INSTALL-SAPPHIRA.md) and [`INSTALL-CRM.md`](./INSTALL-CRM.md).

## Quick start (5 commands)

The repo is **public** — no auth required. `pip install` / `npm install` work plain.

```bash
# 1. Add the backend dep (in your pyproject.toml dependencies):
#    "rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.1.13#subdirectory=packages/feedback-backend"

# 2. Add the frontend dep (in your package.json dependencies):
#    "@rl3/feedback-widget": "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.1.13"

# 3. Wire up: 1 backend call + 1 frontend mount — see `feedback-widget init` for stubs.

# 4. Verify env vars + connectivity
feedback-widget verify

# 5. Apply migrations (separate version table — never collides with host's alembic)
feedback-widget migrate
```

## Responsabilidades — host ↔ widget

This is the contract. Anything not listed is "owned by the widget".

| Component | Provided by **host** | Provided by **widget** | Variable / API |
|---|---|---|---|
| **PostgreSQL** | Connection URL | Tables (`feedback`, `feedback_attachment`, `feedback_widget_alembic_version`), migrations, CRUD | `FEEDBACK_DATABASE_URL` |
| **S3-compatible storage** | Pre-created bucket, credentials. Works with **MinIO**, **AWS S3**, **Cloudflare R2**, **Backblaze B2**, **Wasabi**. | boto3 client, upload + redact pipeline, presigned URLs, lifecycle | `FEEDBACK_S3_ENDPOINT_URL`, `FEEDBACK_S3_PUBLIC_ENDPOINT_URL`, `FEEDBACK_S3_ACCESS_KEY`, `FEEDBACK_S3_SECRET_KEY`, `FEEDBACK_BUCKET` |
| **SMTP** | Server host + port (and optional user/password). MailHog in dev; SendGrid/SES/Mailgun in prod. | Jinja templates, mailer, follow-up + magic-link emails | `FEEDBACK_SMTP_HOST`, `FEEDBACK_SMTP_PORT`, `FEEDBACK_SMTP_USER`, `FEEDBACK_SMTP_PASSWORD`, `FEEDBACK_EMAILS_FROM_EMAIL`, `FEEDBACK_EMAILS_FROM_NAME`, `FEEDBACK_NOTIFY_EMAILS` |
| **Auth** | The `SECRET_KEY` that signs the host's JWTs. The widget decodes JWTs (HS256 default) and reads `sub`, `email`, `role`, optional `tenant_id`, `full_name` claims. | `JWTBearerAuth(secret_key=...)` adapter exported from `feedback_widget.adapters` (implements `FeedbackAuthAdapter` Protocol). | `auth=JWTBearerAuth(...)` argument to `register_feedback_router` |
| **Frontend mount** | `<FeedbackProvider apiBaseUrl, authHeader>` near the React root | UI components (button, form, admin inbox), screenshot redactor, state | React props |
| **API routes** | One call to `register_feedback_router(app, auth, engine)` | Router with all endpoints under `/feedback` (configurable) | function call |
| **Migrations** | Run `feedback-widget migrate` once during boot (after host's own migrations) | Alembic files using a dedicated version table — never collides with host's | CLI |
| **Activate / Deactivate** | `FEEDBACK_ENABLED=true|false` | Router does an early return if `false` — endpoints not exposed | env var |
| **Branding** | `FEEDBACK_BRAND_NAME`, `FEEDBACK_REPO_URL` | Defaults are intentionally neutral | env vars |
| **CSRF / Multi-tenant / Rate-limit** | Configuration decision per host | Implementation behind flags | `FEEDBACK_CSRF_REQUIRED`, `FEEDBACK_MULTI_TENANT_MODE`, `FEEDBACK_RATE_LIMIT_PER_HOUR` |

**Summary for third parties**: the host provides the plumbing and mounts two extension points. The widget owns all logic, UI, data and migrations. No component crosses the line.

## Integration steps (checklist)

1. **Generate a GitHub PAT** with scope `repo` (the widget repo is private). Save to `.secrets/github_token` and gitignore it.
2. **Backend dep** — add the `rl3-feedback-widget @ git+https://...@v0.1.1` line to `backend/pyproject.toml`. The Dockerfile must mount the PAT as a BuildKit secret and `git config insteadOf` to inject it; never bake the token into a layer or `pyproject` literal. See the example Dockerfile pattern in [`docs/DOCKERFILE-PATTERNS.md`](./DOCKERFILE-PATTERNS.md) (or in any host that already integrates the widget — sapphira's `backend/Dockerfile` is the reference).
3. **Frontend dep** — add `"@rl3/feedback-widget": "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.1.1&path:packages/feedback-frontend"` to `frontend/package.json`. Same Dockerfile pattern applies for `npm ci`.
4. **Env vars** — set the `FEEDBACK_*` vars listed in the table above. Hosts without their own DB/S3/SMTP can use the opt-in compose snippet below; sapphira and the CRM already provide these so they just point the env vars at the existing services.
5. **Backend wiring** — call `register_feedback_router(app, auth=JWTBearerAuth(secret_key=settings.SECRET_KEY), engine=engine)` in your API aggregator. Run `feedback-widget init` for the exact stub.
6. **Frontend wiring** — wrap (or place near) the React root with `<FeedbackProvider apiBaseUrl="/api/v1" authHeader={() => `Bearer ${getToken()}`}>`. The provider injects the floating button automatically.
7. **`feedback-widget verify`** — must exit 0. Common failures: missing env, S3 bucket not pre-created, SMTP host unreachable.
8. **`feedback-widget migrate`** — applies migrations to the dedicated `feedback_widget_alembic_version` table. Idempotent.

Restart the host backend. The widget is live.

## Don't have your own DB/S3/SMTP? Use the opt-in compose snippet

`docker-compose.feedback.yml` at the root of this repo declares minimal services for hosts that have no infrastructure yet:

```bash
# From the host's project root, after npm-installing the widget:
docker compose -f docker-compose.yml -f node_modules/@rl3/feedback-widget/docker-compose.feedback.yml up -d
```

That brings up `postgres-feedback` (5432→55432), `minio-feedback` (9000→9100, console 9001→9101), `mailhog-feedback` (1025→1126, UI 8025→8126). Their ports are intentionally non-default to avoid collisions. Hosts with existing infra (sapphira, the CRM) ignore this file and point the env vars at their own services.

## Environment variables (full reference)

| Variable | Default | Description |
|---|---|---|
| `FEEDBACK_ENABLED` | `true` | If `false`, `register_feedback_router` does an early return; routes not exposed. |
| `FEEDBACK_DATABASE_URL` | — | Sync-driver Postgres URL (e.g. `postgresql+psycopg://USER:PASS@host:5432/DB`). |
| `FEEDBACK_BUCKET` | `feedback` | S3-compatible bucket name. Must be pre-created. |
| `FEEDBACK_S3_ENDPOINT_URL` | `http://localhost:9000` | Internal endpoint — what the backend sees. |
| `FEEDBACK_S3_PUBLIC_ENDPOINT_URL` | falls back to `FEEDBACK_S3_ENDPOINT_URL` | Public endpoint used when generating presigned URLs sent in emails. |
| `FEEDBACK_S3_ACCESS_KEY` | `feedback` | |
| `FEEDBACK_S3_SECRET_KEY` | `feedback-dev-key` | |
| `FEEDBACK_S3_REGION` | `us-east-1` | |
| `FEEDBACK_PRESIGNED_TTL_SECONDS` | `604800` | 7 days. |
| `FEEDBACK_SMTP_HOST` | `localhost` | |
| `FEEDBACK_SMTP_PORT` | `1025` | MailHog default. |
| `FEEDBACK_SMTP_USER` | `""` | Optional. |
| `FEEDBACK_SMTP_PASSWORD` | `""` | Optional. |
| `FEEDBACK_SMTP_TLS` | `false` | |
| `FEEDBACK_SMTP_SSL` | `false` | |
| `FEEDBACK_EMAILS_FROM_EMAIL` | `feedback@example.com` | FROM address for outbound mail. |
| `FEEDBACK_EMAILS_FROM_NAME` | `Feedback Widget` | |
| `FEEDBACK_NOTIFY_EMAILS` | `""` | CSV of admins to notify on new feedback. |
| `FEEDBACK_RATE_LIMIT_PER_HOUR` | `20` | Per-user submission rate limit. |
| `FEEDBACK_MAX_SCREENSHOT_BYTES` | `10000000` | 10 MB. |
| `FEEDBACK_BRAND_NAME` | `Feedback` | Appears in UI + emails. |
| `FEEDBACK_ADMIN_DEEP_LINK_BASE` | `""` | Base URL for admin inbox links in emails. |
| `FEEDBACK_REPO_URL` | `""` | Host's repo URL — surfaced in the LLM-handoff ZIP. |
| `FEEDBACK_CSRF_REQUIRED` | `false` | Enables double-submit CSRF if your host needs it. |
| `FEEDBACK_MULTI_TENANT_MODE` | `false` | Adds tenant_id filtering on queries. Set true if your host uses Postgres-RLS. |

## Troubleshooting

- **`feedback-widget verify` fails with `s3: head_bucket NoSuchBucket`** → create the bucket: `aws --endpoint-url=$FEEDBACK_S3_ENDPOINT_URL s3 mb s3://$FEEDBACK_BUCKET`.
- **`feedback-widget migrate` fails with `relation "alembic_version" already exists`** → confirm the CLI is targeting `feedback_widget_alembic_version`. The CLI uses the bundled `alembic.ini` so this should not happen unless someone overrides it.
- **`/feedback/mine` returns 401 with a freshly-issued token** → confirm the host signs with HS256 and that the `SECRET_KEY` you pass to `JWTBearerAuth` is the SAME the host uses for `/login/access-token`. The token must carry `sub` (UUID) + `email` claims.
- **Widget invisible in the browser** → check React DevTools that `<FeedbackProvider>` is mounted (not just imported), and that `authHeader` returns a string starting with `Bearer `.
- **`docker build` fails with `fatal: could not read Username for 'https://github.com'`** → the `github_token` BuildKit secret didn't propagate. Verify `DOCKER_BUILDKIT=1`, the Dockerfile has `# syntax=docker/dockerfile:1.7` at the top, and the `RUN --mount=type=secret,id=github_token` is correct.

## Uninstall

```bash
feedback-widget drop-tables --yes      # destructive — drops the 3 tables + version table
```

Then manually:

1. Remove the `rl3-feedback-widget` line from `backend/pyproject.toml`.
2. Remove the `@rl3/feedback-widget` line from `frontend/package.json`.
3. Remove the `register_feedback_router(...)` call and any `JWTBearerAuth` import from your backend.
4. Remove the `FEEDBACK_*` env vars from `docker-compose.yml` / `.env.local`.
5. Unmount `<FeedbackProvider>` from your React tree.
6. Rebuild + restart: `docker compose build && docker compose up -d`.

The CLI does NOT edit your host's source files — that decision is yours, because automatic edits would conflict with whatever wiring you customized.
