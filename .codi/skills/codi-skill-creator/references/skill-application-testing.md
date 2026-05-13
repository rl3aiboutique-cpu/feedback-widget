# Skill Application Testing

Reference for testing skills that embed application code: HTTP servers, library modules, or served web apps.

## When This Applies

A skill is an **application skill** when it ships any of:

- An HTTP server (`scripts/server.cjs`, `scripts/server.py`)
- Library modules with pure functions (`generators/lib/*.js`, `scripts/python/*.py`)
- A served web application (`generators/app.html` + `generators/app.js`)
- A CLI tool with complex, testable business logic

Instruction-only skills (SKILL.md + helper scripts that call external tools) do not require application tests.

## Language Decision Tree

Before writing tests, determine which runner applies:

```
Has generators/lib/*.js or app.js?
  YES → vitest  (tests/unit/, tests/integration/)

Has scripts/python/*.py with pure logic?
  YES → pytest  (tests/python/)

Has both?
  YES → both runners, same tests/ directory
```

**What counts as pure Python logic** (test it):

- Pure functions: math, data transformation, validation rules, string parsing
- File I/O using only stdlib (`pathlib`, `json`, `csv`)

**What to skip** (I/O-heavy, skip or use mocks):

- Scripts that call external binaries (LibreOffice, ffmpeg, Whisper)
- Browser automation (Playwright)
- Scripts that spawn HTTP servers or subprocesses

## Directory Layout

```
skill-name/
├── SKILL.md
├── generators/
│   └── lib/                  # JS pure functions — vitest
├── scripts/
│   └── python/               # Python pure functions — pytest
├── skill.test.json           # Tier manifest
└── tests/
    ├── unit/                 # JS unit tests (vitest)
    │   └── *.test.js
    ├── python/               # Python unit tests (pytest)
    │   ├── conftest.py       # sys.path setup — one per skill
    │   └── test_*.py
    └── integration/          # Server/HTTP tests (vitest, node env)
        └── *.test.js
```

## skill.test.json — Tier Manifest

Create `skill.test.json` at the skill root:

**JS-only skill (content-factory pattern):**

```json
{
  "skill": "content-factory",
  "tiers": {
    "contract": true,
    "logic": {
      "lib": "generators/lib/",
      "tests": "tests/unit/"
    },
    "behavior": {
      "server": "scripts/server.cjs",
      "startScript": "scripts/start-server.sh",
      "tests": "tests/integration/"
    }
  }
}
```

**Python-only skill (slack-gif-creator pattern):**

```json
{
  "skill": "slack-gif-creator",
  "tiers": {
    "contract": true,
    "logic": {
      "lib": "scripts/python/",
      "tests": "tests/python/"
    }
  }
}
```

**Mixed skill (JS + Python):**

```json
{
  "skill": "my-skill",
  "tiers": {
    "contract": true,
    "logic": {
      "js": { "lib": "generators/lib/", "tests": "tests/unit/" },
      "python": { "lib": "scripts/python/", "tests": "tests/python/" }
    },
    "behavior": {
      "server": "scripts/server.cjs",
      "tests": "tests/integration/"
    }
  }
}
```

## Running Tests

### JavaScript (vitest)

`vitest.config.ts` auto-discovers skill tests:

```
include: ["src/templates/skills/**/tests/**/*.test.{ts,js}"]
```

```bash
npm test                                              # all JS tests
npx vitest run src/templates/skills/<name>/tests/    # one skill
```

### Python (pytest)

`pyproject.toml` configures pytest:

```
testpaths = ["src/templates/skills"]
python_files = ["test_*.py"]
```

```bash
npm run test:python                                               # all Python skill tests
uv run pytest src/templates/skills/<name>/tests/python/ -v       # one skill
```

### Both

```bash
npm run test:all    # runs both; always executes pytest even if vitest fails
```

## Writing Python Unit Tests

### conftest.py — required for every skill with Python tests

Each skill needs a `conftest.py` to add the skill root to `sys.path`.
This lets tests import from `scripts/python/` with clean paths.

**Location**: `tests/python/conftest.py`

