import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_UPDATED_AT,
  DEPRECATIONS,
  OFFICIAL_SOURCES,
  PROVIDER_IDS,
} from "../src/catalog.js";

function model(identifier, provider = "openai") {
  return DEPRECATIONS.find(
    (rule) =>
      rule.provider === provider &&
      rule.category === "model" &&
      rule.title.endsWith(identifier),
  );
}

test("catalog exposes provider-scoped official sources and unique rules", () => {
  assert.deepEqual(PROVIDER_IDS, ["openai", "anthropic", "google"]);
  assert.equal(CATALOG_UPDATED_AT, "2026-08-04");
  assert.equal(new Set(DEPRECATIONS.map((rule) => rule.id)).size, DEPRECATIONS.length);

  for (const provider of PROVIDER_IDS) {
    assert.ok(DEPRECATIONS.some((rule) => rule.provider === provider));
    assert.ok(
      OFFICIAL_SOURCES.some(
        (source) => source.provider === provider && source.url.startsWith("https://"),
      ),
    );
  }

  for (const rule of DEPRECATIONS) {
    assert.match(rule.shutdownDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(`${rule.shutdownDate}T00:00:00.000Z`)));
    assert.ok(rule.replacement.length > 0);
    assert.ok(rule.sourceUrl.startsWith("https://"));
    assert.ok(rule.migrationUrl.startsWith("https://"));
    assert.equal(rule.detectable, rule.matchers.length > 0);
    for (const matcher of rule.matchers) assert.doesNotThrow(() => new RegExp(matcher.source, matcher.flags));
  }
});

test("OpenAI July 2026 replacements retain their provider-specific targets", () => {
  assert.equal(
    model("gpt-4o-mini-tts-2025-03-20").replacement,
    "gpt-4o-mini-tts-2025-12-15",
  );
  assert.equal(model("gpt-audio-mini-2025-10-06").replacement, "gpt-audio-1.5");
  assert.equal(
    model("gpt-realtime-mini-2025-10-06").replacement,
    "gpt-realtime-2.1-mini",
  );
});

test("Anthropic and Google rules preserve official date semantics", () => {
  const anthropic = model("claude-opus-4-1-20250805", "anthropic");
  assert.equal(anthropic.shutdownDate, "2026-08-05");
  assert.equal(anthropic.replacement, "claude-opus-4-8");
  assert.equal(anthropic.deadlineBasis, "scheduled");

  const google = model("embedding-2-preview", "google");
  assert.equal(google.shutdownDate, "2026-08-10");
  assert.equal(google.replacement, "gemini-embedding-2");
  assert.equal(google.deadlineBasis, "earliest");
});
