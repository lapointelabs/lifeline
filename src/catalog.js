const DEPRECATIONS_URL = "https://developers.openai.com/api/docs/deprecations";
const ASSISTANTS_MIGRATION_URL =
  "https://developers.openai.com/api/docs/assistants/migration";

export const CATALOG_VERSION = "2026.08.04.1";
export const CATALOG_UPDATED_AT = "2026-08-04";

function regex(source, flags = "gi") {
  return { source, flags };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function modelMatcher(identifier) {
  if (identifier === "o1") {
    return regex(
      "(?:[\\\"'`]o1[\\\"'`]|\\b(?:OPENAI_MODEL|MODEL)\\s*=\\s*o1\\b)",
      "g",
    );
  }

  const boundary = "A-Za-z0-9_.:-";
  return regex(
    `(?<![${boundary}])${escapeRegex(identifier)}(?![${boundary}])`,
    "g",
  );
}

function modelRule({ identifier, shutdownDate, replacement, note }) {
  return {
    id: `openai-model-${identifier.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`,
    provider: "openai",
    category: "model",
    title: `OpenAI model ${identifier}`,
    shutdownDate,
    replacement,
    guidance:
      note ??
      `Replace ${identifier}, then run behavioral and cost regression tests before changing production traffic.`,
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl: DEPRECATIONS_URL,
    matchers: [modelMatcher(identifier)],
    detectable: true,
  };
}

const platformRules = [
  {
    id: "openai-assistants-api",
    provider: "openai",
    category: "api",
    title: "OpenAI Assistants API",
    shutdownDate: "2026-08-26",
    replacement: "Responses API + Conversations API",
    guidance:
      "Inventory Assistants, Threads, Runs, tool schemas, vector stores, and streaming handlers. Migrate new conversations first and regression-test tool behavior before cutover.",
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl: ASSISTANTS_MIGRATION_URL,
    matchers: [
      regex("\\b(?:openai|client)\\.beta\\.(?:assistants|threads)(?:\\.[A-Za-z_][A-Za-z0-9_]*)*", "g"),
      regex("/v1/(?:assistants|threads)(?:/|\\b)", "g"),
      regex("OpenAI-Beta\\s*[:=]\\s*[\\\"']?assistants=v2", "gi"),
    ],
    detectable: true,
  },
  {
    id: "openai-videos-api",
    provider: "openai",
    category: "api",
    title: "OpenAI Videos API",
    shutdownDate: "2026-09-24",
    replacement: "No official replacement listed",
    guidance:
      "Remove production dependence on the Videos API or obtain an explicit replacement plan before the shutdown date.",
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl: DEPRECATIONS_URL,
    matchers: [
      regex("\\b(?:openai|client)\\.videos\\.(?:create|retrieve|list|delete|download|content)\\b", "g"),
      regex("/v1/videos(?:/|\\b)", "g"),
    ],
    detectable: true,
  },
  {
    id: "openai-reusable-prompts",
    provider: "openai",
    category: "platform",
    title: "OpenAI reusable prompt objects",
    shutdownDate: "2026-11-30",
    replacement: "Prompt content stored in application code",
    guidance:
      "Move reusable prompt content and version ownership into application code; do not migrate Assistants into a new long-lived dependency on prompt objects.",
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl:
      "https://developers.openai.com/api/docs/guides/prompting/migrate-from-prompt-object",
    matchers: [
      regex("\\b(?:openai|client)\\.prompts\\.(?:create|retrieve|update|delete|list)\\b", "g"),
      regex("/v1/prompts(?:/|\\b)", "g"),
    ],
    detectable: true,
  },
  {
    id: "openai-evals-platform",
    provider: "openai",
    category: "platform",
    title: "OpenAI Evals platform",
    shutdownDate: "2026-11-30",
    replacement: "Promptfoo",
    guidance:
      "Export evaluation definitions and results before the dashboard becomes read-only, then reproduce the gates in the recommended replacement.",
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl:
      "https://developers.openai.com/cookbook/examples/evaluation/moving-from-openai-evals-to-promptfoo",
    matchers: [
      regex("\\b(?:openai|client)\\.evals\\.(?:create|retrieve|update|delete|list|runs)\\b", "g"),
      regex("/v1/evals(?:/|\\b)", "g"),
    ],
    detectable: true,
  },
  {
    id: "openai-agent-builder",
    provider: "openai",
    category: "platform",
    title: "OpenAI Agent Builder",
    shutdownDate: "2026-11-30",
    replacement: "Agents SDK or ChatGPT Workspace Agents",
    guidance:
      "Inventory Agent Builder workflows and move them to the Agents SDK or ChatGPT Workspace Agents before shutdown.",
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl:
      "https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder",
    matchers: [],
    detectable: false,
  },
];

const modelRows = [
  {
    shutdownDate: "2026-07-23",
    replacement: "gpt-5.6-terra",
    identifiers: [
      "computer-use-preview-2025-03-11",
      "gpt-4o-mini-search-preview-2025-03-11",
      "gpt-4o-mini-tts-2025-03-20",
      "gpt-4o-search-preview-2025-03-11",
      "gpt-audio-mini-2025-10-06",
      "gpt-realtime-mini-2025-10-06",
    ],
  },
  {
    shutdownDate: "2026-07-23",
    replacement: "gpt-5.6-sol",
    identifiers: [
      "gpt-5-chat-latest",
      "gpt-5-codex",
      "gpt-5.1-chat-latest",
      "gpt-5.1-codex",
      "gpt-5.1-codex-max",
      "gpt-5.2-codex",
      "o3-deep-research-2025-06-26",
      "o4-mini-deep-research-2025-06-26",
    ],
  },
  {
    shutdownDate: "2026-07-23",
    replacement: "gpt-5.6-terra",
    identifiers: ["gpt-5.1-codex-mini"],
  },
  {
    shutdownDate: "2026-08-10",
    replacement: "gpt-5.6-sol",
    identifiers: ["gpt-5.2-chat-latest", "gpt-5.3-chat-latest"],
  },
  {
    shutdownDate: "2026-09-24",
    replacement: "No official replacement listed",
    identifiers: [
      "sora-2",
      "sora-2-pro",
      "sora-2-2025-10-06",
      "sora-2-2025-12-08",
      "sora-2-pro-2025-10-06",
    ],
  },
  {
    shutdownDate: "2026-09-28",
    replacement: "gpt-5.4-mini or gpt-5-mini",
    identifiers: [
      "gpt-3.5-turbo-instruct",
      "babbage-002",
      "davinci-002",
      "gpt-3.5-turbo-1106",
    ],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.6-terra",
    identifiers: [
      "gpt-3.5-turbo-0125",
      "gpt-3.5-turbo",
      "gpt-3.5-turbo-completions",
      "ft-o4-mini-2025-04-16",
      "o4-mini-2025-04-16",
      "o4-mini",
    ],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.6-sol",
    identifiers: [
      "gpt-4-0613",
      "gpt-4",
      "gpt-4-0613-completions",
      "gpt-4-completions",
      "gpt-4-1106-preview",
      "gpt-4-turbo",
      "gpt-4-turbo-2024-04-09",
      "gpt-4-turbo-completions",
      "gpt-4o-2024-05-13",
      "o1-2024-12-17",
      "o1",
    ],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.6-sol with reasoning.mode=pro",
    identifiers: ["o1-pro-2025-03-19", "o1-pro"],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.6-luna",
    identifiers: ["gpt-4.1-nano", "gpt-4.1-nano-2025-04-14"],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-image-2",
    identifiers: ["gpt-image-1"],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.6-sol",
    identifiers: ["o3-mini-2025-01-31", "o3-mini"],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.4-mini",
    identifiers: ["ft-gpt-3.5-turbo", "ft-babbage-002", "ft-davinci-002"],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.5",
    identifiers: ["ft-gpt-4"],
  },
  {
    shutdownDate: "2026-10-23",
    replacement: "gpt-5.4-nano",
    identifiers: ["ft-gpt-4.1-nano-2025-04-14"],
  },
  {
    shutdownDate: "2026-12-01",
    replacement: "gpt-image-2",
    identifiers: ["gpt-image-1-mini", "gpt-image-1.5", "chatgpt-image-latest"],
  },
  {
    shutdownDate: "2026-12-11",
    replacement: "gpt-5.6-sol",
    identifiers: ["gpt-5-2025-08-07", "o3-2025-04-16"],
  },
  {
    shutdownDate: "2026-12-11",
    replacement: "gpt-5.6-terra",
    identifiers: ["gpt-5-mini-2025-08-07"],
  },
  {
    shutdownDate: "2026-12-11",
    replacement: "gpt-5.6-luna",
    identifiers: ["gpt-5-nano-2025-08-07"],
  },
  {
    shutdownDate: "2026-12-11",
    replacement: "gpt-5.6-sol with reasoning.mode=pro",
    identifiers: ["gpt-5-pro-2025-10-06", "o3-pro-2025-06-10"],
  },
  {
    shutdownDate: "2027-01-20",
    replacement: "gpt-realtime-2.1",
    identifiers: ["gpt-realtime", "gpt-4o-realtime"],
  },
  {
    shutdownDate: "2027-01-20",
    replacement: "gpt-realtime-2.1-mini",
    identifiers: ["gpt-realtime-mini", "gpt-4o-mini-realtime"],
  },
  {
    shutdownDate: "2027-01-20",
    replacement: "gpt-audio-1.5",
    identifiers: ["gpt-audio", "gpt-4o-audio", "gpt-audio-mini", "gpt-4o-mini-audio"],
  },
  {
    shutdownDate: "2027-01-20",
    replacement: "gpt-4o-mini-transcribe-2025-12-15",
    identifiers: ["gpt-4o-mini-transcribe-2025-03-20"],
  },
];

const modelRules = modelRows.flatMap((row) =>
  row.identifiers.map((identifier) => modelRule({ ...row, identifier })),
);

export const DEPRECATIONS = Object.freeze(
  [...platformRules, ...modelRules]
    .sort(
      (left, right) =>
        left.shutdownDate.localeCompare(right.shutdownDate) ||
        left.id.localeCompare(right.id),
    )
    .map((rule) => Object.freeze(rule)),
);

export const OFFICIAL_SOURCES = Object.freeze([
  {
    title: "OpenAI API deprecations",
    url: DEPRECATIONS_URL,
  },
  {
    title: "Assistants API migration guide",
    url: ASSISTANTS_MIGRATION_URL,
  },
]);

export function getRule(id) {
  return DEPRECATIONS.find((rule) => rule.id === id);
}
