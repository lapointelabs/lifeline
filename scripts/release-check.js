import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const cacheDirectory = mkdtempSync(join(tmpdir(), "lifeline-npm-cache-"));

function run(args, extraEnvironment = {}) {
  const result = spawnSync(npm, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnvironment },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }

  return true;
}

try {
  const syntaxPassed = run(["run", "check"]);
  const testsPassed = syntaxPassed && run(["test"]);

  if (testsPassed) {
    run(["pack", "--dry-run", "--ignore-scripts"], {
      npm_config_cache: cacheDirectory,
    });
  }
} finally {
  rmSync(cacheDirectory, { recursive: true, force: true });
}
