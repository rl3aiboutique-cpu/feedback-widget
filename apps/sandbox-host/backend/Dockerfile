FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# Bring the package + sandbox sources in. Build context is the repo
# root (see docker-compose.yml: `context: ../..`).
COPY packages/feedback-backend /pkg/feedback-backend
COPY apps/sandbox-host/backend/app /app/app

# Install the widget package + the runtime deps the sandbox host needs
# (no pyproject for /app — it would resolve the workspace path that
# only exists at the monorepo root).
RUN pip install --no-cache-dir \
    /pkg/feedback-backend \
    "fastapi>=0.115" \
    "uvicorn[standard]>=0.32" \
    "psycopg[binary]>=3.2"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
