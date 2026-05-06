FROM node:20-alpine AS build
WORKDIR /work

ARG VITE_API_URL=http://localhost:9200
ENV VITE_API_URL=${VITE_API_URL}

# Bring the whole monorepo so workspace links resolve. Build context is
# the repo root (see docker-compose.yml: `context: ../..`).
COPY pnpm-workspace.yaml package.json /work/
COPY packages /work/packages
COPY apps/sandbox-host/frontend /work/apps/sandbox-host/frontend

RUN corepack enable \
    && corepack prepare pnpm@9.12.0 --activate \
    && pnpm install --frozen-lockfile=false \
    && pnpm --filter @rl3/feedback-widget build \
    && pnpm --filter feedback-sandbox-host-frontend build

FROM node:20-alpine
WORKDIR /app
# `serve` is pinned so a security advisory in a future minor doesn't
# silently rebuild this stage's image with a different version.
RUN npm install -g serve@14.2.4
COPY --from=build /work/apps/sandbox-host/frontend/dist /app
EXPOSE 3000
CMD ["serve", "-s", "/app", "-l", "3000"]
