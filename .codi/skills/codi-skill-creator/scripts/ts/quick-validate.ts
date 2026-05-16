#!/usr/bin/env npx tsx
/**
 * Quick validation script for skills — minimal version.
 *
 * Usage: npx tsx quick-validate.ts <skill-directory>
 * Exit: 0 = valid, 1 = invalid
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ValidationResult {
  valid: boolean;
  message: string;
}

const ALLOWED_PROPERTIES = new Set([
  "name",
  "description",
  "version",
  "type",
  "license",
  "tools",
  "hooks",
  "allowed-tools",
  "allowedTools",
  "metadata",
  "compatibility",
  "managed_by",
  "category",
  "disable-model-invocation",
  "disableModelInvocation",
  "user-invocable",
  "argument-hint",
  "argumentHint",
  "model",
  "effort",
  "context",
  "agent",
  "paths",
  "shell",
]);

export function validateSkill(skillPath: string): ValidationResult {
  const skillMd = join(skillPath, "SKILL.md");

  if (!existsSync(skillMd)) {
    return { valid: false, message: "SKILL.md not found" };
  }

  const content = readFileSync(skillMd, "utf-8");
  if (!content.startsWith("---")) {
    return { valid: false, message: "No YAML frontmatter found" };
  }

  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { valid: false, message: "Invalid frontmatter format" };
  }

  const fmText = match[1]!;

  // Simple YAML key extraction (no full YAML parser dependency)
  const keys = new Map<string, string>();
  for (const line of fmText.split("\n")) {
    const kvMatch = line.match(/^([a-z_-]+):\s*(.*)/);
    if (kvMatch) {
      keys.set(kvMatch[1]!, kvMatch[2]!.trim());
    }
  }

  // Check for unexpected properties
  for (const key of keys.keys()) {
    if (!ALLOWED_PROPERTIES.has(key) && !key.startsWith("metadata")) {
      return {
        valid: false,
        message: `Unexpected key in frontmatter: ${key}. Allowed: ${[...ALLOWED_PROPERTIES].sort().join(", ")}`,
      };
    }
  }

  // Check required fields
  if (!keys.has("name")) {
    return { valid: false, message: "Missing 'name' in frontmatter" };
  }
  if (!keys.has("description")) {
    return { valid: false, message: "Missing 'description' in frontmatter" };
  }

  const name = keys.get("name")!.replace(/^["']|["']$/g, "");
  if (name && !/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, message: `Name '${name}' should be kebab-case` };
  }
  if (name && (name.startsWith("-") || name.endsWith("-") || name.includes("--"))) {
    return {
      valid: false,
      message: `Name '${name}' cannot start/end with hyphen or contain consecutive hyphens`,
    };
  }
  if (name && name.length > 64) {
    return {
      valid: false,
      message: `Name is too long (${name.length} characters). Maximum is 64.`,
    };
  }

  const desc = keys.get("description")!.replace(/^["']|["']$/g, "");
  if (desc && (desc.includes("<") || desc.includes(">"))) {
    return {
      valid: false,
      message: "Description cannot contain angle brackets",
    };
  }
  if (desc && desc.length > 1024) {
    return {
      valid: false,
      message: `Description is too long (${desc.length} characters). Maximum is 1024.`,
    };
  }

  // Validate category value against the centralized registry.
  // Kept in sync with ALL_SKILL_CATEGORIES in src/constants.ts.
  const VALID_CATEGORIES = [
    "Brand Identity",
    "Code Quality",
    "Content Creation",
    "Content Refinement",
    "Creative and Design",
    "Developer Tools",
    "Developer Workflow",
    "Document Generation",
    "File Format Tools",
    "Planning",
    "Productivity",
    "Testing",
    "Workflow",
    "Codi Platform",
  ];
  const category = keys.get("category")?.replace(/^["']|["']$/g, "");
  if (category && !VALID_CATEGORIES.includes(category)) {
    return {
      valid: false,
      message: `Category '${category}' is not recognized. Valid categories: ${VALID_CATEGORIES.join(", ")}`,
    };
  }

  return { valid: true, message: "Skill is valid!" };
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("quick-validate.ts");
if (isDirectExecution) {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: npx tsx quick-validate.ts <skill-directory>");
    process.exit(1);
  }
  const result = validateSkill(args[0]!);
  console.log(result.message);
  process.exit(result.valid ? 0 : 1);
}
