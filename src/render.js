import { DEPRECATIONS, OFFICIAL_SOURCES } from "./catalog.js";
import { classifyDeadline, formatCountdown } from "./deadlines.js";

function groupFindings(findings) {
  const groups = new Map();
  for (const finding of findings) {
    if (!groups.has(finding.ruleId)) groups.set(finding.ruleId, []);
    groups.get(finding.ruleId).push(finding);
  }
  return [...groups.values()];
}

function plural(count, singular, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

function terminalColors(enabled) {
  if (!enabled) {
    return new Proxy({}, { get: () => (value) => value });
  }
  const wrap = (code) => (value) => `\u001B[${code}m${value}\u001B[0m`;
  return {
    bold: wrap("1"),
    dim: wrap("2"),
    red: wrap("31"),
    yellow: wrap("33"),
    cyan: wrap("36"),
    green: wrap("32"),
  };
}

function severityLabel(severity, colors) {
  if (severity === "critical") return colors.red("CRITICAL");
  if (severity === "warning") return colors.yellow("WARNING ");
  return colors.cyan("NOTICE  ");
}

function summaryText(summary) {
  return [
    `${summary.critical} critical`,
    `${summary.warning} warning`,
    `${summary.notice} notice`,
  ].join(" · ");
}

export function renderPretty(report, options = {}) {
  const colors = terminalColors(options.color !== false);
  const lines = [];
  lines.push(`${colors.bold("LIFELINE")} ${colors.dim("/ OpenAI deprecation scan")}`);
  lines.push(
    `${colors.dim("Target")} ${report.target}  ${colors.dim("·")}  ` +
      `${report.scan.filesScanned} ${plural(report.scan.filesScanned, "file")} scanned  ` +
      `${colors.dim("·")}  as of ${report.asOf}`,
  );
  lines.push("");

  if (report.findings.length === 0) {
    lines.push(colors.green("✓ No deprecated OpenAI usage detected."));
  } else {
    for (const findings of groupFindings(report.findings)) {
      const first = findings[0];
      lines.push(
        `${severityLabel(first.severity, colors)}  ${colors.bold(first.title)}  ` +
          `${colors.dim(`· ${formatCountdown(first.daysRemaining)} · ${first.shutdownDate}`)}`,
      );
      lines.push(`          Replacement: ${first.replacement}`);

      for (const finding of findings.slice(0, 5)) {
        const location = `${finding.location.path}:${finding.location.line}:${finding.location.column}`;
        lines.push(`          ${colors.dim(location)}  ${finding.match}`);
      }
      if (findings.length > 5) {
        lines.push(`          ${colors.dim(`+ ${findings.length - 5} more occurrences`)}`);
      }
      lines.push(`          ${colors.dim("Migration:")} ${first.migrationUrl}`);
      lines.push("");
    }
  }

  if (report.scan.errors.length > 0) {
    lines.push(
      colors.yellow(
        `! ${report.scan.errors.length} ${plural(report.scan.errors.length, "path")} could not be read.`,
      ),
    );
    for (const error of report.scan.errors.slice(0, 5)) {
      lines.push(`  ${error.path || "."} (${error.code})`);
    }
    lines.push("");
  }

  lines.push(
    report.summary.total === 0
      ? colors.bold("Result  clean")
      : colors.bold(`Result  ${summaryText(report.summary)}`),
  );
  lines.push(
    `${colors.dim("Evidence")} sha256:${report.integrity.digest.slice(0, 16)}…  ` +
      `${colors.dim(`catalog ${report.catalog.version}`)}`,
  );
  return lines.join("\n");
}

function escapeTable(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderMarkdown(report) {
  const lines = [
    "# Lifeline deprecation report",
    "",
    report.summary.total === 0
      ? "> **Clean:** No deprecated OpenAI usage was detected."
      : `> **Action required:** ${summaryText(report.summary)}.`,
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Target | \`${escapeTable(report.target)}\` |`,
    `| Evaluated as of | ${report.asOf} |`,
    `| Files scanned | ${report.scan.filesScanned} |`,
    `| Affected files | ${report.summary.affectedFiles} |`,
    `| Catalog | ${report.catalog.version} |`,
    `| Evidence | \`sha256:${report.integrity.digest}\` |`,
    "",
  ];

  if (report.findings.length > 0) {
    lines.push(
      "## Findings",
      "",
      "| Severity | Dependency | Shutdown | Remaining | Replacement | Occurrences |",
      "| --- | --- | --- | ---: | --- | ---: |",
    );
    for (const findings of groupFindings(report.findings)) {
      const first = findings[0];
      lines.push(
        `| ${first.severity.toUpperCase()} | ${escapeTable(first.title)} | ${first.shutdownDate} | ` +
          `${escapeTable(formatCountdown(first.daysRemaining))} | ${escapeTable(first.replacement)} | ${findings.length} |`,
      );
    }
    lines.push("");

    for (const findings of groupFindings(report.findings)) {
      const first = findings[0];
      lines.push(
        `### ${first.title}`,
        "",
        `- Severity: **${first.severity}**`,
        `- Deadline: **${first.shutdownDate}** (${formatCountdown(first.daysRemaining)})`,
        `- Replacement: ${first.replacement}`,
        `- Guidance: ${first.guidance}`,
        `- [Official source](${first.sourceUrl})`,
        `- [Migration guidance](${first.migrationUrl})`,
        "",
        "Occurrences:",
        "",
      );
      for (const finding of findings) {
        lines.push(
          `- \`${finding.location.path}:${finding.location.line}:${finding.location.column}\` — ` +
            `\`${finding.match.replace(/`/g, "\\`")}\``,
        );
      }
      lines.push("");
    }
  }

  if (report.scan.errors.length > 0) {
    lines.push("## Incomplete reads", "");
    for (const error of report.scan.errors) {
      lines.push(`- \`${error.path || "."}\` (${error.code})`);
    }
    lines.push("");
  }

  lines.push(
    "## Evidence notes",
    "",
    "The SHA-256 digest covers the catalog version, as-of date, summary, and normalized findings. It verifies report integrity, not author identity or behavioral parity. Static analysis cannot identify values assembled entirely at runtime.",
    "",
    `_Generated by @lapointelabs/lifeline ${report.tool.version} at ${report.generatedAt}._`,
    "",
  );
  return lines.join("\n");
}

