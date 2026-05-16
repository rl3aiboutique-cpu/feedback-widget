#!/usr/bin/env npx tsx
/**
 * Run trigger evaluation for a skill description.
 *
 * Tests whether a skill's description causes the agent to trigger (read the skill)
 * for a set of queries. Outputs results as JSON.
 *
 * Usage: npx tsx run-eval.ts --eval-set <path> --skill-path <path> [options]
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { parseSkillMd } from "./utils.js";

function findProjectRoot(): string {
  let current = process.cwd();
  while (current !== "/") {
    if (existsSync(join(current, ".claude"))) return current;
    current = resolve(current, "..");
  }
  return process.cwd();
}

function runSingleQuery(
  query: string,
  skillName: string,
  skillDescription: string,
  timeout: number,
  projectRoot: string,
  model?: string,
): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const uniqueId = randomUUID().slice(0, 8);
    const cleanName = `${skillName}-skill-${uniqueId}`;
    const skillDir = join(projectRoot, ".claude", "skills", cleanName);
    const skillFile = join(skillDir, "SKILL.md");

    mkdirSync(skillDir, { recursive: true });

    const skillContent =
      `---\nname: ${cleanName}\ndescription: |\n  ${skillDescription.split("\n").join("\n  ")}\n---\n\n` +
      `# ${skillName}\n\nThis skill handles: ${skillDescription}\n`;
    writeFileSync(skillFile, skillContent, "utf-8");

    const cleanup = () => {
      try {
        unlinkSync(skillFile);
      } catch {
        /* ignore */
      }
      try {
        rmdirSync(skillDir);
      } catch {
        /* ignore */
      }
    };

    const cmd = [
      "claude",
      "-p",
      query,
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
    ];
    if (model) cmd.push("--model", model);

    // Remove CLAUDECODE env var to allow nesting
    const env = { ...process.env };
    delete env["CLAUDECODE"];

    const proc = spawn(cmd[0]!, cmd.slice(1), {
      cwd: projectRoot,
      env,
      stdio: ["ignore", "pipe", "ignore"],
    });

    let buffer = "";
    let pendingToolName: string | null = null;
    let accumulatedJson = "";
    const finish = (triggered: boolean) => {
      proc.kill();
      cleanup();
      resolvePromise(triggered);
    };

    const timer = setTimeout(() => finish(false), timeout * 1000);

    proc.stdout!.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");

      while (buffer.includes("\n")) {
        const idx = buffer.indexOf("\n");
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        if (event.type === "stream_event") {
          const se = event.event as Record<string, unknown> | undefined;
          if (!se) continue;
          const seType = se.type as string;

          if (seType === "content_block_start") {
            const cb = se.content_block as Record<string, unknown> | undefined;
            if (cb?.type === "tool_use") {
              const toolName = cb.name as string;
              if (toolName === "Skill" || toolName === "Read") {
                pendingToolName = toolName;
                accumulatedJson = "";
              } else {
                clearTimeout(timer);
                finish(false);
                return;
              }
            }
          } else if (seType === "content_block_delta" && pendingToolName) {
            const delta = se.delta as Record<string, unknown> | undefined;
            if (delta?.type === "input_json_delta") {
              accumulatedJson += (delta.partial_json as string) ?? "";
              if (accumulatedJson.includes(cleanName)) {
                clearTimeout(timer);
                finish(true);
                return;
              }
            }
          } else if (seType === "content_block_stop" || seType === "message_stop") {
            if (pendingToolName) {
              clearTimeout(timer);
              finish(accumulatedJson.includes(cleanName));
              return;
            }
            if (seType === "message_stop") {
              clearTimeout(timer);
              finish(false);
              return;
            }
          }
        } else if (event.type === "assistant") {
          const message = event.message as Record<string, unknown> | undefined;
          const contentItems = (message?.content ?? []) as Array<Record<string, unknown>>;
          for (const item of contentItems) {
            if (item.type !== "tool_use") continue;
            const toolName = item.name as string;
            const toolInput = item.input as Record<string, string> | undefined;
            if (toolName === "Skill" && toolInput?.skill?.includes(cleanName)) {
              clearTimeout(timer);
              finish(true);
              return;
            }
            if (toolName === "Read" && toolInput?.file_path?.includes(cleanName)) {
              clearTimeout(timer);
              finish(true);
              return;
            }
            clearTimeout(timer);
            finish(false);
            return;
          }
        } else if (event.type === "result") {
          clearTimeout(timer);
          finish(false);
          return;
        }
      }
    });

    proc.on("close", () => {
      clearTimeout(timer);
      cleanup();
      resolvePromise(false);
    });
  });
}

interface EvalItem {
  query: string;
  should_trigger: boolean;
}

interface EvalResult {
  query: string;
  should_trigger: boolean;
  trigger_rate: number;
  triggers: number;
  runs: number;
  pass: boolean;
}

interface EvalOutput {
  skill_name: string;
  description: string;
  results: EvalResult[];
  summary: { total: number; passed: number; failed: number };
}

