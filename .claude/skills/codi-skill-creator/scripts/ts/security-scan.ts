#!/usr/bin/env npx tsx
/**
 * Security scanner for imported/third-party skills.
 *
 * Usage: npx tsx security-scan.ts <skill-directory>
 * Output: JSON SecurityReport to stdout
 *
 * Exit codes:
 *   0 — scan completed (check verdict in report)
 *   1 — usage error or scan failure
 */

import { readdir, readFile, stat, access } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import {
  INJECTION_PATTERNS,
  SCRIPT_PATTERNS,
  EXFIL_PATTERNS,
  DEPENDENCY_PATTERNS,
  MAGIC_BYTES,
  EXECUTABLE_SIGNATURES,
  type PatternDef,
} from "./security-patterns.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecuritySeverity = "critical" | "high" | "medium" | "low";

type SecurityCategory =
  | "prompt_injection"
  | "malicious_script"
  | "data_exfiltration"
  | "file_type_mismatch"
  | "frontmatter_invalid"
  | "content_size"
  | "suspicious_dependency";

interface SecurityFinding {
  severity: SecuritySeverity;
  category: SecurityCategory;
  file: string;
  line?: number;
  pattern: string;
  description: string;
}

interface SecurityReport {
  skillDir: string;
  scannedAt: string;
  filesScanned: number;
  verdict: SecuritySeverity | "pass";
  findings: SecurityFinding[];
  summary: Record<SecuritySeverity, number>;
}

interface FileInfo {
  path: string;
  relativePath: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 1_048_576; // 1 MB warn
const MAX_FILE_BYTES_BLOCK = 10_485_760; // 10 MB block
const MAX_DIR_BYTES = 10_485_760; // 10 MB total warn
const MAX_DIR_BYTES_BLOCK = 52_428_800; // 50 MB total block
const MAX_SKILL_LINES = 500;
const MAX_DESCRIPTION_LENGTH = 1024;
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip content inside markdown code fences to avoid false positives
 * on documentation that discusses dangerous patterns as examples.
 */
function stripCodeFences(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "");
}

/**
 * Recursively collect all files in a directory.
 */
async function collectFiles(dir: string, root: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, root)));
    } else {
      try {
        const s = await stat(fullPath);
        files.push({
          path: fullPath,
          relativePath: relative(root, fullPath),
          sizeBytes: s.size,
        });
      } catch {
        // Skip unreadable files
      }
    }
  }
  return files;
}

