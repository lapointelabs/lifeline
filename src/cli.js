import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { meetsThreshold, parseDateOnly, todayUtc } from "./deadlines.js";
import { createReport } from "./report.js";
import {
  createDeadlineReport,
  renderDeadlinesMarkdown,
  renderDeadlinesPretty,
  renderJson,
  renderReport,
} from "./render.js";
import { scan } from "./scanner.js";
import { VERSION } from "./version.js";

const SCAN_FORMATS = new Set(["pretty", "json", "markdown", "sarif"]);
const DEADLINE_FORMATS = new Set(["pretty", "json", "markdown"]);
const THRESHOLDS = new Set(["critical", "warning", "notice", "never"]);

class UsageError extends Error {}

const HELP = `Lifeline ${VERSION} — find AI dependencies that will break before production does.

Usage:
  lifeline scan [path] [options]
  lifeline deadlines [options]
  lifeline [path] [options]

Scan options:
  -f, --format <format>       pretty, json, markdown, or sarif
  -o, --output <file>         write the full report to a file
      --fail-on <severity>    critical, warning, notice, or never
      --as-of <YYYY-MM-DD>    evaluate deadlines from a fixed date
      --include-docs          scan Markdown and other prose files
      --ignore <glob>         add an ignore pattern; may be repeated
      --max-file-size <size>  maximum text file size (default: 1mb)
      --no-color              disable ANSI colors
  -q, --quiet                 suppress the summary when using --output

Deadline options:
  -f, --format <format>       pretty, json, or markdown
      --as-of <YYYY-MM-DD>    evaluate deadlines from a fixed date
      --all                   include deadlines that have already passed

Global options:
  -h, --help                  show this help
  -v, --version               print the version

Examples:
  lifeline scan .
  lifeline scan . --format markdown --output lifeline-report.md
  lifeline scan . --format sarif --output lifeline.sarif
  lifeline deadlines --as-of 2026-08-04
`;

function optionValue(args, index, name) {
  const argument = args[index];
  const equals = argument.indexOf("=");
  if (equals !== -1) return { value: argument.slice(equals + 1), consumed: 0 };
  if (index + 1 >= args.length || args[index + 1].startsWith("-")) {
    throw new UsageError(`${name} requires a value`);
  }
  return { value: args[index + 1], consumed: 1 };
}

function parseSize(value) {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i.exec(value);
  if (!match) throw new UsageError("--max-file-size must look like 500kb, 2mb, or bytes");
  const amount = Number(match[1]);
  const multiplier =
    match[2]?.toLowerCase() === "mb" ? 1024 * 1024 : match[2]?.toLowerCase() === "kb" ? 1024 : 1;
  const bytes = Math.floor(amount * multiplier);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new UsageError("--max-file-size must be greater than zero");
  }
  return bytes;
}

