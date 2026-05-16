#!/usr/bin/env npx tsx
/**
 * Improve a skill description based on eval results.
 *
 * Takes eval results (from run-eval.ts) and generates an improved description
 * by calling `claude -p` as a subprocess (uses the session's auth).
 *
 * Usage: npx tsx improve-description.ts --skill-path <path> --eval-results <path> [options]
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseSkillMd } from "./utils.js";

function callClaude(prompt: string, model?: string, timeout = 300): string {
  const cmd = ["claude", "-p", "--output-format", "text"];
  if (model) cmd.push("--model", model);

  // Remove CLAUDECODE env var to allow nesting
  const env = { ...process.env };
  delete env["CLAUDECODE"];

  const result = execFileSync(cmd[0]!, cmd.slice(1), {
    input: prompt,
    encoding: "utf-8",
    env,
    timeout: timeout * 1000,
    maxBuffer: 10 * 1024 * 1024,
  });

  return result;
}

interface EvalResults {
  skill_name: string;
  description: string;
  results: Array<{
    query: string;
    should_trigger: boolean;
    trigger_rate: number;
    pass: boolean;
  }>;
  summary: { total: number; passed: number; failed: number };
}

interface HistoryEntry {
  description: string;
  score: number;
  feedback?: string;
}

export function improveDescription(
  skillName: string,
  skillContent: string,
  currentDescription: string,
  evalResults: EvalResults,
  history: HistoryEntry[],
  model?: string,
  testResults?: EvalResults | null,
  logDir?: string,
  iteration?: number,
): string {
  const failures = evalResults.results
    .filter((r) => !r.pass)
    .map((r) => {
      const expected = r.should_trigger ? "TRIGGER" : "NO TRIGGER";
      const actual = `rate=${(r.trigger_rate * 100).toFixed(0)}%`;
      return `  - "${r.query}" expected=${expected} ${actual}`;
    })
    .join("\n");

  const historyText =
    history.length > 0
      ? history
          .map(
            (h, i) =>
              `  v${i}: score=${h.score} "${h.description.slice(0, 80)}..."${h.feedback ? ` (feedback: ${h.feedback})` : ""}`,
          )
          .join("\n")
      : "  (no previous iterations)";

  const testSection = testResults
    ? `\n\nTest set results (held-out, DO NOT overfit to these):\n${testResults.results
        .map((r) => {
          const status = r.pass ? "PASS" : "FAIL";
          return `  [${status}] "${r.query}" should_trigger=${r.should_trigger} rate=${(r.trigger_rate * 100).toFixed(0)}%`;
        })
        .join("\n")}`
    : "";

  const prompt = `You are improving a skill description for "${skillName}".

The description determines when an AI coding assistant loads this skill. A good description:
1. Uses specific trigger keywords that match user queries
2. Claims territory aggressively ("Use when", "Also activate when")
3. Stays under 1024 characters
4. Does not trigger on unrelated queries

## Current Description
${currentDescription}

## Skill Content (for context)
${skillContent.slice(0, 2000)}

## Eval Results (train set)
Score: ${evalResults.summary.passed}/${evalResults.summary.total}

Failures:
${failures || "  (none)"}
${testSection}

## History
${historyText}

## Task
Write an improved description that fixes the failures while maintaining passes.
Output ONLY the new description text, nothing else. No markdown formatting, no quotes, no explanation.`;

  const improved = callClaude(prompt, model).trim();

  if (logDir && iteration !== undefined) {
    const logPath = join(logDir, `improve_v${iteration}.json`);
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          iteration,
          prompt_length: prompt.length,
          input_description: currentDescription,
          output_description: improved,
          eval_score: `${evalResults.summary.passed}/${evalResults.summary.total}`,
        },
        null,
        2,
      ),
      "utf-8",
    );
  }

  return improved;
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("improve-description.ts");
if (isDirectExecution) {
  const { values } = parseArgs({
    options: {
      "skill-path": { type: "string" },
      "eval-results": { type: "string" },
      history: { type: "string" },
      model: { type: "string" },
      "log-dir": { type: "string" },
      iteration: { type: "string" },
    },
    strict: false,
  });

  const skillPath = values["skill-path"] as string | undefined;
  const evalResultsPath = values["eval-results"] as string | undefined;
  const historyPath = values["history"] as string | undefined;
  const modelVal = values["model"] as string | undefined;
  const logDirVal = values["log-dir"] as string | undefined;
  const iterationVal = values["iteration"] as string | undefined;

  if (!skillPath || !evalResultsPath) {
    console.error(
      "Usage: npx tsx improve-description.ts --skill-path <path> --eval-results <path>",
    );
    process.exit(1);
  }

  const { name, description, content } = parseSkillMd(skillPath);
  const evalResults: EvalResults = JSON.parse(
    readFileSync(evalResultsPath, "utf-8"),
  );
  const history: HistoryEntry[] = historyPath
    ? JSON.parse(readFileSync(historyPath, "utf-8"))
    : [];

  const improved = improveDescription(
    name,
    content,
    description,
    evalResults,
    history,
    modelVal,
    null,
    logDirVal,
    iterationVal ? parseInt(iterationVal, 10) : undefined,
  );

  console.log(improved);
}