function matchPatterns(
  content: string,
  filePath: string,
  patterns: PatternDef[],
  category: SecurityCategory,
  stripFences: boolean,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const scanContent = stripFences ? stripCodeFences(content) : content;
  const lines = scanContent.split("\n");

  for (const def of patterns) {
    for (let i = 0; i < lines.length; i++) {
      if (def.pattern.test(lines[i]!)) {
        findings.push({
          severity: def.severity,
          category,
          file: filePath,
          line: i + 1,
          pattern: def.pattern.source.slice(0, 60),
          description: def.description,
        });
        break; // One finding per pattern per file
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Scanner functions (exported for testing)
// ---------------------------------------------------------------------------

export function scanForPromptInjection(
  content: string,
  filePath: string,
): SecurityFinding[] {
  return matchPatterns(
    content,
    filePath,
    INJECTION_PATTERNS,
    "prompt_injection",
    true,
  );
}

export function scanForMaliciousScripts(
  content: string,
  filePath: string,
): SecurityFinding[] {
  return matchPatterns(
    content,
    filePath,
    SCRIPT_PATTERNS,
    "malicious_script",
    false,
  );
}

export function scanForDataExfiltration(
  content: string,
  filePath: string,
): SecurityFinding[] {
  const findings = matchPatterns(
    content,
    filePath,
    EXFIL_PATTERNS,
    "data_exfiltration",
    false,
  );
  findings.push(
    ...matchPatterns(
      content,
      filePath,
      DEPENDENCY_PATTERNS,
      "suspicious_dependency",
      false,
    ),
  );
  return findings;
}

export async function validateFileType(
  filePath: string,
): Promise<SecurityFinding | null> {
  const ext = extname(filePath).toLowerCase();

  // Check for executables regardless of extension
  let header: Buffer;
  try {
    const handle = await readFile(filePath);
    header = Buffer.from(handle.buffer, 0, Math.min(8, handle.length));
  } catch {
    return null;
  }

  // Check if file is an executable (always bad in a skill)
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (header.length >= sig.bytes.length) {
      const match = sig.bytes.every((b, i) => header[i] === b);
      if (match) {
        return {
          severity: "critical",
          category: "file_type_mismatch",
          file: filePath,
          pattern: `magic_bytes:${sig.name}`,
          description: `File is a ${sig.name} — executables must not be included in skills`,
        };
      }
    }
  }

  // Check if known binary extension matches its magic bytes
  const expected = MAGIC_BYTES[ext];
  if (expected && header.length >= expected.bytes.length) {
    const match = expected.bytes.every((b, i) => header[i] === b);
    if (!match) {
      return {
        severity: "high",
        category: "file_type_mismatch",
        file: filePath,
        pattern: `expected_${expected.name}_magic`,
        description: `File has ${ext} extension but does not match ${expected.name} magic bytes — possible disguised file`,
      };
    }
  }

  return null;
}

export function validateFrontmatter(
  content: string,
  filePath: string,
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Extract frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    findings.push({
      severity: "high",
      category: "frontmatter_invalid",
      file: filePath,
      pattern: "missing_frontmatter",
      description: "SKILL.md is missing YAML frontmatter (--- delimiters)",
    });
    return findings;
  }

  const fm = fmMatch[1]!;

  // Check name
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  if (!nameMatch) {
    findings.push({
      severity: "high",
      category: "frontmatter_invalid",
      file: filePath,
      pattern: "missing_name",
      description: "Frontmatter is missing required 'name' field",
    });
  } else {
    const name = nameMatch[1]!.trim();
    if (!NAME_PATTERN.test(name)) {
      findings.push({
        severity: "medium",
        category: "frontmatter_invalid",
        file: filePath,
        pattern: "invalid_name_pattern",
        description: `Name "${name}" does not match pattern: lowercase letters, digits, hyphens, starts with letter`,
      });
    }
    if (name.length > MAX_NAME_LENGTH) {
      findings.push({
        severity: "medium",
        category: "frontmatter_invalid",
        file: filePath,
        pattern: "name_too_long",
        description: `Name is ${name.length} chars (max ${MAX_NAME_LENGTH})`,
      });
    }
  }

  // Check description
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  if (!descMatch) {
    // Multi-line description with |
    const multiMatch = fm.match(
      /^description:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)/m,
    );
    if (!multiMatch) {
      findings.push({
        severity: "high",
        category: "frontmatter_invalid",
        file: filePath,
        pattern: "missing_description",
        description: "Frontmatter is missing required 'description' field",
      });
    }
  } else {
    const desc = descMatch[1]!.trim();
    if (desc.length > MAX_DESCRIPTION_LENGTH) {
      findings.push({
        severity: "low",
        category: "frontmatter_invalid",
        file: filePath,
        pattern: "description_too_long",
        description: `Description is ${desc.length} chars (max ${MAX_DESCRIPTION_LENGTH})`,
      });
    }
  }

  return findings;
}

export function checkContentSizes(files: FileInfo[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.sizeBytes;
    if (file.sizeBytes > MAX_FILE_BYTES_BLOCK) {
      findings.push({
        severity: "high",
        category: "content_size",
        file: file.relativePath,
        pattern: "file_too_large_block",
        description: `File is ${(file.sizeBytes / 1_048_576).toFixed(1)} MB (max ${MAX_FILE_BYTES_BLOCK / 1_048_576} MB)`,
      });
    } else if (file.sizeBytes > MAX_FILE_BYTES) {
      findings.push({
        severity: "medium",
        category: "content_size",
        file: file.relativePath,
        pattern: "file_too_large_warn",
        description: `File is ${(file.sizeBytes / 1_048_576).toFixed(1)} MB (recommended max ${MAX_FILE_BYTES / 1_048_576} MB)`,
      });
    }
  }

  if (totalBytes > MAX_DIR_BYTES_BLOCK) {
    findings.push({
      severity: "high",
      category: "content_size",
      file: ".",
      pattern: "dir_too_large_block",
      description: `Total skill size is ${(totalBytes / 1_048_576).toFixed(1)} MB (max ${MAX_DIR_BYTES_BLOCK / 1_048_576} MB)`,
    });
  } else if (totalBytes > MAX_DIR_BYTES) {
    findings.push({
      severity: "medium",
      category: "content_size",
      file: ".",
      pattern: "dir_too_large_warn",
      description: `Total skill size is ${(totalBytes / 1_048_576).toFixed(1)} MB (recommended max ${MAX_DIR_BYTES / 1_048_576} MB)`,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".py",
  ".sh",
  ".bash",
  ".js",
  ".ts",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".html",
  ".css",
  ".csv",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".r",
  ".sql",
  ".lua",
  ".pl",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
]);

export async function runSecurityScan(
  skillDir: string,
): Promise<SecurityReport> {
  const findings: SecurityFinding[] = [];

  // Verify directory exists
  try {
    await access(skillDir);
  } catch {
    return {
      skillDir,
      scannedAt: new Date().toISOString(),
      filesScanned: 0,
      verdict: "critical",
      findings: [
        {
          severity: "critical",
          category: "content_size",
          file: skillDir,
          pattern: "dir_not_found",
          description: `Skill directory not found: ${skillDir}`,
        },
      ],
      summary: { critical: 1, high: 0, medium: 0, low: 0 },
    };
  }

  // Collect all files
  const files = await collectFiles(skillDir, skillDir);

  // Check content sizes
  findings.push(...checkContentSizes(files));

  // Scan each file
  for (const file of files) {
    const ext = extname(file.path).toLowerCase();

    // File type validation for binary files
    if (BINARY_EXTENSIONS.has(ext) || !TEXT_EXTENSIONS.has(ext)) {
      const ftFinding = await validateFileType(file.path);
      if (ftFinding) {
        ftFinding.file = file.relativePath;
        findings.push(ftFinding);
      }
      continue;
    }

    // Read text content
    let content: string;
    try {
      content = await readFile(file.path, "utf-8");
    } catch {
      continue;
    }

    // Frontmatter check on SKILL.md
    if (basename(file.path) === "SKILL.md") {
      findings.push(...validateFrontmatter(content, file.relativePath));

      // Check line count
      const lineCount = content.split("\n").length;
      if (lineCount > MAX_SKILL_LINES) {
        findings.push({
          severity: "low",
          category: "content_size",
          file: file.relativePath,
          line: lineCount,
          pattern: "skill_md_too_long",
          description: `SKILL.md is ${lineCount} lines (recommended max ${MAX_SKILL_LINES})`,
        });
      }
    }

    // Prompt injection scan on markdown files
    if (ext === ".md") {
      findings.push(...scanForPromptInjection(content, file.relativePath));
    }

    // Script and exfiltration scan on code files
    const codeExtensions = new Set([
      ".py",
      ".sh",
      ".bash",
      ".js",
      ".ts",
      ".mjs",
      ".rb",
      ".pl",
    ]);
    if (codeExtensions.has(ext)) {
      findings.push(...scanForMaliciousScripts(content, file.relativePath));
      findings.push(...scanForDataExfiltration(content, file.relativePath));
    }

    // Also scan markdown for exfiltration (shell commands in instructions)
    if (ext === ".md") {
      findings.push(...scanForDataExfiltration(content, file.relativePath));
    }
  }

  // Compute summary
  const summary: Record<SecuritySeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of findings) {
    summary[f.severity]++;
  }

  // Determine verdict
  let verdict: SecuritySeverity | "pass" = "pass";
  if (summary.critical > 0) verdict = "critical";
  else if (summary.high > 0) verdict = "high";
  else if (summary.medium > 0) verdict = "medium";
  else if (summary.low > 0) verdict = "low";

  return {
    skillDir,
    scannedAt: new Date().toISOString(),
    filesScanned: files.length,
    verdict,
    findings,
    summary,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: npx tsx security-scan.ts <skill-directory>");
    console.error("Output: JSON SecurityReport to stdout");
    process.exit(1);
  }

  const skillDir = args[0]!;
  const report = await runSecurityScan(skillDir);
  console.log(JSON.stringify(report, null, 2));

  if (report.verdict === "critical") {
    process.exit(2);
  }
}

// Run only when executed directly (not when imported for testing)
const isDirectExecution = process.argv[1]?.endsWith("security-scan.ts");
if (isDirectExecution) {
  main().catch((err) => {
    console.error("Security scan failed:", err);
    process.exit(1);
  });
}