export function renderSarif(report) {
  const findingsByRule = groupFindings(report.findings);
  const rules = findingsByRule.map((findings) => {
    const finding = findings[0];
    return {
      id: finding.ruleId,
      name: finding.title.replace(/[^A-Za-z0-9]+/g, ""),
      shortDescription: { text: finding.title },
      fullDescription: {
        text: `${finding.title} shuts down on ${finding.shutdownDate}. Replace with ${finding.replacement}.`,
      },
      helpUri: finding.migrationUrl,
      help: { text: finding.guidance },
      defaultConfiguration: {
        level:
          finding.severity === "critical"
            ? "error"
            : finding.severity === "warning"
              ? "warning"
              : "note",
      },
      properties: {
        category: finding.category,
        provider: finding.provider,
        shutdownDate: finding.shutdownDate,
        replacement: finding.replacement,
      },
    };
  });

  const results = report.findings.map((finding) => ({
    ruleId: finding.ruleId,
    level:
      finding.severity === "critical"
        ? "error"
        : finding.severity === "warning"
          ? "warning"
          : "note",
    message: {
      text: `${finding.title} ${formatCountdown(finding.daysRemaining)}. Replace with ${finding.replacement}.`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: finding.location.path },
          region: {
            startLine: finding.location.line,
            startColumn: finding.location.column,
            endColumn: finding.location.column + Math.max(1, finding.match.length),
          },
        },
      },
    ],
    properties: {
      shutdownDate: finding.shutdownDate,
      daysRemaining: finding.daysRemaining,
      replacement: finding.replacement,
      evidenceDigest: report.integrity.digest,
    },
  }));

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "@lapointelabs/lifeline",
              version: report.tool.version,
              informationUri: "https://github.com/lapointelabs/lifeline",
              rules,
            },
          },
          invocations: [
            {
              executionSuccessful: report.scan.errors.length === 0,
              properties: {
                asOf: report.asOf,
                catalogVersion: report.catalog.version,
                evidenceDigest: report.integrity.digest,
                unreadablePaths: report.scan.errors,
              },
            },
          ],
          results,
        },
      ],
    },
    null,
    2,
  );
}

