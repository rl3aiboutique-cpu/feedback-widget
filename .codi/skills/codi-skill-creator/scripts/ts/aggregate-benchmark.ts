#!/usr/bin/env npx tsx
/**
 * Aggregate benchmark results into statistical summaries.
 *
 * Reads multiple eval run result files and computes mean, stddev, min, max
 * for each metric.
 *
 * Usage: npx tsx aggregate-benchmark.ts --results-dir <dir> [--output <file>]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

interface EvalResults {
  skill_name: string;
  description: string;
  results: Array<{
    query: string;
    should_trigger: boolean;
    trigger_rate: number;
    triggers: number;
    runs: number;
    pass: boolean;
  }>;
  summary: { total: number; passed: number; failed: number };
}

interface Stats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
  count: number;
}

interface AggregateOutput {
  skill_name: string;
  num_runs: number;
  pass_rate: Stats;
  trigger_accuracy: Stats;
  per_query: Record<string, { trigger_rate: Stats; pass_rate: Stats }>;
}

function computeStats(values: number[]): Stats {
  if (values.length === 0) {
    return { mean: 0, stddev: 0, min: 0, max: 0, count: 0 };
  }
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return {
    mean: Math.round(mean * 10000) / 10000,
    stddev: Math.round(Math.sqrt(variance) * 10000) / 10000,
    min: Math.min(...values),
    max: Math.max(...values),
    count: n,
  };
}

export function aggregateBenchmarks(
  resultsDir: string,
): AggregateOutput | null {
  const files = readdirSync(resultsDir).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.error("No JSON result files found in", resultsDir);
    return null;
  }

  const allResults: EvalResults[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(resultsDir, file), "utf-8"));
      if (data.summary && data.results) {
        allResults.push(data);
      }
    } catch {
      console.error(`Skipping invalid file: ${file}`);
    }
  }

  if (allResults.length === 0) {
    console.error("No valid eval results found");
    return null;
  }

  const skillName = allResults[0]!.skill_name;

  // Aggregate pass rates
  const passRates = allResults.map((r) => r.summary.passed / r.summary.total);

  // Aggregate per-query trigger rates
  const queryTriggerRates = new Map<string, number[]>();
  const queryPassRates = new Map<string, number[]>();

  for (const run of allResults) {
    for (const qr of run.results) {
      const key = qr.query;
      if (!queryTriggerRates.has(key)) {
        queryTriggerRates.set(key, []);
        queryPassRates.set(key, []);
      }
      queryTriggerRates.get(key)!.push(qr.trigger_rate);
      queryPassRates.get(key)!.push(qr.pass ? 1 : 0);
    }
  }

  // Compute trigger accuracy (percentage of queries that correctly triggered/didn't)
  const triggerAccuracies = allResults.map((r) => {
    const correct = r.results.filter((qr) => {
      if (qr.should_trigger) return qr.trigger_rate >= 0.5;
      return qr.trigger_rate < 0.5;
    }).length;
    return correct / r.results.length;
  });

  const perQuery: Record<string, { trigger_rate: Stats; pass_rate: Stats }> =
    {};
  for (const [query, rates] of queryTriggerRates) {
    perQuery[query] = {
      trigger_rate: computeStats(rates),
      pass_rate: computeStats(queryPassRates.get(query)!),
    };
  }

  return {
    skill_name: skillName,
    num_runs: allResults.length,
    pass_rate: computeStats(passRates),
    trigger_accuracy: computeStats(triggerAccuracies),
    per_query: perQuery,
  };
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("aggregate-benchmark.ts");
if (isDirectExecution) {
  const { values } = parseArgs({
    options: {
      "results-dir": { type: "string" },
      output: { type: "string" },
    },
    strict: false,
  });

  const resultsDir = values["results-dir"] as string | undefined;
  const outputPath = values.output as string | undefined;

  if (!resultsDir) {
    console.error(
      "Usage: npx tsx aggregate-benchmark.ts --results-dir <dir> [--output <file>]",
    );
    process.exit(1);
  }

  const result = aggregateBenchmarks(resultsDir);
  if (!result) process.exit(1);

  const json = JSON.stringify(result, null, 2);
  if (outputPath) {
    writeFileSync(outputPath, json, "utf-8");
    console.log(`Aggregate written to ${outputPath}`);
  } else {
    console.log(json);
  }
}
