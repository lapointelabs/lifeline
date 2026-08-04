import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const cacheDirectory = mkdtempSync(join(tmpdir(), "lifeline-npm-cache-"));
const packageDirectory = mkdtempSync(join(tmpdir(), "lifeline-package-"));
const installDirectory = mkdtempSync(join(tmpdir(), "lifeline-install-"));

function run(args, extraEnvironment = {}, cwd = process.cwd()) {
  const result = spawnSync(npm, args, {
    stdio: "inherit",
    cwd,
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
    const packed = run(["pack", "--ignore-scripts", "--pack-destination", packageDirectory], {
      npm_config_cache: cacheDirectory,
    });
    const tarball = packed
      ? readdirSync(packageDirectory).find((entry) => entry.endsWith(".tgz"))
      : undefined;
    if (!tarball) throw new Error("npm pack did not create a tarball");

    const installed = run(
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        join(packageDirectory, tarball),
      ],
      { npm_config_cache: cacheDirectory },
      installDirectory,
    );
    if (installed) {
      const cli = join(
        installDirectory,
        "node_modules",
        "@lapointelabs",
        "lifeline",
        "bin",
        "lifeline.js",
      );
      const smoke = spawnSync(process.execPath, [cli, "--version"], {
        cwd: installDirectory,
        stdio: "inherit",
      });
      if (smoke.error) throw smoke.error;
      if (smoke.status !== 0) process.exitCode = smoke.status ?? 1;
    }
  }
} finally {
  rmSync(cacheDirectory, { recursive: true, force: true });
  rmSync(packageDirectory, { recursive: true, force: true });
  rmSync(installDirectory, { recursive: true, force: true });
}