export function renderJson(value) {
  return JSON.stringify(value, null, 2);
}

function deadlineRows(asOf, includePast) {
  return DEPRECATIONS.map((rule) => ({
    ...rule,
    ...classifyDeadline(rule.shutdownDate, asOf),
  })).filter((rule) => includePast || rule.daysRemaining >= 0);
}

export function createDeadlineReport(asOf, includePast = false) {
  return {
    schemaVersion: "lifeline.deadlines/v1",
    asOf,
    includePast,
    deadlines: deadlineRows(asOf, includePast).map((rule) => ({
      id: rule.id,
      provider: rule.provider,
      category: rule.category,
      title: rule.title,
      shutdownDate: rule.shutdownDate,
      daysRemaining: rule.daysRemaining,
      severity: rule.severity,
      status: rule.status,
      replacement: rule.replacement,
      detectable: rule.detectable,
      sourceUrl: rule.sourceUrl,
    })),
    sources: OFFICIAL_SOURCES,
  };
}

export function renderDeadlinesPretty(deadlineReport, options = {}) {
  const colors = terminalColors(options.color !== false);
  const lines = [
    `${colors.bold("LIFELINE")} ${colors.dim("/ known OpenAI shutdowns")}`,
    `${colors.dim("Evaluated as of")} ${deadlineReport.asOf}`,
    "",
  ];

  let previousDate;
  for (const deadline of deadlineReport.deadlines) {
    if (deadline.shutdownDate !== previousDate) {
      if (previousDate) lines.push("");
      lines.push(
        `${colors.bold(deadline.shutdownDate)}  ${colors.dim(formatCountdown(deadline.daysRemaining))}`,
      );
      previousDate = deadline.shutdownDate;
    }
    lines.push(
      `  ${severityLabel(deadline.severity, colors)}  ${deadline.title}  ` +
        `${colors.dim(`→ ${deadline.replacement}`)}`,
    );
  }

  if (deadlineReport.deadlines.length === 0) lines.push("No scheduled shutdowns in this catalog.");
  lines.push("", `${colors.dim("Source")} ${OFFICIAL_SOURCES[0].url}`);
  return lines.join("\n");
}

export function renderDeadlinesMarkdown(deadlineReport) {
  const lines = [
    "# Known OpenAI shutdowns",
    "",
    `Evaluated as of **${deadlineReport.asOf}**.`,
    "",
    "| Severity | Dependency | Shutdown | Remaining | Replacement | Static detection |",
    "| --- | --- | --- | ---: | --- | --- |",
  ];
  for (const deadline of deadlineReport.deadlines) {
    lines.push(
      `| ${deadline.severity.toUpperCase()} | ${escapeTable(deadline.title)} | ${deadline.shutdownDate} | ` +
        `${escapeTable(formatCountdown(deadline.daysRemaining))} | ${escapeTable(deadline.replacement)} | ` +
        `${deadline.detectable ? "yes" : "no"} |`,
    );
  }
  lines.push("", `[Official OpenAI deprecation schedule](${OFFICIAL_SOURCES[0].url})`, "");
  return lines.join("\n");
}

export function renderReport(report, format, options = {}) {
  if (format === "pretty") return renderPretty(report, options);
  if (format === "json") return renderJson(report);
  if (format === "markdown") return renderMarkdown(report);
  if (format === "sarif") return renderSarif(report);
  throw new Error(`unsupported format: ${format}`);
}