function parseArgs(args) {
  if (args.includes("--version") || args.includes("-v")) return { action: "version" };

  let command = "scan";
  let index = 0;
  if (args[0] === "scan" || args[0] === "deadlines") {
    command = args[0];
    index = 1;
  } else if (args[0] === "help") {
    return { action: "help" };
  }

  const options = {
    action: command,
    target: ".",
    format: "pretty",
    failOn: "critical",
    asOf: todayUtc(),
    includeDocs: false,
    ignore: [],
    color: true,
    quiet: false,
    includePast: false,
  };
  let targetSet = false;

  for (; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { action: "help" };
    if (argument === "--include-docs") {
      options.includeDocs = true;
      continue;
    }
    if (argument === "--no-color") {
      options.color = false;
      continue;
    }
    if (argument === "--quiet" || argument === "-q") {
      options.quiet = true;
      continue;
    }
    if (argument === "--all") {
      options.includePast = true;
      continue;
    }

    const longName = argument.split("=", 1)[0];
    if (["--format", "-f"].includes(longName)) {
      const result = optionValue(args, index, "--format");
      options.format = result.value.toLowerCase();
      index += result.consumed;
      continue;
    }
    if (["--output", "-o"].includes(longName)) {
      const result = optionValue(args, index, "--output");
      options.output = result.value;
      index += result.consumed;
      continue;
    }
    if (longName === "--fail-on") {
      const result = optionValue(args, index, "--fail-on");
      options.failOn = result.value.toLowerCase();
      index += result.consumed;
      continue;
    }
    if (longName === "--as-of") {
      const result = optionValue(args, index, "--as-of");
      options.asOf = result.value;
      index += result.consumed;
      continue;
    }
    if (longName === "--ignore") {
      const result = optionValue(args, index, "--ignore");
      options.ignore.push(result.value);
      index += result.consumed;
      continue;
    }
    if (longName === "--max-file-size") {
      const result = optionValue(args, index, "--max-file-size");
      options.maxFileSize = parseSize(result.value);
      index += result.consumed;
      continue;
    }

    if (argument.startsWith("-")) throw new UsageError(`unknown option: ${argument}`);
    if (command === "deadlines") throw new UsageError(`unexpected argument: ${argument}`);
    if (targetSet) throw new UsageError(`only one scan path is supported; received: ${argument}`);
    options.target = argument;
    targetSet = true;
  }

  parseDateOnly(options.asOf, "as-of date");
  if (command === "scan" && !SCAN_FORMATS.has(options.format)) {
    throw new UsageError(`unsupported scan format: ${options.format}`);
  }
  if (command === "deadlines" && !DEADLINE_FORMATS.has(options.format)) {
    throw new UsageError(`unsupported deadline format: ${options.format}`);
  }
  if (!THRESHOLDS.has(options.failOn)) {
    throw new UsageError(`unsupported --fail-on threshold: ${options.failOn}`);
  }
  if (command === "deadlines" && options.output) {
    throw new UsageError("--output is currently available for scans only");
  }
  return options;
}

async function writeOutput(filename, content, cwd) {
  const absolute = path.resolve(cwd, filename);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${content.replace(/\n?$/, "\n")}`, "utf8");
  return absolute;
}

function shouldUseColor(options, stdout, env) {
  return options.color && stdout.isTTY === true && !env.NO_COLOR;
}

function output(stream, value) {
  stream.write(`${value.replace(/\n?$/, "\n")}`);
}

export async function main(args, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const cwd = dependencies.cwd ?? process.cwd();
  const env = dependencies.env ?? process.env;
  let options;

  try {
    options = parseArgs(args);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    output(stderr, `lifeline: ${error.message}\n\nRun lifeline --help for usage.`);
    return 2;
  }

  if (options.action === "help") {
    output(stdout, HELP);
    return 0;
  }
  if (options.action === "version") {
    output(stdout, VERSION);
    return 0;
  }

  const color = shouldUseColor(options, stdout, env);
  if (options.action === "deadlines") {
    const deadlineReport = createDeadlineReport(options.asOf, options.includePast);
    const rendered =
      options.format === "json"
        ? renderJson(deadlineReport)
        : options.format === "markdown"
          ? renderDeadlinesMarkdown(deadlineReport)
          : renderDeadlinesPretty(deadlineReport, { color });
    output(stdout, rendered);
    return 0;
  }

  let scanResult;
  try {
    scanResult = await scan(options.target, {
      cwd,
      asOf: options.asOf,
      includeDocs: options.includeDocs,
      ignore: options.ignore,
      maxFileSize: options.maxFileSize,
    });
  } catch (error) {
    output(stderr, `lifeline: ${error.message}`);
    return 2;
  }

  const targetLabel = options.target === "." ? "." : options.target;
  const report = createReport(scanResult, { targetLabel });
  const rendered = renderReport(report, options.format, { color: options.output ? false : color });

  if (options.output) {
    try {
      const absoluteOutput = await writeOutput(options.output, rendered, cwd);
      if (!options.quiet) {
        output(
          stdout,
          `Wrote ${path.relative(cwd, absoluteOutput) || path.basename(absoluteOutput)} — ` +
            `${report.summary.critical} critical, ${report.summary.warning} warning, ` +
            `${report.summary.notice} notice.`,
        );
      }
    } catch (error) {
      output(stderr, `lifeline: could not write ${options.output}: ${error.message}`);
      return 2;
    }
  } else {
    output(stdout, rendered);
  }

  return report.findings.some((finding) => meetsThreshold(finding.severity, options.failOn))
    ? 1
    : 0;
}

export { HELP, parseArgs, parseSize };
