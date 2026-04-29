FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# uv for fast workspace installs
RUN pip install --no-cache-dir uv

# Bring the package + sandbox sources in. Build context is the repo
# root (see docker-compose.yml: `context: ../..`).
COPY packages/feedback-backend /pkg/feedback-backend
COPY apps/sandbox-host/backend /app

# Install both as editable so a hot-reload mount picks up edits.
RUN uv pip install --system --no-cache /pkg/feedback-backend
RUN uv pip install --system --no-cache /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
