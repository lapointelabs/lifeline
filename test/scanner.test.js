import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyDeadline,
  createReport,
  scan,
  verifyReportIntegrity,
} from "../src/index.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("scan finds urgent API and model usage with exact locations", async () => {
  const result = await scan(path.join(fixtures, "risky"), { asOf: "2026-08-04" });

  assert.equal(result.findings.length, 3);
  assert.deepEqual(
    result.findings.map((finding) => finding.ruleId),
    [
      "openai-model-gpt-5-3-chat-latest",
      "openai-assistants-api",
      "openai-assistants-api",
    ],
  );
  assert.ok(result.findings.every((finding) => finding.severity === "critical"));
  assert.ok(result.findings.every((finding) => finding.location.path === "src/agent.ts"));
  assert.equal(result.findings[0].daysRemaining, 6);
  assert.equal(result.findings[1].daysRemaining, 22);
});

test("scan skips docs by default and can include them explicitly", async () => {
  const withoutDocs = await scan(path.join(fixtures, "risky"), {
    asOf: "2026-08-04",
  });
  const withDocs = await scan(path.join(fixtures, "risky"), {
    asOf: "2026-08-04",
    includeDocs: true,
  });

  assert.equal(withoutDocs.findings.length, 3);
  assert.equal(withDocs.findings.length, 4);
  assert.ok(withDocs.findings.some((finding) => finding.location.path === "docs/legacy.md"));
});

test("scan respects .lifelineignore and default generated/dependency ignores", async () => {
  const result = await scan(path.join(fixtures, "risky"), { asOf: "2026-08-04" });
  const paths = new Set(result.findings.map((finding) => finding.location.path));

  assert.equal(paths.has("ignored/generated.js"), false);
  assert.equal(paths.has("node_modules/example/index.js"), false);
  assert.equal(paths.has(".open-next/generated.js"), false);
});

test("model matching does not report a shorter alias inside a snapshot", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-boundary-"));
  await writeFile(
    path.join(directory, "model.js"),
    'const model = "gpt-4-0613";\n',
    "utf8",
  );

  const result = await scan(directory, { asOf: "2026-08-04" });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].ruleId, "openai-model-gpt-4-0613");
});

test("a clean Responses API project produces no findings", async () => {
  const result = await scan(path.join(fixtures, "clean"), { asOf: "2026-08-04" });
  assert.equal(result.findings.length, 0);
});

test("scan detects multiple providers and supports provider filtering", async () => {
  const target = path.join(fixtures, "multi-provider");
  const result = await scan(target, { asOf: "2026-08-04" });

  assert.deepEqual(
    result.findings.map((finding) => finding.provider).sort(),
    ["anthropic", "google", "openai"],
  );
  assert.ok(result.findings.every((finding) => /^[a-f0-9]{64}$/.test(finding.fingerprint)));
  assert.equal(
    result.findings.some((finding) => finding.match === "imagen-4.0-generate-001"),
    false,
  );

  const anthropicOnly = await scan(target, {
    asOf: "2026-08-04",
    providers: ["anthropic"],
  });
  assert.equal(anthropicOnly.findings.length, 1);
  assert.equal(anthropicOnly.findings[0].ruleId, "anthropic-model-claude-opus-4-1-20250805");
});

test("oversized eligible files make scan coverage incomplete", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-coverage-"));
  await writeFile(path.join(directory, "large.js"), "export const value = 'large file';\n", "utf8");

  const result = await scan(directory, { asOf: "2026-08-04", maxFileSize: 10 });
  assert.equal(result.coverage.complete, false);
  assert.equal(result.coverage.issues.length, 1);
  assert.equal(result.coverage.issues[0].path, "large.js");
  assert.equal(result.coverage.issues[0].reason, "too_large");
  assert.ok(result.coverage.issues[0].size > 10);
  assert.equal(result.coverage.issues[0].maxFileSize, 10);
  assert.equal(result.coverage.skippedByReason.tooLarge, 1);
});

test("evidence digests are stable across generation times and verifiable", async () => {
  const result = await scan(path.join(fixtures, "risky"), { asOf: "2026-08-04" });
  const first = createReport(result, { generatedAt: "2026-08-04T01:00:00.000Z" });
  const second = createReport(result, { generatedAt: "2026-08-04T02:00:00.000Z" });

  assert.equal(first.integrity.digest, second.integrity.digest);
  assert.equal(verifyReportIntegrity(first), true);
  first.findings[0].replacement = "tampered";
  assert.equal(verifyReportIntegrity(first), false);
});

test("evidence digest covers migration guidance and official sources", async () => {
  const result = await scan(path.join(fixtures, "risky"), { asOf: "2026-08-04" });
  const guidanceReport = createReport(result);
  guidanceReport.findings[0].guidance = "tampered";
  assert.equal(verifyReportIntegrity(guidanceReport), false);

  const sourceReport = createReport(result);
  sourceReport.findings[0].sourceUrl = "https://example.invalid";
  assert.equal(verifyReportIntegrity(sourceReport), false);
});

test("evidence digest is bound to scanned source contents", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-evidence-"));
  const source = path.join(directory, "model.js");
  await writeFile(source, 'export const model = "gpt-5.6-sol";\n', "utf8");
  const first = createReport(await scan(directory, { asOf: "2026-08-04" }));

  await writeFile(source, 'export const model = "gpt-5.6-terra";\n', "utf8");
  const second = createReport(await scan(directory, { asOf: "2026-08-04" }));

  assert.equal(first.summary.total, 0);
  assert.equal(second.summary.total, 0);
  assert.notEqual(first.integrity.digest, second.integrity.digest);
});

test("deadline severity has deterministic date boundaries", () => {
  assert.deepEqual(classifyDeadline("2026-08-04", "2026-08-04"), {
    daysRemaining: 0,
    severity: "critical",
    status: "urgent",
  });
  assert.equal(classifyDeadline("2026-09-03", "2026-08-04").severity, "critical");
  assert.equal(classifyDeadline("2026-09-04", "2026-08-04").severity, "warning");
  assert.equal(classifyDeadline("2026-11-03", "2026-08-04").severity, "notice");
  assert.equal(classifyDeadline("2026-08-03", "2026-08-04").status, "expired");
});
