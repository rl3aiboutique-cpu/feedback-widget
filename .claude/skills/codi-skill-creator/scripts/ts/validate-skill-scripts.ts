#!/usr/bin/env npx tsx
/**
 * Script validator for skill templates — checks Python and TypeScript
 * scripts for syntax errors, quality issues, and formatting.
 *
 * Usage: npx tsx validate-skill-scripts.ts <skill-directory>
 * Output: JSON ScriptValidationReport to stdout
 *
 * Exit codes:
 *   0 — validation completed (check verdict in report)
 *   1 — usage error or validation failure
 *   2 — critical errors found
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, relative, extname } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  severity: "error" | "warning" | "info";
  file: string;
  line?: number;
  check: string;
  message: string;
}

interface ScriptValidationReport {
  skillDir: string;
  validatedAt: string;
  filesChecked: number;
  verdict: "pass" | "warn" | "fail";
  toolsAvailable: Record<string, boolean>;
  skipped: string[];
  findings: Finding[];
}

// ---------------------------------------------------------------------------
// Tool detection
// ---------------------------------------------------------------------------

function isToolAvailable(command: string): boolean {
  try {
    execFileSync(command, ["--version"], { stdio: "pipe", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function detectTools(): Record<string, boolean> {
  return {
    python3: isToolAvailable("python3"),
    ruff: isToolAvailable("ruff"),
  };
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

async function collectScripts(
  dir: string,
): Promise<Array<{ path: string; relativePath: string; ext: string }>> {
  const results: Array<{ path: string; relativePath: string; ext: string }> =
    [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (
        entry === "node_modules" ||
        entry === ".git" ||
        entry === "__pycache__"
      )
        continue;

      const full = join(current, entry);
      const info = await stat(full).catch(() => null);
      if (!info) continue;

      if (info.isDirectory()) {
        await walk(full);
      } else {
        const ext = extname(entry);
        if (ext === ".py" || ext === ".ts") {
          results.push({ path: full, relativePath: relative(dir, full), ext });
        }
      }
    }
  }

  // Only scan scripts/ directory within the skill
  const scriptsDir = join(dir, "scripts");
  const info = await stat(scriptsDir).catch(() => null);
  if (info?.isDirectory()) {
    await walk(scriptsDir);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Python checks
// ---------------------------------------------------------------------------

function checkPythonSyntax(filePath: string): Finding | null {
  try {
    execFileSync("python3", ["-m", "py_compile", filePath], {
      stdio: "pipe",
      timeout: 15_000,
    });
    return null;
  } catch (err) {
    const msg =
      err instanceof Error && "stderr" in err
        ? String((err as { stderr: Buffer }).stderr).trim()
        : "Syntax error";
    return {
      severity: "error",
      file: filePath,
      check: "py_compile",
      message: msg || "Python syntax error",
    };
  }
}

function checkRuff(filePath: string): Finding[] {
  const findings: Finding[] = [];

  // Lint check
  try {
    execFileSync("ruff", ["check", filePath], {
      stdio: "pipe",
      timeout: 15_000,
    });
  } catch (err) {
    const output =
      err instanceof Error && "stdout" in err
        ? String((err as { stdout: Buffer }).stdout).trim()
        : "";
    if (output) {
      findings.push({
        severity: "warning",
        file: filePath,
        check: "ruff-check",
        message: output.split("\n")[0] ?? "Linting issues found",
      });
    }
  }

  // Format check
  try {
    execFileSync("ruff", ["format", "--check", filePath], {
      stdio: "pipe",
      timeout: 15_000,
    });
  } catch {
    findings.push({
      severity: "warning",
      file: filePath,
      check: "ruff-format",
      message: "File would be reformatted by ruff",
    });
  }

  return findings;
}

function checkPythonQuality(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  // LOC limit
  if (lines.length > 500) {
    findings.push({
      severity: "warning",
      file: filePath,
      check: "loc-limit",
      message: `File has ${lines.length} lines (limit: 500)`,
    });
  }

  // Module docstring
  const trimmed = content.trimStart();
  if (
    !trimmed.startsWith('"""') &&
    !trimmed.startsWith("'''") &&
    !trimmed.startsWith("#!")
  ) {
    // Allow shebang before docstring
    const afterShebang = trimmed.startsWith("#!")
      ? trimmed.slice(trimmed.indexOf("\n") + 1).trimStart()
      : trimmed;
    if (!afterShebang.startsWith('"""') && !afterShebang.startsWith("'''")) {
      findings.push({
        severity: "info",
        file: filePath,
        check: "docstring",
        message: "Missing module-level docstring",
      });
    }
  }

  // Bare except
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === "except:" || line === "except :") {
      findings.push({
        severity: "warning",
        file: filePath,
        line: i + 1,
        check: "bare-except",
        message: "Bare except — catch specific exception types",
      });
    }
  }

  // Functions without type hints (check def lines)
  const funcPattern = /^def\s+\w+\(([^)]*)\)/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(funcPattern);
    if (!match) continue;
    const params = match[1]!.trim();
    // Skip empty params and self/cls only
    if (!params || params === "self" || params === "cls") continue;
    // Check if return type annotation exists
    if (!lines[i]!.includes("->")) {
      findings.push({
        severity: "info",
        file: filePath,
        line: i + 1,
        check: "type-hints",
        message: `Function missing return type annotation`,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// TypeScript checks
// ---------------------------------------------------------------------------

function checkTypeScriptQuality(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split("\n");

  if (lines.length > 500) {
    findings.push({
      severity: "warning",
      file: filePath,
      check: "loc-limit",
      message: `File has ${lines.length} lines (limit: 500)`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

async function validateSkillScripts(
  skillDir: string,
): Promise<ScriptValidationReport> {
  const tools = detectTools();
  const files = await collectScripts(skillDir);
  const findings: Finding[] = [];
  const skipped: string[] = [];

  if (!tools.python3) skipped.push("py_compile (python3 not found)");
  if (!tools.ruff) skipped.push("ruff check/format (ruff not found)");

  for (const file of files) {
    const content = await readFile(file.path, "utf-8");

    if (file.ext === ".py") {
      // Syntax check
      if (tools.python3) {
        const syntaxResult = checkPythonSyntax(file.path);
        if (syntaxResult) {
          syntaxResult.file = file.relativePath;
          findings.push(syntaxResult);
        }
      }

      // Ruff lint + format
      if (tools.ruff) {
        for (const f of checkRuff(file.path)) {
          f.file = file.relativePath;
          findings.push(f);
        }
      }

      // Static quality checks (always run)
      for (const f of checkPythonQuality(content, file.relativePath)) {
        findings.push(f);
      }
    } else if (file.ext === ".ts") {
      // Static quality checks
      for (const f of checkTypeScriptQuality(content, file.relativePath)) {
        findings.push(f);
      }
    }
  }

  // Determine verdict
  const hasErrors = findings.some((f) => f.severity === "error");
  const hasWarnings = findings.some((f) => f.severity === "warning");
  const verdict = hasErrors ? "fail" : hasWarnings ? "warn" : "pass";

  return {
    skillDir,
    validatedAt: new Date().toISOString(),
    filesChecked: files.length,
    verdict,
    toolsAvailable: tools,
    skipped,
    findings,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx validate-skill-scripts.ts <skill-directory>");
    console.error("Output: JSON ScriptValidationReport to stdout");
    process.exit(1);
  }

  const skillDir = args[0]!;
  const report = await validateSkillScripts(skillDir);
  console.log(JSON.stringify(report, null, 2));

  if (report.verdict === "fail") {
    process.exit(2);
  }
}

// Run only when executed directly (not when imported for testing)
const isDirectExecution = process.argv[1]?.endsWith(
  "validate-skill-scripts.ts",
);
if (isDirectExecution) {
  main().catch((err) => {
    console.error("Script validation failed:", err);
    process.exit(1);
  });
}
