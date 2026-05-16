#!/usr/bin/env npx tsx
/**
 * Skill Packager — Creates a distributable .skill file (ZIP) from a skill folder.
 *
 * Usage: npx tsx package-skill.ts <skill-directory> [output-directory]
 */

import {
  existsSync,
  statSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join, relative, resolve, basename, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { validateSkill } from "./quick-validate.js";

const EXCLUDE_DIRS = new Set(["__pycache__", "node_modules", ".git"]);
const EXCLUDE_GLOBS = new Set([".pyc"]);
const EXCLUDE_FILES = new Set([".DS_Store"]);
const ROOT_EXCLUDE_DIRS = new Set(["evals"]);

function shouldExclude(relPath: string, isRootLevel: boolean): boolean {
  const parts = relPath.split("/");
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  if (isRootLevel && parts.length > 0 && ROOT_EXCLUDE_DIRS.has(parts[0]!))
    return true;
  const name = basename(relPath);
  if (EXCLUDE_FILES.has(name)) return true;
  if (EXCLUDE_GLOBS.has(extname(name))) return true;
  return false;
}

function collectFiles(dir: string, root: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      files.push(...collectFiles(fullPath, root));
    } else {
      // isRootLevel: check if the first directory component should be excluded
      const firstDir = relPath.split("/")[0] ?? "";
      if (!shouldExclude(relPath, ROOT_EXCLUDE_DIRS.has(firstDir))) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function packageSkill(skillPath: string, outputDir?: string): string | null {
  const resolved = resolve(skillPath);

  if (!existsSync(resolved)) {
    console.error(`Error: Skill folder not found: ${resolved}`);
    return null;
  }
  if (!statSync(resolved).isDirectory()) {
    console.error(`Error: Path is not a directory: ${resolved}`);
    return null;
  }
  if (!existsSync(join(resolved, "SKILL.md"))) {
    console.error(`Error: SKILL.md not found in ${resolved}`);
    return null;
  }

  // Validate
  console.log("Validating skill...");
  const validation = validateSkill(resolved);
  if (!validation.valid) {
    console.error(`Validation failed: ${validation.message}`);
    return null;
  }
  console.log(`${validation.message}\n`);

  // Determine output
  const skillName = basename(resolved);
  const outDir = outputDir ? resolve(outputDir) : process.cwd();
  mkdirSync(outDir, { recursive: true });
  const zipPath = join(outDir, `${skillName}.skill`);

  // Collect files
  const files = collectFiles(resolved, resolve(resolved, ".."));

  // Create ZIP using system zip command
  try {
    const relFiles = files.map((f) => relative(resolve(resolved, ".."), f));
    for (const f of relFiles) {
      console.log(`  Added: ${f}`);
    }

    // Write file list to temp file for zip
    const listPath = join(outDir, `.${skillName}-filelist.tmp`);
    writeFileSync(listPath, relFiles.join("\n"), "utf-8");

    execFileSync("zip", [zipPath, "-@"], {
      cwd: resolve(resolved, ".."),
      input: relFiles.join("\n"),
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Cleanup temp
    try {
      unlinkSync(listPath);
    } catch {
      /* ignore */
    }

    console.log(`\nSuccessfully packaged skill to: ${zipPath}`);
    return zipPath;
  } catch (err) {
    console.error(
      `Error creating .skill file: ${err instanceof Error ? err.message : err}`,
    );
    return null;
  }
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("package-skill.ts");
if (isDirectExecution) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log(
      "Usage: npx tsx package-skill.ts <skill-directory> [output-directory]",
    );
    process.exit(1);
  }
  console.log(`Packaging skill: ${args[0]}`);
  const result = packageSkill(args[0]!, args[1]);
  process.exit(result ? 0 : 1);
}
