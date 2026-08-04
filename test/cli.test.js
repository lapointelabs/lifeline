import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { main, parseSize } from "../src/cli.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function capture(isTTY = false) {
  let value = "";
  return {
    isTTY,
    write(chunk) {
      value += chunk;
      return true;
    },
    read() {
      return value;
    },
  };
}

test("CLI emits JSON and fails on critical findings by default", async () => {
  const stdout = capture();
  const stderr = capture();
  const code = await main(
    ["scan", path.join(fixtures, "risky"), "--format", "json", "--as-of", "2026-08-04"],
    { stdout, stderr, cwd: process.cwd(), env: {} },
  );

  assert.equal(code, 1);
  assert.equal(stderr.read(), "");
  const report = JSON.parse(stdout.read());
  assert.equal(report.summary.critical, 3);
});

test("--fail-on never supports a non-blocking adoption scan", async () => {
  const stdout = capture();
  const code = await main(
    [path.join(fixtures, "risky"), "--fail-on", "never", "--as-of", "2026-08-04"],
    { stdout, stderr: capture(), cwd: process.cwd(), env: {} },
  );
  assert.equal(code, 0);
  assert.match(stdout.read(), /3 critical/);
});

test("CLI writes a complete report and prints only a receipt", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-output-"));
  const stdout = capture();
  const outputPath = path.join(directory, "report.md");
  const code = await main(
    [
      "scan",
      path.join(fixtures, "risky"),
      "--format",
      "markdown",
      "--output",
      outputPath,
      "--as-of",
      "2026-08-04",
    ],
    { stdout, stderr: capture(), cwd: process.cwd(), env: {} },
  );

  assert.equal(code, 1);
  assert.match(stdout.read(), /Wrote .*report\.md — 3 critical/);
  assert.match(await readFile(outputPath, "utf8"), /^# Lifeline deprecation report/);
});

test("deadlines JSON is machine-readable", async () => {
  const stdout = capture();
  const code = await main(
    ["deadlines", "--format", "json", "--as-of", "2026-08-04"],
    { stdout, stderr: capture(), cwd: process.cwd(), env: {} },
  );
  assert.equal(code, 0);
  const report = JSON.parse(stdout.read());
  assert.equal(report.schemaVersion, "lifeline.deadlines/v1");
  assert.ok(report.deadlines.some((deadline) => deadline.id === "openai-assistants-api"));
});

test("provider selection scopes scans and deadline reports", async () => {
  const target = path.join(fixtures, "multi-provider");
  const scanOutput = capture();
  const scanCode = await main(
    ["scan", target, "--provider", "anthropic", "--format", "json", "--as-of", "2026-08-04"],
    { stdout: scanOutput, stderr: capture(), cwd: process.cwd(), env: {} },
  );
  assert.equal(scanCode, 1);
  const scanReport = JSON.parse(scanOutput.read());
  assert.deepEqual(scanReport.summary.byProvider, { anthropic: 1 });

  const deadlineOutput = capture();
  const deadlineCode = await main(
    ["deadlines", "--provider", "google", "--format", "json", "--as-of", "2026-08-04"],
    { stdout: deadlineOutput, stderr: capture(), cwd: process.cwd(), env: {} },
  );
  assert.equal(deadlineCode, 0);
  const deadlines = JSON.parse(deadlineOutput.read());
  assert.deepEqual(deadlines.providers, ["google"]);
  assert.ok(deadlines.deadlines.every((deadline) => deadline.provider === "google"));
});

test("invalid options return a usage error without throwing", async () => {
  const stderr = capture();
  const code = await main(["scan", "--format", "xml"], {
    stdout: capture(),
    stderr,
    cwd: process.cwd(),
    env: {},
  });
  assert.equal(code, 2);
  assert.match(stderr.read(), /unsupported scan format: xml/);
});

test("invalid providers return a usage error", async () => {
  const stderr = capture();
  const code = await main(["scan", "--provider", "unknown"], {
    stdout: capture(),
    stderr,
    cwd: process.cwd(),
    env: {},
  });
  assert.equal(code, 2);
  assert.match(stderr.read(), /unsupported provider: unknown/);
});

test("incomplete coverage fails unless explicitly allowed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-cli-coverage-"));
  await writeFile(path.join(directory, "large.js"), "export const value = 'large file';\n", "utf8");

  const args = [
    "scan",
    directory,
    "--max-file-size",
    "10",
    "--fail-on",
    "never",
    "--format",
    "json",
    "--as-of",
    "2026-08-04",
  ];
  const failed = await main(args, {
    stdout: capture(),
    stderr: capture(),
    cwd: process.cwd(),
    env: {},
  });
  const allowed = await main([...args, "--allow-incomplete"], {
    stdout: capture(),
    stderr: capture(),
    cwd: process.cwd(),
    env: {},
  });

  assert.equal(failed, 2);
  assert.equal(allowed, 0);
});

test("the selected output file is excluded from the scan", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-cli-output-"));
  const outputPath = path.join(directory, "audit.json");
  await writeFile(path.join(directory, "clean.js"), "export const ok = true;\n", "utf8");
  await writeFile(outputPath, '{"oldModel":"gpt-5.3-chat-latest"}\n', "utf8");

  const code = await main(
    [
      "scan",
      directory,
      "--output",
      outputPath,
      "--format",
      "json",
      "--fail-on",
      "never",
      "--as-of",
      "2026-08-04",
    ],
    { stdout: capture(), stderr: capture(), cwd: process.cwd(), env: {} },
  );

  assert.equal(code, 0);
  const report = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(report.summary.total, 0);
  assert.deepEqual(report.scan.configuration.excludedPaths, ["audit.json"]);
});

test("output cannot overwrite a single-file scan target", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lifeline-cli-overwrite-"));
  const target = path.join(directory, "source.js");
  await writeFile(target, "export const ok = true;\n", "utf8");
  const stderr = capture();

  const code = await main(["scan", target, "--output", target], {
    stdout: capture(),
    stderr,
    cwd: process.cwd(),
    env: {},
  });

  assert.equal(code, 2);
  assert.match(stderr.read(), /cannot overwrite the scan target/);
  assert.equal(await readFile(target, "utf8"), "export const ok = true;\n");
});

test("file size parsing supports readable units", () => {
  assert.equal(parseSize("500kb"), 512000);
  assert.equal(parseSize("2mb"), 2097152);
  assert.equal(parseSize("128"), 128);
  assert.throws(() => parseSize("large"));
});
