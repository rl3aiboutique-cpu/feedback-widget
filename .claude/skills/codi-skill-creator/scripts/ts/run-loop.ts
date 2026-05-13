#!/usr/bin/env npx tsx
/**
 * Run the eval + improve loop until all pass or max iterations reached.
 *
 * Combines run-eval.ts and improve-description.ts in a loop, tracking history
 * and returning the best description found. Supports train/test split to prevent
 * overfitting.
 *
 * Usage: npx tsx run-loop.ts --eval-set <path> --skill-path <path> --model <model> [options]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { parseSkillMd } from "./utils.js";
import {
  runEval,
  findProjectRoot,
  type EvalItem,
  type EvalOutput,
} from "./run-eval.js";
import { improveDescription } from "./improve-description.js";
import { generateReport } from "./generate-report.js";

interface HistoryEntry {
  iteration: number;
  description: string;
  train_passed: number;
  train_failed: number;
  train_total: number;
  train_results: EvalOutput["results"];
  test_passed: number | null;
  test_failed: number | null;
  test_total: number | null;
  test_results: EvalOutput["results"] | null;
  // Backward compat
  passed: number;
  failed: number;
  total: number;
  results: EvalOutput["results"];
}

function splitEvalSet(
  evalSet: EvalItem[],
  holdout: number,
  seed = 42,
): [EvalItem[], EvalItem[]] {
  // Simple seeded shuffle using Fisher-Yates with deterministic RNG
  const rng = createSeededRng(seed);
  const trigger = evalSet.filter((e) => e.should_trigger);
  const noTrigger = evalSet.filter((e) => !e.should_trigger);

  shuffle(trigger, rng);
  shuffle(noTrigger, rng);

  const nTriggerTest = Math.max(1, Math.floor(trigger.length * holdout));
  const nNoTriggerTest = Math.max(1, Math.floor(noTrigger.length * holdout));

  const testSet = [
    ...trigger.slice(0, nTriggerTest),
    ...noTrigger.slice(0, nNoTriggerTest),
  ];
  const trainSet = [
    ...trigger.slice(nTriggerTest),
    ...noTrigger.slice(nNoTriggerTest),
  ];

  return [trainSet, testSet];
}

function createSeededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

async function runLoop(opts: {
  evalSet: EvalItem[];
  skillPath: string;
  descriptionOverride?: string;
  numWorkers: number;
  timeout: number;
  maxIterations: number;
  runsPerQuery: number;
  triggerThreshold: number;
  holdout: number;
  model: string;
  verbose: boolean;
  liveReportPath?: string;
  logDir?: string;
}): Promise<Record<string, unknown>> {
  const projectRoot = findProjectRoot();
  const { name, description: origDesc, content } = parseSkillMd(opts.skillPath);
  let currentDescription = opts.descriptionOverride ?? origDesc;

  let trainSet: EvalItem[];
  let testSet: EvalItem[];
  if (opts.holdout > 0) {
    [trainSet, testSet] = splitEvalSet(opts.evalSet, opts.holdout);
    if (opts.verbose) {
      console.error(
        `Split: ${trainSet.length} train, ${testSet.length} test (holdout=${opts.holdout})`,
      );
    }
  } else {
    trainSet = opts.evalSet;
    testSet = [];
  }

  const history: HistoryEntry[] = [];
  let exitReason = "unknown";

  for (let iteration = 1; iteration <= opts.maxIterations; iteration++) {
    if (opts.verbose) {
      console.error(`\n${"=".repeat(60)}`);
      console.error(`Iteration ${iteration}/${opts.maxIterations}`);
      console.error(`Description: ${currentDescription}`);
      console.error("=".repeat(60));
    }

    const t0 = Date.now();
    const allQueries = [...trainSet, ...testSet];
    const allResults = await runEval(
      allQueries,
      name,
      currentDescription,
      opts.numWorkers,
      opts.timeout,
      projectRoot,
      opts.runsPerQuery,
      opts.triggerThreshold,
      opts.model,
    );
    const evalElapsed = (Date.now() - t0) / 1000;

    // Split results back into train/test
    const trainQuerySet = new Set(trainSet.map((q) => q.query));
    const trainResultList = allResults.results.filter((r) =>
      trainQuerySet.has(r.query),
    );
    const testResultList = allResults.results.filter(
      (r) => !trainQuerySet.has(r.query),
    );

    const trainPassed = trainResultList.filter((r) => r.pass).length;
    const trainTotal = trainResultList.length;
    const trainSummary = {
      passed: trainPassed,
      failed: trainTotal - trainPassed,
      total: trainTotal,
    };

    let testSummary: { passed: number; failed: number; total: number } | null =
      null;
    if (testSet.length > 0) {
      const testPassed = testResultList.filter((r) => r.pass).length;
      const testTotal = testResultList.length;
      testSummary = {
        passed: testPassed,
        failed: testTotal - testPassed,
        total: testTotal,
      };
    }

    history.push({
      iteration,
      description: currentDescription,
      train_passed: trainSummary.passed,
      train_failed: trainSummary.failed,
      train_total: trainSummary.total,
      train_results: trainResultList,
      test_passed: testSummary?.passed ?? null,
      test_failed: testSummary?.failed ?? null,
      test_total: testSummary?.total ?? null,
      test_results: testSet.length > 0 ? testResultList : null,
      passed: trainSummary.passed,
      failed: trainSummary.failed,
      total: trainSummary.total,
      results: trainResultList,
    });

    if (opts.verbose) {
      console.error(
        `Train: ${trainSummary.passed}/${trainSummary.total} (${evalElapsed.toFixed(1)}s)`,
      );
      for (const r of trainResultList) {
        const status = r.pass ? "PASS" : "FAIL";
        console.error(
          `  [${status}] rate=${r.triggers}/${r.runs} expected=${r.should_trigger}: ${r.query.slice(0, 60)}`,
        );
      }
      if (testSummary) {
        console.error(`Test:  ${testSummary.passed}/${testSummary.total}`);
        for (const r of testResultList) {
          const status = r.pass ? "PASS" : "FAIL";
          console.error(
            `  [${status}] rate=${r.triggers}/${r.runs} expected=${r.should_trigger}: ${r.query.slice(0, 60)}`,
          );
        }
      }
    }

    // Write live report
    if (opts.liveReportPath) {
      const partialOutput = {
        skill_name: name,
        original_description: origDesc,
        best_description: currentDescription,
        best_score: "in progress",
        iterations_run: history.length,
        holdout: opts.holdout,
        train_size: trainSet.length,
        test_size: testSet.length,
        history,
      };
      writeFileSync(
        opts.liveReportPath,
        generateReport(partialOutput as never),
        "utf-8",
      );
    }

    if (trainSummary.failed === 0) {
      exitReason = `all_passed (iteration ${iteration})`;
      if (opts.verbose)
        console.error(`\nAll train queries passed on iteration ${iteration}!`);
      break;
    }

    if (iteration === opts.maxIterations) {
      exitReason = `max_iterations (${opts.maxIterations})`;
      if (opts.verbose)
        console.error(`\nMax iterations reached (${opts.maxIterations}).`);
      break;
    }

    // Improve
    if (opts.verbose) console.error("\nImproving description...");
    const t1 = Date.now();

    const blindedHistory = history.map((h) => ({
      description: h.description,
      score: h.train_passed / h.train_total,
    }));

    const trainResults = {
      skill_name: name,
      description: currentDescription,
      results: trainResultList,
      summary: trainSummary,
    };

    const newDescription = improveDescription(
      name,
      content,
      currentDescription,
      trainResults,
      blindedHistory,
      opts.model,
      null,
      opts.logDir,
      iteration,
    );

    if (opts.verbose) {
      console.error(
        `Proposed (${((Date.now() - t1) / 1000).toFixed(1)}s): ${newDescription}`,
      );
    }

    currentDescription = newDescription;
  }

  // Find best iteration
  let best: HistoryEntry;
  if (testSet.length > 0) {
    best = history.reduce((a, b) =>
      (a.test_passed ?? 0) >= (b.test_passed ?? 0) ? a : b,
    );
  } else {
    best = history.reduce((a, b) => (a.train_passed >= b.train_passed ? a : b));
  }

  const bestScore =
    testSet.length > 0
      ? `${best.test_passed}/${best.test_total}`
      : `${best.train_passed}/${best.train_total}`;

  if (opts.verbose) {
    console.error(`\nExit reason: ${exitReason}`);
    console.error(`Best score: ${bestScore} (iteration ${best.iteration})`);
  }

  return {
    exit_reason: exitReason,
    original_description: origDesc,
    best_description: best.description,
    best_score: bestScore,
    best_train_score: `${best.train_passed}/${best.train_total}`,
    best_test_score:
      testSet.length > 0 ? `${best.test_passed}/${best.test_total}` : null,
    final_description: currentDescription,
    iterations_run: history.length,
    holdout: opts.holdout,
    train_size: trainSet.length,
    test_size: testSet.length,
    history,
  };
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("run-loop.ts");
if (isDirectExecution) {
  const { values } = parseArgs({
    options: {
      "eval-set": { type: "string" },
      "skill-path": { type: "string" },
      description: { type: "string" },
      "num-workers": { type: "string", default: "10" },
      timeout: { type: "string", default: "30" },
      "max-iterations": { type: "string", default: "5" },
      "runs-per-query": { type: "string", default: "3" },
      "trigger-threshold": { type: "string", default: "0.5" },
      holdout: { type: "string", default: "0.4" },
      model: { type: "string" },
      verbose: { type: "boolean", default: false },
      report: { type: "string", default: "auto" },
      "results-dir": { type: "string" },
    },
    strict: false,
  });

  const evalSetPath = values["eval-set"] as string | undefined;
  const skillPath = values["skill-path"] as string | undefined;
  const descriptionVal = values["description"] as string | undefined;
  const numWorkersVal = values["num-workers"] as string | undefined;
  const timeoutVal = values["timeout"] as string | undefined;
  const maxIterationsVal = values["max-iterations"] as string | undefined;
  const runsPerQueryVal = values["runs-per-query"] as string | undefined;
  const triggerThresholdVal = values["trigger-threshold"] as string | undefined;
  const holdoutVal = values["holdout"] as string | undefined;
  const modelVal = values["model"] as string | undefined;
  const verboseVal = Boolean(values["verbose"]);
  const reportVal = values["report"] as string | undefined;
  const resultsDirVal = values["results-dir"] as string | undefined;

  if (!evalSetPath || !skillPath || !modelVal) {
    console.error(
      "Usage: npx tsx run-loop.ts --eval-set <path> --skill-path <path> --model <model>",
    );
    process.exit(1);
  }

  const evalSet: EvalItem[] = JSON.parse(readFileSync(evalSetPath, "utf-8"));

  if (!existsSync(join(skillPath, "SKILL.md"))) {
    console.error(`Error: No SKILL.md found at ${skillPath}`);
    process.exit(1);
  }

  const { name } = parseSkillMd(skillPath);

  // Set up report path
  let liveReportPath: string | undefined;
  if (reportVal !== "none") {
    if (reportVal === "auto" || !reportVal) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      liveReportPath = join(
        tmpdir(),
        `skill_description_report_${name}_${ts}.html`,
      );
    } else {
      liveReportPath = reportVal;
    }
    writeFileSync(
      liveReportPath,
      "<html><body><h1>Starting optimization loop...</h1><meta http-equiv='refresh' content='5'></body></html>",
      "utf-8",
    );
    console.error(`Live report: ${liveReportPath}`);
  }

  let resultsDir: string | undefined;
  let logDir: string | undefined;
  if (resultsDirVal) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    resultsDir = join(resultsDirVal, ts);
    mkdirSync(resultsDir, { recursive: true });
    logDir = join(resultsDir, "logs");
    mkdirSync(logDir, { recursive: true });
  }

  const output = await runLoop({
    evalSet,
    skillPath,
    descriptionOverride: descriptionVal,
    numWorkers: parseInt(numWorkersVal ?? "10", 10),
    timeout: parseInt(timeoutVal ?? "30", 10),
    maxIterations: parseInt(maxIterationsVal ?? "5", 10),
    runsPerQuery: parseInt(runsPerQueryVal ?? "3", 10),
    triggerThreshold: parseFloat(triggerThresholdVal ?? "0.5"),
    holdout: parseFloat(holdoutVal ?? "0.4"),
    model: modelVal,
    verbose: verboseVal,
    liveReportPath,
    logDir,
  });

  const json = JSON.stringify(output, null, 2);
  console.log(json);

  if (resultsDir) {
    writeFileSync(join(resultsDir, "results.json"), json, "utf-8");
  }

  if (liveReportPath) {
    writeFileSync(liveReportPath, generateReport(output as never), "utf-8");
    console.error(`\nReport: ${liveReportPath}`);
  }

  if (resultsDir && liveReportPath) {
    writeFileSync(
      join(resultsDir, "report.html"),
      generateReport(output as never),
      "utf-8",
    );
    console.error(`Results saved to: ${resultsDir}`);
  }
}

export { runLoop, splitEvalSet };
