import assert from "node:assert/strict";
import test from "node:test";

import { compileIgnorePatterns, isIgnored, isScannableFile } from "../src/ignore.js";

test("double-star globs match root and nested files", () => {
  const patterns = compileIgnorePatterns(["**/*.test.js"]);
  assert.equal(isIgnored("thing.test.js", "thing.test.js", patterns), true);
  assert.equal(isIgnored("src/thing.test.js", "thing.test.js", patterns), true);
});

test("later negated patterns can re-include a file", () => {
  const patterns = compileIgnorePatterns(["generated/**", "!generated/keep.js"]);
  assert.equal(isIgnored("generated/drop.js", "drop.js", patterns), true);
  assert.equal(isIgnored("generated/keep.js", "keep.js", patterns), false);
});

test("common AI source and notebook formats are scannable", () => {
  assert.equal(isScannableFile("analysis.ipynb"), true);
  assert.equal(isScannableFile("Client.swift"), true);
  assert.equal(isScannableFile("build.gradle"), true);
});
