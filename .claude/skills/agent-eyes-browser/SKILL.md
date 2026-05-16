---
name: agent-eyes-browser
description: Routing entre agent-browser (ojos del agente para exploración interactiva del frontend) y Playwright (E2E tests mantenibles) en el feedback-widget. Use when the user asks the agent to ver, mirar, inspeccionar o probar la UI, abrir el navegador, tomar un screenshot, validar que el widget renderiza, recorrer el chat flow, depurar un bug visual, o cuando hay que escribir/correr tests E2E, playwright codegen, regresión visual. Trigger phrases incluyen 'mira la UI', 'abre el sandbox', 'screenshot del widget', 'haz E2E', 'verifica el chat', 'click el botón X', 'qué muestra ahora', 'navegador en headless'. Skip when only backend changes are needed (use uv run pytest) o cuando el user pide otra herramienta explícita.
version: 1
category: Developer Workflow
managed_by: user
---

# agent-eyes-browser — Ojos del agente + E2E del feedback-widget

Skill de routing entre dos herramientas con responsabilidades separadas. **NO duplica funcionalidad: las usa para cosas distintas.**

| Herramienta | Cuándo | Output | Comprometido al repo |
|---|---|---|---|
| `agent-browser` 0.27.0 (global) | Exploración interactiva por el agente — verificar render, navegar flujos, screenshots ad-hoc, debugging visual | accessibility-tree refs (`@e1`, `@e2`), screenshots PNG, JSON | NO (binario global + Chrome en `~/.agent-browser/`) |
| `@playwright/test` 1.60.0 | Tests E2E mantenibles, asserts repetibles, regresión, traces, CI gate | archivos `.spec.ts`, traces, reports | SÍ (dev-dep en `apps/sandbox-host/frontend`) |

Stack decidido en [[2026-05-13_e2e-stack]] (vault).

## When to Activate

- User dice "mira", "ve", "abre", "navega", "inspecciona", "screenshot", "qué muestra", "verifica que se ve".
- User pide validar un cambio frontend sin pegar imagen manualmente.
- User pide "haz/escribe/corre E2E tests", "playwright", "codegen", "regresión visual".
- Agent decide proactivamente que necesita ojos antes de declarar terminada una feature de UI.
- Aparece un bug visual reportado y hay que reproducirlo.

## Skip When

- Cambios solo backend Python → usar `uv run pytest`.
- Lint / type-check → `pnpm biome`, `pnpm tsc`.
- El user pidió otra herramienta concreta (puppeteer, cypress, manual).
- No hay servidor frontend corriendo y la pregunta no requiere navegador.

## Decisión: agent-browser vs Playwright

| Criterio | agent-browser | Playwright |
|---|---|---|
| Iteración rápida ad-hoc | ✓ ideal | ✗ overhead de escribir spec |
| Asserts repetibles | ✗ no persistente | ✓ `expect()` + fixtures |
| Visible en CI | ✗ local dev | ✓ via `pnpm exec playwright test` |
| Refs determinísticos `@e1` | ✓ | ✗ usa selectores |
| Codegen | ✗ | ✓ `playwright codegen` |
| Trace viewer | ✗ | ✓ `--trace on` |
| Curva de uso por LLM | baja (CLI directo) | media (TypeScript spec) |

**Regla:** si el agente lo va a usar UNA vez para verificar algo → agent-browser. Si va a re-correr en CI o en cada PR → Playwright spec.

## Workflow A: agent-browser (ojos del agente)

### Pre-flight

```bash
# Levantar sandbox-host si no está
docker compose -f apps/sandbox-host/docker-compose.yml up -d
# Esperar healthcheck
curl -sI http://localhost:9201
```

### Loop básico (refs `@e`)

```bash
agent-browser open http://localhost:9201
agent-browser snapshot                # devuelve accessibility tree con @e1, @e2…
agent-browser click @e3               # click por ref
agent-browser fill @e5 "texto"        # rellenar input
agent-browser get text @e7            # leer contenido
agent-browser screenshot /tmp/ui.png  # captura visual
agent-browser close
```

### Loop avanzado

```bash
# JSON output (parseable por el agente)
agent-browser snapshot --json > /tmp/tree.json

# Screenshot anotada (numeración mapea a refs)
agent-browser screenshot /tmp/annotated.png --annotate

# Batch (evita overhead de proceso por comando)
agent-browser batch <<'EOF'
open http://localhost:9201
snapshot
click @e3
screenshot /tmp/after-click.png
close
EOF

# Selectores semánticos (alternativa a refs)
agent-browser find role button click --name "Enviar"
agent-browser find label fill "Email" "test@example.com"
```

### Cuándo el agente mira

1. **Antes de declarar feature UI terminada** — `snapshot` + `screenshot`, leer árbol, confirmar que el componente está donde toca.
2. **Reproducir un bug** — abrir página, ejecutar pasos exactos, capturar screenshot + tree del estado roto.
3. **Verificar streaming** — abrir chat, fill prompt, esperar SSE, snapshot cada N segundos.
4. **Confirmar responsive** — `agent-browser viewport set 375x812` antes de screenshot.

### Limpieza

`agent-browser close` siempre al final del flujo. El daemon persiste; sin close se queda colgado entre turnos.

## Workflow B: Playwright (E2E tests)

### Ubicación canónica

```
apps/sandbox-host/frontend/
├── tests/
│   └── e2e/
│       ├── chat-flow.spec.ts
│       └── widget-render.spec.ts
└── playwright.config.ts
```

