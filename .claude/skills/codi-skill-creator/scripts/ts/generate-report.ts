#!/usr/bin/env npx tsx
/**
 * Generate an HTML report from eval/run-loop results.
 *
 * Usage: npx tsx generate-report.ts --input <results.json> --output <report.html>
 */

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

interface QueryResult {
  query: string;
  should_trigger: boolean;
  trigger_rate: number;
  triggers: number;
  runs: number;
  pass: boolean;
  set?: "train" | "test";
}

interface EvalResults {
  skill_name: string;
  description: string;
  results: QueryResult[];
  summary: { total: number; passed: number; failed: number };
}

interface LoopResults {
  skill_name: string;
  iterations: Array<{
    version: string;
    description: string;
    train_results: EvalResults;
    test_results?: EvalResults;
  }>;
  best_version: string;
  best_description: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderQueryRow(r: QueryResult, setLabel?: string): string {
  const status = r.pass ? "PASS" : "FAIL";
  const statusColor = r.pass ? "#22c55e" : "#ef4444";
  const expected = r.should_trigger ? "trigger" : "no-trigger";
  const rate = `${r.triggers}/${r.runs}`;
  const setTag = setLabel
    ? `<span style="color:#888;font-size:0.8em">[${setLabel}]</span> `
    : "";
  return `<tr>
    <td><span style="color:${statusColor};font-weight:bold">${status}</span></td>
    <td>${setTag}${escapeHtml(r.query.slice(0, 80))}</td>
    <td>${expected}</td>
    <td>${rate} (${(r.trigger_rate * 100).toFixed(0)}%)</td>
  </tr>`;
}

export function generateReport(data: EvalResults | LoopResults): string {
  const isLoop = "iterations" in data;
  const skillName = data.skill_name;

  let body = "";

  if (isLoop) {
    const loop = data as LoopResults;
    body += `<h2>Best: ${escapeHtml(loop.best_version)}</h2>`;
    body += `<p><strong>Description:</strong> ${escapeHtml(loop.best_description.slice(0, 200))}</p>`;

    for (const iter of loop.iterations) {
      const trainSummary = iter.train_results.summary;
      const testSummary = iter.test_results?.summary;
      body += `<h3>${escapeHtml(iter.version)}</h3>`;
      body += `<p>Train: ${trainSummary.passed}/${trainSummary.total}`;
      if (testSummary)
        body += ` | Test: ${testSummary.passed}/${testSummary.total}`;
      body += `</p>`;
      body += `<p style="color:#666;font-size:0.9em">${escapeHtml(iter.description.slice(0, 150))}...</p>`;
      body += `<table><tr><th>Status</th><th>Query</th><th>Expected</th><th>Rate</th></tr>`;
      for (const r of iter.train_results.results) {
        body += renderQueryRow(r, "train");
      }
      if (iter.test_results) {
        for (const r of iter.test_results.results) {
          body += renderQueryRow(r, "test");
        }
      }
      body += `</table>`;
    }
  } else {
    const eval_ = data as EvalResults;
    const summary = eval_.summary;
    body += `<h2>Score: ${summary.passed}/${summary.total}</h2>`;
    body += `<p><strong>Description:</strong> ${escapeHtml(eval_.description.slice(0, 200))}</p>`;
    body += `<table><tr><th>Status</th><th>Query</th><th>Expected</th><th>Rate</th></tr>`;
    for (const r of eval_.results) {
      body += renderQueryRow(r);
    }
    body += `</table>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Eval Report: ${escapeHtml(skillName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { border-bottom: 2px solid #e5e5e5; padding-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f5; font-weight: 600; }
    h3 { margin-top: 2rem; color: #333; }
  </style>
</head>
<body>
  <h1>Eval Report: ${escapeHtml(skillName)}</h1>
  ${body}
  <footer style="margin-top:2rem;color:#999;font-size:0.8em">Generated ${new Date().toISOString()}</footer>
</body>
</html>`;
}

// CLI entry point
const isDirectExecution = process.argv[1]?.endsWith("generate-report.ts");
if (isDirectExecution) {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
    },
    strict: false,
  });

  const inputPath = values.input as string | undefined;
  const outputPath = values.output as string | undefined;

  if (!inputPath || !outputPath) {
    console.error(
      "Usage: npx tsx generate-report.ts --input <results.json> --output <report.html>",
    );
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(inputPath, "utf-8"));
  const html = generateReport(data);
  writeFileSync(outputPath, html, "utf-8");
  console.log(`Report written to ${outputPath}`);
}
