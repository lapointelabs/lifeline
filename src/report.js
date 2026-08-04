import { createHash } from "node:crypto";
import path from "node:path";

import { CATALOG_UPDATED_AT, CATALOG_VERSION } from "./catalog.js";
import { VERSION } from "./version.js";

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function summarize(findings) {
  const uniqueRules = new Set(findings.map((finding) => finding.ruleId));
  const affectedFiles = new Set(findings.map((finding) => finding.location.path));
  return {
    total: findings.length,
    critical: findings.filter((finding) => finding.severity === "critical").length,
    warning: findings.filter((finding) => finding.severity === "warning").length,
    notice: findings.filter((finding) => finding.severity === "notice").length,
    affectedFiles: affectedFiles.size,
    uniqueDeprecations: uniqueRules.size,
  };
}

function evidencePayload(scanResult, summary) {
  return {
    schemaVersion: "lifeline.scan/v1",
    catalogVersion: scanResult.catalogVersion,
    asOf: scanResult.asOf,
    sourceDigest: scanResult.sourceDigest,
    scan: {
      filesScanned: scanResult.stats.filesScanned,
      filesSkipped: scanResult.stats.filesSkipped,
      errors: scanResult.errors.map((error) => ({
        path: toPosix(error.path),
        code: error.code,
      })),
    },
    summary,
    findings: scanResult.findings.map((finding) => ({
      ruleId: finding.ruleId,
      provider: finding.provider,
      category: finding.category,
      severity: finding.severity,
      status: finding.status,
      shutdownDate: finding.shutdownDate,
      daysRemaining: finding.daysRemaining,
      replacement: finding.replacement,
      confidence: finding.confidence,
      match: finding.match,
      location: {
        path: toPosix(finding.location.path),
        line: finding.location.line,
        column: finding.location.column,
      },
    })),
  };
}

export function createReport(scanResult, options = {}) {
  const summary = summarize(scanResult.findings);
  const evidence = evidencePayload(scanResult, summary);
  const digest = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");

  return {
    schemaVersion: "lifeline.scan/v1",
    tool: {
      name: "@lapointelabs/lifeline",
      version: VERSION,
    },
    catalog: {
      version: CATALOG_VERSION,
      updatedAt: CATALOG_UPDATED_AT,
    },
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    asOf: scanResult.asOf,
    target: options.targetLabel ?? scanResult.target,
    summary,
    scan: {
      ...scanResult.stats,
      sourceDigest: scanResult.sourceDigest,
      errors: scanResult.errors,
    },
    findings: scanResult.findings,
    integrity: {
      algorithm: "sha256",
      digest,
      covers:
        "scanned source contents, catalog version, as-of date, scan coverage, summary, and normalized findings",
    },
  };
}

export function verifyReportIntegrity(report) {
  const scanResult = {
    catalogVersion: report.catalog.version,
    asOf: report.asOf,
    sourceDigest: report.scan.sourceDigest,
    stats: {
      filesScanned: report.scan.filesScanned,
      filesSkipped: report.scan.filesSkipped,
    },
    errors: report.scan.errors,
    findings: report.findings,
  };
  const evidence = evidencePayload(scanResult, report.summary);
  const digest = createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  return digest === report.integrity.digest;
}
