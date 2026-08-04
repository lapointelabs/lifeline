import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
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

test("file size parsing supports readable units", () => {
  assert.equal(parseSize("500kb"), 512000);
  assert.equal(parseSize("2mb"), 2097152);
  assert.equal(parseSize("128"), 128);
  assert.throws(() => parseSize("large"));
});
