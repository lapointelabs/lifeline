import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createReport, scan } from "../src/index.js";
import {
  createDeadlineReport,
  renderDeadlinesMarkdown,
  renderMarkdown,
  renderPretty,
  renderSarif,
} from "../src/render.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

async function riskyReport() {
  const result = await scan(path.join(fixtures, "risky"), { asOf: "2026-08-04" });
  return createReport(result, {
    generatedAt: "2026-08-04T00:00:00.000Z",
    targetLabel: ".",
  });
}

test("pretty output gives a concise migration handoff", async () => {
  const output = renderPretty(await riskyReport(), { color: false });
  assert.match(output, /LIFELINE \/ OpenAI deprecation scan/);
  assert.match(output, /OpenAI Assistants API/);
  assert.match(output, /shuts down in 22 days/);
  assert.match(output, /3 critical · 0 warning · 0 notice/);
  assert.doesNotMatch(output, /\u001B\[/);
});

test("Markdown includes integrity evidence and source locations", async () => {
  const output = renderMarkdown(await riskyReport());
  assert.match(output, /^# Lifeline deprecation report/);
  assert.match(output, /sha256:[a-f0-9]{64}/);
  assert.match(output, /src\/agent\.ts:6:/);
  assert.match(output, /Official source/);
});

test("SARIF output is valid and maps critical findings to errors", async () => {
  const sarif = JSON.parse(renderSarif(await riskyReport()));
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].results.length, 3);
  assert.ok(sarif.runs[0].results.every((result) => result.level === "error"));
  assert.equal(
    sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri,
    "src/agent.ts",
  );
});

test("deadline report includes non-detectable platform deadlines", () => {
  const report = createDeadlineReport("2026-08-04");
  const agentBuilder = report.deadlines.find(
    (deadline) => deadline.id === "openai-agent-builder",
  );
  assert.equal(agentBuilder.detectable, false);
  assert.match(renderDeadlinesMarkdown(report), /Known OpenAI shutdowns/);
});
