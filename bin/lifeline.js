#!/usr/bin/env node

import { main } from "../src/cli.js";

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`lifeline: ${error.message}\n`);
  process.exitCode = 2;
}
