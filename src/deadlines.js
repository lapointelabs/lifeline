const DAY_MS = 24 * 60 * 60 * 1000;

export const SEVERITY_ORDER = Object.freeze({
  notice: 1,
  warning: 2,
  critical: 3,
});

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function parseDateOnly(value, label = "date") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format`);
  }

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} is not a valid date`);

  const normalized = new Date(timestamp).toISOString().slice(0, 10);
  if (normalized !== value) throw new Error(`${label} is not a valid date`);

  return value;
}

export function daysUntil(shutdownDate, asOf = todayUtc()) {
  parseDateOnly(shutdownDate, "shutdown date");
  parseDateOnly(asOf, "as-of date");
  const shutdown = Date.parse(`${shutdownDate}T00:00:00.000Z`);
  const origin = Date.parse(`${asOf}T00:00:00.000Z`);
  return Math.round((shutdown - origin) / DAY_MS);
}

export function classifyDeadline(shutdownDate, asOf = todayUtc()) {
  const remaining = daysUntil(shutdownDate, asOf);

  if (remaining < 0) {
    return { daysRemaining: remaining, severity: "critical", status: "expired" };
  }
  if (remaining <= 30) {
    return { daysRemaining: remaining, severity: "critical", status: "urgent" };
  }
  if (remaining <= 90) {
    return { daysRemaining: remaining, severity: "warning", status: "upcoming" };
  }
  return { daysRemaining: remaining, severity: "notice", status: "scheduled" };
}

export function meetsThreshold(severity, threshold) {
  if (threshold === "never") return false;
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[threshold];
}

export function formatCountdown(daysRemaining) {
  if (daysRemaining < -1) return `expired ${Math.abs(daysRemaining)} days ago`;
  if (daysRemaining === -1) return "expired yesterday";
  if (daysRemaining === 0) return "shuts down today";
  if (daysRemaining === 1) return "shuts down tomorrow";
  return `shuts down in ${daysRemaining} days`;
}
