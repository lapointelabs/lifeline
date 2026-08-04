import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { CATALOG_VERSION, DEPRECATIONS } from "./catalog.js";
import { classifyDeadline, parseDateOnly, todayUtc } from "./deadlines.js";
import {
  compileIgnorePatterns,
  isIgnored,
  isScannableFile,
} from "./ignore.js";

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;
const DEFAULT_IGNORE_PATTERNS = ["lifeline-report.*", "*.sarif"];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function lineStartsFor(content) {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function locationAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: offset - starts[lineIndex] + 1,
  };
}

function safeMatch(value) {
  return value.replace(/\s+/g, " ").slice(0, 160);
}

function isBinary(buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 8192)).includes(0);
}

async function readIgnoreFile(root) {
  try {
    const content = await readFile(path.join(root, ".lifelineignore"), "utf8");
    return content.split(/\r?\n/);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function scanContent(content, relativePath, rules, asOf) {
  const findings = [];
  const starts = lineStartsFor(content);
  const seen = new Set();

  for (const rule of rules) {
    const deadline = classifyDeadline(rule.shutdownDate, asOf);
    for (const matcher of rule.matchers) {
      const flags = matcher.flags.includes("g") ? matcher.flags : `${matcher.flags}g`;
      const expression = new RegExp(matcher.source, flags);
      let match;

      while ((match = expression.exec(content)) !== null) {
        const location = locationAt(starts, match.index);
        const matchedText = safeMatch(match[0]);
        const deduplicationKey = [
          rule.id,
          relativePath,
          location.line,
          location.column,
          matchedText,
        ].join(":");

        if (!seen.has(deduplicationKey)) {
          seen.add(deduplicationKey);
          findings.push({
            ruleId: rule.id,
            provider: rule.provider,
            category: rule.category,
            title: rule.title,
            severity: deadline.severity,
            status: deadline.status,
            shutdownDate: rule.shutdownDate,
            daysRemaining: deadline.daysRemaining,
            replacement: rule.replacement,
            guidance: rule.guidance,
            sourceUrl: rule.sourceUrl,
            migrationUrl: rule.migrationUrl,
            confidence: "exact",
            match: matchedText,
            location: {
              path: relativePath,
              line: location.line,
              column: location.column,
            },
          });
        }

        if (match[0].length === 0) expression.lastIndex += 1;
      }
    }
  }

  return findings;
}

function findingSort(left, right) {
  const rank = { critical: 0, warning: 1, notice: 2 };
  return (
    rank[left.severity] - rank[right.severity] ||
    left.shutdownDate.localeCompare(right.shutdownDate) ||
    left.ruleId.localeCompare(right.ruleId) ||
    left.location.path.localeCompare(right.location.path) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column
  );
}

export async function scan(target = ".", options = {}) {
  const started = performance.now();
  const asOf = parseDateOnly(options.asOf ?? todayUtc(), "as-of date");
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
    throw new Error("max file size must be a positive integer");
  }

  const absoluteTarget = path.resolve(options.cwd ?? process.cwd(), target);
  let targetStat;
  try {
    targetStat = await stat(absoluteTarget);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`scan target does not exist: ${target}`);
    throw error;
  }

  if (!targetStat.isDirectory() && !targetStat.isFile()) {
    throw new Error(`scan target must be a file or directory: ${target}`);
  }

  const root = targetStat.isDirectory() ? absoluteTarget : path.dirname(absoluteTarget);
  const ignoreLines = targetStat.isDirectory() ? await readIgnoreFile(root) : [];
  const ignorePatterns = compileIgnorePatterns([
    ...DEFAULT_IGNORE_PATTERNS,
    ...ignoreLines,
    ...(options.ignore ?? []),
  ]);
  const queue = targetStat.isDirectory() ? [absoluteTarget] : [absoluteTarget];
  const findings = [];
  const errors = [];
  const sourceEntries = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    let currentStat;
    try {
      currentStat = await stat(current);
    } catch (error) {
      errors.push({ path: toPosix(path.relative(root, current)), code: error.code ?? "UNKNOWN" });
      filesSkipped += 1;
      continue;
    }

    if (currentStat.isDirectory()) {
      let entries;
      try {
        entries = await readdir(current, { withFileTypes: true });
      } catch (error) {
        errors.push({ path: toPosix(path.relative(root, current)), code: error.code ?? "UNKNOWN" });
        continue;
      }

      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.isSymbolicLink()) {
          filesSkipped += 1;
          continue;
        }
        const absolute = path.join(current, entry.name);
        const relative = toPosix(path.relative(root, absolute));
        if (isIgnored(relative, entry.name, ignorePatterns)) {
          filesSkipped += 1;
          continue;
        }
        if (entry.isDirectory() || entry.isFile()) queue.push(absolute);
      }
      continue;
    }

    if (!currentStat.isFile()) {
      filesSkipped += 1;
      continue;
    }

    const relativePath = toPosix(path.relative(root, current)) || path.basename(current);
    if (!isScannableFile(path.basename(current), options.includeDocs)) {
      filesSkipped += 1;
      continue;
    }
    if (currentStat.size > maxFileSize) {
      filesSkipped += 1;
      continue;
    }

    try {
      const buffer = await readFile(current);
      if (isBinary(buffer)) {
        filesSkipped += 1;
        continue;
      }
      const content = buffer.toString("utf8");
      findings.push(...scanContent(content, relativePath, DEPRECATIONS, asOf));
      sourceEntries.push({
        path: relativePath,
        digest: createHash("sha256").update(buffer).digest("hex"),
      });
      filesScanned += 1;
    } catch (error) {
      errors.push({ path: relativePath, code: error.code ?? "UNKNOWN" });
      filesSkipped += 1;
    }
  }

  findings.sort(findingSort);
  sourceEntries.sort((left, right) => left.path.localeCompare(right.path));
  const sourceDigest = createHash("sha256")
    .update(JSON.stringify(sourceEntries))
    .digest("hex");

  return {
    catalogVersion: CATALOG_VERSION,
    asOf,
    target: absoluteTarget,
    targetKind: targetStat.isDirectory() ? "directory" : "file",
    findings,
    errors,
    sourceDigest,
    stats: {
      filesScanned,
      filesSkipped,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
    },
  };
}

export { DEFAULT_MAX_FILE_SIZE };