```python
import sys
from pathlib import Path

# Add skill root to sys.path so test files can import from scripts/python/
# conftest.py is at: tests/python/conftest.py
# parents[2]      is: <skill-root>/
sys.path.insert(0, str(Path(__file__).parents[2]))
```

### Test file

**Location**: `tests/python/test_<module>.py`

```python
import pytest
from scripts.python.my_module import my_function

def test_my_function_returns_expected_for_valid_input():
    assert my_function("input") == "expected"

def test_my_function_handles_empty_string():
    assert my_function("") is None

@pytest.mark.parametrize("t,expected", [
    (0.0, 0.0),
    (0.5, 0.5),
    (1.0, 1.0),
])
def test_my_function_parametrized(t, expected):
    assert my_function(t) == pytest.approx(expected)
```

Rules:

- Use `pytest.approx()` for all float comparisons — never `==` on floats
- Use `@pytest.mark.parametrize` for boundary sweeps (0.0, 0.5, 1.0, edge values)
- Name tests: `test_<function>_<condition>_<expected>`
- One assertion per test when practical
- Test all exported functions

### Handling dependencies (PIL, numpy, etc.)

When a module imports a heavy library only inside a function body:

```python
# validators.py — PIL is imported lazily
def validate_gif(path):
    from PIL import Image
    ...
```

Test the dependency-free paths without mocking:

```python
def test_validate_gif_returns_error_for_missing_file():
    ok, result = validate_gif("/nonexistent/file.gif")
    assert ok is False
    assert "error" in result
```

Test PIL-dependent paths with `unittest.mock.patch`:

```python
from unittest.mock import MagicMock, patch

def test_validate_gif_checks_dimensions(tmp_path):
    gif = tmp_path / "test.gif"
    gif.write_bytes(b"GIF89a" + b"\x00" * 10)  # minimal GIF header
    with patch("scripts.python.validators.Image") as mock_img:
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.size = (128, 128)
        mock_img.open.return_value = mock_ctx
        ok, result = validate_gif(str(gif))
    assert "width" in result
```

If mocking is too complex, install the dependency via uv:

```bash
uv add --dev pillow
```

## Writing JavaScript Unit Tests

**Location**: `tests/unit/<module>.test.js`

```javascript
import { describe, it, expect } from "vitest";
import { myFunction } from "#src/templates/skills/<name>/generators/lib/my-module.js";

describe("myFunction", () => {
  it("returns expected output for valid input", () => {
    expect(myFunction("input")).toBe("expected");
  });

  it("handles null input gracefully", () => {
    expect(myFunction(null)).toEqual(defaultValue);
  });
});
```

Use `// @vitest-environment jsdom` at the top of files that need DOM APIs.

## Writing Integration Tests (JavaScript)

**Location**: `tests/integration/server.test.js`

The canonical implementation is in `src/templates/skills/content-factory/tests/integration/server.test.js`.

Pattern: spawn the bash start script, wait for `{"type":"server-started"}` JSON on stdout, extract `url`, make HTTP requests.

```javascript
// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

vi.setConfig({ testTimeout: 20_000 });

let serverProcess, baseUrl, tempDir;

beforeAll(async () => {
  tempDir = mkdtempSync(`${tmpdir()}/skill-test-`);
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server start timeout")), 10_000);
    const proc = spawn("bash", ["scripts/start-server.sh", "--project-dir", tempDir]);
    serverProcess = proc;
    proc.stdout.on("data", (chunk) => {
      for (const line of chunk.toString().split("\n")) {
        try {
          const data = JSON.parse(line.trim());
          if (data.type === "server-started") { clearTimeout(timer); resolve(data); }
        } catch { /* skip non-JSON */ }
      }
    });
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
  baseUrl = result.url;
});

afterAll(() => {
  serverProcess?.kill("SIGTERM");
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});
```

## Reference Implementations

| Skill | Language | Tests | Notes |
|-------|----------|-------|-------|
| `content-factory` | JavaScript | `tests/unit/`, `tests/integration/` | Canonical JS+server pattern |
| `slack-gif-creator` | Python | `tests/python/` | Canonical Python pattern |
