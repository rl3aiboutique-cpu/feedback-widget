/**
 * Shared utilities for skill-creator scripts.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface SkillMeta {
  name: string;
  description: string;
  content: string;
}

/**
 * Parse a SKILL.md file, returning name, description, and full content.
 */
export function parseSkillMd(skillDir: string): SkillMeta {
  const filePath = join(skillDir, "SKILL.md");
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new Error("SKILL.md missing frontmatter (no opening ---)");
  }

  let endIdx: number | undefined;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === undefined) {
    throw new Error("SKILL.md missing frontmatter (no closing ---)");
  }

  let name = "";
  let description = "";
  const fmLines = lines.slice(1, endIdx);

  let i = 0;
  while (i < fmLines.length) {
    const line = fmLines[i]!;
    if (line.startsWith("name:")) {
      name = line
        .slice("name:".length)
        .trim()
        .replace(/^["']|["']$/g, "");
    } else if (line.startsWith("description:")) {
      const value = line.slice("description:".length).trim();
      // Handle YAML multiline indicators (>, |, >-, |-)
      if ([">", "|", ">-", "|-"].includes(value)) {
        const continuationLines: string[] = [];
        i++;
        while (i < fmLines.length && /^[\s\t]/.test(fmLines[i]!)) {
          continuationLines.push(fmLines[i]!.trim());
          i++;
        }
        description = continuationLines.join(" ");
        continue;
      } else {
        description = value.replace(/^["']|["']$/g, "");
      }
    }
    i++;
  }

  return { name, description, content };
}
