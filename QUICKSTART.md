# `@rl3/feedback-widget` — Quickstart

Plug-and-play feedback widget para cualquier app FastAPI + React. La guía completa con la matriz host↔widget vive en [`docs/INSTALL.md`](./docs/INSTALL.md). Esto es la versión corta.

> **Repo público** — `pip install` y `npm install` resuelven el paquete sobre HTTPS sin credenciales. No hace falta token, ni BuildKit secret, ni `.netrc`.

---

## 1) Install — pip + npm, normal y corriente

### Backend (FastAPI):

```bash
pip install "rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.1.13#subdirectory=packages/feedback-backend"
```

O en `pyproject.toml`:
```toml
dependencies = [
  ...,
  "rl3-feedback-widget @ git+https://github.com/rl3aiboutique-cpu/feedback-widget.git@v0.1.13#subdirectory=packages/feedback-backend",
]
```

### Frontend (React + Vite/Next):

```bash
npm install "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.1.13"
```

O en `package.json`:
```json
"@rl3/feedback-widget": "git+https://github.com/rl3aiboutique-cpu/feedback-widget.git#v0.1.13"
```

---

## 2) Configure — solo env vars (mismo patrón que cualquier 12-factor app)

```bash
# Auth (FEEDBACK_TRIAGE_ROLES = roles que pueden triagear, CSV)
FEEDBACK_TRIAGE_ROLES=admin,manager
VITE_FEEDBACK_TRIAGE_ROLES=admin,manager   # mismo en frontend (build arg)

# Master switch
FEEDBACK_ENABLED=true

# DB / S3 / SMTP (apuntan a los servicios donde sea que vivan — local Docker, R2, SES, etc.)
FEEDBACK_DATABASE_URL=postgresql+psycopg://USER:PASS@host:5432/DB
FEEDBACK_S3_ENDPOINT_URL=http://minio:9000
FEEDBACK_S3_PUBLIC_ENDPOINT_URL=http://localhost:9100
FEEDBACK_S3_ACCESS_KEY=...
FEEDBACK_S3_SECRET_KEY=...
FEEDBACK_BUCKET=feedback
FEEDBACK_SMTP_HOST=mailhog
FEEDBACK_SMTP_PORT=1025
FEEDBACK_EMAILS_FROM_EMAIL=feedback@yourhost.com
FEEDBACK_NOTIFY_EMAILS=tu_email@gmail.com
FEEDBACK_BRAND_NAME=YourApp

# Comportamiento
FEEDBACK_RATE_LIMIT_PER_HOUR=20
FEEDBACK_CSRF_REQUIRED=false
FEEDBACK_MULTI_TENANT_MODE=false
FEEDBACK_BUCKET_FAILSAFE=0   # =1 permite arranque sin S3 (uploads 500 si lo dejas en prod)
```

Lista completa con defaults: ver [`docs/INSTALL.md`](./docs/INSTALL.md).

---

## 3) Wire — 2 puntos de extensión

### Backend (`app/main.py` o equivalente)

```python
from feedback_widget import mount_feedback_widget_for_async_host
from app.core.config import settings

mount_feedback_widget_for_async_host(
    app,
    secret_key=settings.SECRET_KEY,   # mismo SECRET_KEY que firma tus JWTs
    algorithm="HS256",
    prefix="/api/v1/feedback",
)
```

Eso construye el sync engine, corre `SELECT 1` (fail-fast), registra el router, y dispone el engine en shutdown. **Una llamada.**

### Frontend (donde montas tu provider tree)

```tsx
import { FeedbackProvider, FeedbackButton } from "@rl3/feedback-widget"
import "@rl3/feedback-widget/styles.css"
import type { FeedbackHostBindings } from "@rl3/feedback-widget"

const bindings: FeedbackHostBindings = {
  useCurrentUser: () => /* tu hook que devuelve {id, email, role, full_name} o null */,
  getCsrfToken: async () => "",          // si usas Bearer, "" — si usas cookies+CSRF, devuélvelo
  authHeader: async () =>                // omite si tu auth es por cookie HttpOnly
    `Bearer ${localStorage.getItem("access_token") || ""}`,
  apiBaseUrl: import.meta.env.VITE_API_URL,
  apiPathPrefix: "/api/v1/feedback",
  triageRoles: (import.meta.env.VITE_FEEDBACK_TRIAGE_ROLES ?? "MASTER_ADMIN").split(","),
}

// En tu árbol:
<QueryClientProvider client={queryClient}>
  <FeedbackProvider bindings={bindings}>
    <RouterProvider router={router} />
    <FeedbackButton />     {/* el botón flotante */}
  </FeedbackProvider>
</QueryClientProvider>
```

Y para la admin/triage page (en cualquier ruta protegida que crees):
```tsx
import { FeedbackTriagePage, useCanTriageFeedback } from "@rl3/feedback-widget"

function FeedbackAdminPage() {
  const canTriage = useCanTriageFeedback()
  if (!canTriage) return <p>Forbidden — triage role required</p>
  return <FeedbackTriagePage />
}
```

---

## 4) Run — una vez después de cada install/update

```bash
# Si tu app está corriendo en Docker (sapphira, capellai):
docker compose exec backend feedback-widget verify    # probe DB / S3 / SMTP
docker compose exec backend feedback-widget migrate   # crea/actualiza las 2 tablas (idempotente)

# Si está en bare-metal (uvicorn / gunicorn):
feedback-widget verify
feedback-widget migrate
```

Reinicia el backend (que el cambio de `mount_feedback_widget_for_async_host` haga efecto).

---

## 5) Operar después

| | |
|---|---|
| **Update** | Bumpear el pin a `vX.Y.Z` en `pyproject.toml` y `package.json` → `pip install`/`npm install` → `feedback-widget migrate` → restart |
| **Activar / Desactivar** | `FEEDBACK_ENABLED=true\|false` + restart backend |
| **Verify** | `feedback-widget verify` (probe DB/S3/SMTP); `feedback-widget check-config` (settings actuales) |
| **Uninstall** | `feedback-widget drop-tables` (interactive) → quitar las 5-10 líneas de wiring + el `pip install`/`npm install` line |

---

## Cuándo usar Docker vs no

El widget **no necesita Docker**. Funciona igual en `uvicorn` / `gunicorn` / Lambda / lo que sea — porque es solo un paquete pip + npm. Hosts dockerizados (sapphira, etc.) hacen el `pip install` / `npm ci` dentro del Dockerfile sin trucos: el repo es público y no necesita auth.

---

## Hosts de referencia

- **sapphira-clinic** (single-tenant) — ver `backend/app/feedback_integration.py` y `frontend/src/feedback-bindings.ts` después de `feat/feedback-plugin-pat-docker`.
- **capellai-ai-crm** (multi-tenant + RLS) — pendiente de bumpear desde la versión inline a `@rl3/feedback-widget` v0.1.11.
