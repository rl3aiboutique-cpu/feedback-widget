# RL3 Feedback Widget — top-level Makefile
# Targets are grouped by phase. See docs/ for the full plan.

.DEFAULT_GOAL := help

# ────────────────────────────────────────────────────────────────────
# Help
# ────────────────────────────────────────────────────────────────────

.PHONY: help
help:
	@echo "RL3 Feedback Widget — top-level Makefile"
	@echo ""
	@echo "Bootstrap:"
	@echo "  install              Install Python (uv sync) + JS (pnpm install) deps"
	@echo "  precommit-install    Install pre-commit hooks"
	@echo ""
	@echo "Sandbox host:"
	@echo "  sandbox-up           docker compose up: postgres + minio + mailhog + backend + frontend"
	@echo "  sandbox-down         Stop sandbox stack"
	@echo "  sandbox-logs         Tail sandbox logs"
	@echo "  sandbox-reseed       Drop sandbox DB + re-run migrations"
	@echo ""
	@echo "Lint / typecheck / test:"
	@echo "  lint                 ruff + biome on every package"
	@echo "  typecheck            mypy --strict + tsc --noEmit"
	@echo "  test                 pytest + vitest"
	@echo "  ci-local             Mirrors GH Actions: lint + typecheck + test"
	@echo ""
	@echo "Release:"
	@echo "  build-frontend       Build the JS package with tsup"
	@echo "  release              Tag v0.x.y + GH release"
	@echo ""
	@echo "Verification (Phase 5):"
	@echo "  verify-sapphira      Full 29-test battery against sapphira-clinic"
	@echo "  capture-flow         Chrome MCP records GIF of e2e flow"

# ────────────────────────────────────────────────────────────────────
# Bootstrap
# ────────────────────────────────────────────────────────────────────

.PHONY: install
install:
	uv sync --all-packages
	pnpm install

.PHONY: precommit-install
precommit-install:
	uv run pre-commit install

# ────────────────────────────────────────────────────────────────────
# Sandbox host
# ────────────────────────────────────────────────────────────────────

SANDBOX_COMPOSE := docker compose -f apps/sandbox-host/docker-compose.yml

.PHONY: sandbox-up sandbox-down sandbox-logs sandbox-reseed
sandbox-up:
	$(SANDBOX_COMPOSE) up -d --build

sandbox-down:
	$(SANDBOX_COMPOSE) down

sandbox-logs:
	$(SANDBOX_COMPOSE) logs -f --tail=200

sandbox-reseed:
	$(SANDBOX_COMPOSE) down -v
	$(SANDBOX_COMPOSE) up -d --build

# ────────────────────────────────────────────────────────────────────
# Lint / typecheck / test
# ────────────────────────────────────────────────────────────────────

.PHONY: lint typecheck test ci-local
lint:
	uv run ruff check packages/feedback-backend/src packages/feedback-backend/tests apps/sandbox-host/backend
	uv run ruff format --check packages/feedback-backend/src packages/feedback-backend/tests apps/sandbox-host/backend
	pnpm -r lint

typecheck:
	uv run mypy packages/feedback-backend/src --strict
	pnpm -r typecheck

test:
	uv run pytest packages/feedback-backend/tests
	pnpm -r test

ci-local: lint typecheck test
	@echo "ci-local: green"

# ────────────────────────────────────────────────────────────────────
# Release
# ────────────────────────────────────────────────────────────────────

.PHONY: build-frontend
build-frontend:
	pnpm --filter @rl3/feedback-widget build

# ────────────────────────────────────────────────────────────────────
# Verification (Phase 5)
# ────────────────────────────────────────────────────────────────────

.PHONY: verify-sapphira capture-flow
verify-sapphira:
	@echo "TODO: phase 5 — runs suites A (8) + B (10) + C (5) + D (4) + E (2)"
	@echo "      see docs/INSTALL-SAPPHIRA.md and tests/sapphira-e2e/"
	@false

capture-flow:
	@echo "TODO: Chrome MCP recording of end-to-end flow → docs/evidence/sapphira-flow.gif"
	@false