**Por qué sandbox-host y no `packages/feedback-frontend`:** el widget aislado no se renderiza solo — necesita un host. El sandbox-host monta el widget como en prod-like.

### Primera vez (no existe playwright.config.ts todavía)

```bash
cd apps/sandbox-host/frontend
pnpm exec playwright codegen http://localhost:9201   # graba pasos visualmente
# o
pnpm exec playwright init                            # scaffold inicial
```

Tras el scaffold, ajustar `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:9201",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "docker compose -f ../../docker-compose.yml up",
    url: "http://localhost:9201",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

### Estructura de un spec

```ts
import { test, expect } from "@playwright/test";

test.describe("widget chat", () => {
  test("envía mensaje y renderiza respuesta del LLM", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /abrir feedback/i }).click();
    await page.getByRole("textbox").fill("Hola");
    await page.getByRole("button", { name: /enviar/i }).click();
    await expect(page.getByTestId("assistant-message")).toBeVisible({ timeout: 10000 });
  });
});
```

### Comandos clave

```bash
cd apps/sandbox-host/frontend

pnpm exec playwright test                          # corre todo
pnpm exec playwright test chat-flow                # filtro por nombre
pnpm exec playwright test --headed                 # navegador visible
pnpm exec playwright test --trace on               # graba trace siempre
pnpm exec playwright show-report                   # abre HTML report
pnpm exec playwright test --ui                     # modo UI interactivo
pnpm exec playwright codegen http://localhost:9201 # graba nuevos tests
```

### Selectors recomendados (orden de preferencia)

1. `page.getByRole("button", { name: /enviar/i })` — accesibilidad, lo más estable.
2. `page.getByLabel("Email")` — para inputs etiquetados.
3. `page.getByTestId("assistant-message")` — cuando role no aplica; añadir `data-testid` al componente.
4. `page.locator("css")` — último recurso.

**NO usar:** XPath, índices de DOM (`nth-child`), text exacto sin regex.

## Estrategia combinada (típica)

1. **Explorar** con agent-browser hasta entender el flujo (`snapshot` repetido).
2. **Codegen** con Playwright para auto-generar selectores del flujo ya entendido.
3. **Limpiar** el spec generado (asserts significativos, no asserts de texto literal frágil).
4. **Mantener** el spec en `tests/e2e/`. Agent-browser puede borrar el screenshot temporal.

## Anti-patterns

| Anti-pattern | Por qué mal | Hacer en su lugar |
|---|---|---|
| Pegar screenshots manualmente al chat | El agente ya tiene ojos vía agent-browser | `agent-browser screenshot` + el agente lo lee |
| Escribir spec Playwright para verificar UNA vez | Overhead que no se va a re-correr | `agent-browser` directo |
| `agent-browser open` sin `close` al final | Daemon queda colgado entre turnos | siempre `close` o `batch` |
| Selectores CSS frágiles en Playwright (`.btn-primary > span:nth-child(2)`) | Rompen al primer refactor | `getByRole` / `getByTestId` |
| Tests E2E que dependen del LLM real respondiendo | Flaky, lento, caro | mock SSE backend o usar fake_llm |
| Correr Playwright sin webServer config | Falla aleatorio si docker no está up | declarar `webServer` |

## Cheatsheet rápido

```bash
# Mirar UI ad-hoc
agent-browser open http://localhost:9201 && agent-browser snapshot

# Snapshot + screenshot en batch
agent-browser batch <<<"open http://localhost:9201
snapshot
screenshot /tmp/widget.png
close"

# Correr E2E (cuando exista la suite)
cd apps/sandbox-host/frontend && pnpm exec playwright test

# Codegen para escribir un nuevo test
cd apps/sandbox-host/frontend && pnpm exec playwright codegen http://localhost:9201

# Ver el último report
cd apps/sandbox-host/frontend && pnpm exec playwright show-report
```

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `error while loading shared libraries: lib*.so` | Linux sin deps de Chrome | `agent-browser install --with-deps` (sudo) |
| `agent-browser snapshot` devuelve árbol vacío | Página todavía cargando o iframe | esperar / `agent-browser get text body` |
| Playwright "browser not installed" | falta `playwright install chromium` | `pnpm exec playwright install chromium` |
| Test flaky por timing del SSE | espera de tiempo hardcoded | `await expect(locator).toBeVisible({ timeout: 10000 })` |
| Refs `@e1` cambian entre snapshots | re-render del componente | re-snapshot ANTES de cada click |

## Constraints

- NO commitear screenshots de `agent-browser` al repo (van a `/tmp/` o gitignore).
- NO añadir `agent-browser` a `package.json` — es herramienta dev global del agente, no dependencia del proyecto.
- NO escribir specs E2E para código backend Python (usar pytest + httpx).
- NO usar Playwright para exploración one-shot del agente (usa agent-browser).
- NO levantar Chrome dos veces simultáneas en la misma sesión sin `close` previo.
- NO commitear el directorio `playwright-report/` ni `test-results/` (agregar a `.gitignore` cuando se cree la suite).

## Cross-refs

- Vault: `vault/wiki/captures/decision/2026-05-13_e2e-stack.md`
- Rule `v1-sprint-gates.md` — Playwright entra en CI required-job a partir de cuándo se ratifique.
- `codi-testing.md` — testing pyramid (priorizar integración sobre E2E).
- `codi-workflow.md` — Baby Steps + Understand > Search > Propose > Execute aplican igual con la skill activa.