async function runEval(
  evalSet: EvalItem[],
  skillName: string,
  description: string,
  numWorkers: number,
  timeout: number,
  projectRoot: string,
  runsPerQuery = 1,
  triggerThreshold = 0.5,
  model?: string,
): Promise<EvalOutput> {
  // Build all tasks
  const tasks: Array<{ item: EvalItem; runIdx: number }> = [];
  for (const item of evalSet) {
    for (let r = 0; r < runsPerQuery; r++) {
      tasks.push({ item, runIdx: r });
    }
  }

  // Run with concurrency limit
  const queryTriggers = new Map<string, boolean[]>();
  const queryItems = new Map<string, EvalItem>();

  const runBatch = async (batch: typeof tasks) => {
    const promises = batch.map(async ({ item }) => {
      const triggered = await runSingleQuery(
        item.query,
        skillName,
        description,
        timeout,
        projectRoot,
        model,
      );
      return { query: item.query, item, triggered };
    });
    return Promise.all(promises);
  };

  // Process in batches of numWorkers
  for (let i = 0; i < tasks.length; i += numWorkers) {
    const batch = tasks.slice(i, i + numWorkers);
    const results = await runBatch(batch);
    for (const { query, item, triggered } of results) {
      queryItems.set(query, item);
      const triggers = queryTriggers.get(query) ?? [];
      triggers.push(triggered);
      queryTriggers.set(query, triggers);
    }
  }

  // Compute results
  const results: EvalResult[] = [];
  for (const [query, triggers] of queryTriggers) {
    const item = queryItems.get(query)!;
    const triggerRate = triggers.filter(Boolean).length / triggers.length;
    const shouldTrigger = item.should_trigger;
    const didPass = shouldTrigger
      ? triggerRate >= triggerThreshold
      : triggerRate < triggerThreshold;

    results.push({
      query,
      should_trigger: shouldTrigger,
      trigger_rate: triggerRate,
      triggers: triggers.filter(Boolean).length,
      runs: triggers.length,
      pass: didPass,
    });
  }

  const passed = results.filter((r) => r.pass).length;
  return {
    skill_name: skillName,
    description,
    results,
    summary: { total: results.length, passed, failed: results.length - passed },
  };
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("run-eval.ts");
if (isDirectExecution) {
  const { values } = parseArgs({
    options: {
      "eval-set": { type: "string" },
      "skill-path": { type: "string" },
      description: { type: "string" },
      "num-workers": { type: "string", default: "10" },
      timeout: { type: "string", default: "30" },
      "runs-per-query": { type: "string", default: "3" },
      "trigger-threshold": { type: "string", default: "0.5" },
      model: { type: "string" },
      verbose: { type: "boolean", default: false },
    },
    strict: false,
  });

  const evalSetPath = values["eval-set"] as string | undefined;
  const skillPath = values["skill-path"] as string | undefined;
  const descriptionVal = values["description"] as string | undefined;
  const numWorkersVal = values["num-workers"] as string | undefined;
  const timeoutVal = values["timeout"] as string | undefined;
  const runsPerQueryVal = values["runs-per-query"] as string | undefined;
  const triggerThresholdVal = values["trigger-threshold"] as string | undefined;
  const modelVal = values["model"] as string | undefined;
  const verboseVal = values["verbose"] as boolean | undefined;

  if (!evalSetPath || !skillPath) {
    console.error("Usage: npx tsx run-eval.ts --eval-set <path> --skill-path <path>");
    process.exit(1);
  }

  const evalSet: EvalItem[] = JSON.parse(readFileSync(evalSetPath, "utf-8"));

  if (!existsSync(join(skillPath, "SKILL.md"))) {
    console.error(`Error: No SKILL.md found at ${skillPath}`);
    process.exit(1);
  }

  const { name, description: origDesc } = parseSkillMd(skillPath);
  const description = descriptionVal ?? origDesc;
  const projectRoot = findProjectRoot();

  if (verboseVal) {
    console.error(`Evaluating: ${description}`);
  }

  const output = await runEval(
    evalSet,
    name,
    description,
    parseInt(numWorkersVal ?? "10", 10),
    parseInt(timeoutVal ?? "30", 10),
    projectRoot,
    parseInt(runsPerQueryVal ?? "3", 10),
    parseFloat(triggerThresholdVal ?? "0.5"),
    modelVal,
  );

  if (verboseVal) {
    const { summary } = output;
    console.error(`Results: ${summary.passed}/${summary.total} passed`);
    for (const r of output.results) {
      const status = r.pass ? "PASS" : "FAIL";
      console.error(
        `  [${status}] rate=${r.triggers}/${r.runs} expected=${r.should_trigger}: ${r.query.slice(0, 70)}`,
      );
    }
  }

  console.log(JSON.stringify(output, null, 2));
}

export { runEval, runSingleQuery, findProjectRoot };
export type { EvalItem, EvalResult, EvalOutput };
