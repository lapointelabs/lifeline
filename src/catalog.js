const DEPRECATIONS_URL = "https://developers.openai.com/api/docs/deprecations";
const ASSISTANTS_MIGRATION_URL =
  "https://developers.openai.com/api/docs/assistants/migration";
const ANTHROPIC_DEPRECATIONS_URL =
  "https://platform.claude.com/docs/en/about-claude/model-deprecations";
const ANTHROPIC_MIGRATION_URL =
  "https://platform.claude.com/docs/en/about-claude/models/migration-guide";
const GOOGLE_DEPRECATIONS_URL =
  "https://ai.google.dev/gemini-api/docs/deprecations";

export const CATALOG_VERSION = "2026.08.04.2";
export const CATALOG_UPDATED_AT = "2026-08-04";

export const PROVIDERS = Object.freeze({
  openai: Object.freeze({
    id: "openai",
    name: "OpenAI",
    sourceUrl: DEPRECATIONS_URL,
  }),
  anthropic: Object.freeze({
    id: "anthropic",
    name: "Anthropic",
    sourceUrl: ANTHROPIC_DEPRECATIONS_URL,
  }),
  google: Object.freeze({
    id: "google",
    name: "Google Gemini",
    sourceUrl: GOOGLE_DEPRECATIONS_URL,
  }),
});

export const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDERS));

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

function modelRule({
  provider = "openai",
  identifier,
  shutdownDate,
  replacement,
  note,
  sourceUrl,
  migrationUrl,
  deadlineBasis = "scheduled",
}) {
  const providerDefinition = PROVIDERS[provider];
  if (!providerDefinition) throw new Error(`unknown catalog provider: ${provider}`);

  return {
    id: `${provider}-model-${identifier.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`,
    provider,
    category: "model",
    title: `${providerDefinition.name} model ${identifier}`,
    shutdownDate,
    deadlineBasis,
    replacement,
    guidance:
      note ??
      `Replace ${identifier}, then run behavioral, latency, and cost regression tests before changing production traffic.`,
    sourceUrl: sourceUrl ?? providerDefinition.sourceUrl,
    migrationUrl: migrationUrl ?? sourceUrl ?? providerDefinition.sourceUrl,
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
  {
    id: "openai-self-serve-fine-tuning-training",
    provider: "openai",
    category: "platform",
    title: "OpenAI self-serve fine-tuning job creation",
    shutdownDate: "2027-01-06",
    replacement: "Complete training migrations before job creation closes",
    guidance:
      "Inventory training pipelines and create replacement fine-tuning jobs before self-serve job creation becomes unavailable. Existing inference follows each base model's retirement date.",
    sourceUrl: DEPRECATIONS_URL,
    migrationUrl: DEPRECATIONS_URL,
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
      "computer-use-preview",
      "gpt-4o-mini-search-preview-2025-03-11",
      "gpt-4o-search-preview-2025-03-11",
    ],
  },
  {
    shutdownDate: "2026-07-23",
    replacement: "gpt-4o-mini-tts-2025-12-15",
    identifiers: ["gpt-4o-mini-tts-2025-03-20"],
  },
  {
    shutdownDate: "2026-07-23",
    replacement: "gpt-audio-1.5",
    identifiers: ["gpt-audio-mini-2025-10-06"],
  },
  {
    shutdownDate: "2026-07-23",
    replacement: "gpt-realtime-2.1-mini",
    identifiers: ["gpt-realtime-mini-2025-10-06"],
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
      "o3-deep-research",
      "o4-mini-deep-research-2025-06-26",
      "o4-mini-deep-research",
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

const anthropicModelRows = [
  {
    shutdownDate: "2024-11-06",
    replacement: "claude-haiku-4-5-20251001",
    identifiers: [
      "claude-1.0",
      "claude-1.1",
      "claude-1.2",
      "claude-1.3",
      "claude-instant-1.0",
      "claude-instant-1.1",
      "claude-instant-1.2",
    ],
  },
  {
    shutdownDate: "2025-07-21",
    replacement: "claude-opus-4-8",
    identifiers: ["claude-2.0", "claude-2.1"],
  },
  {
    shutdownDate: "2025-07-21",
    replacement: "claude-sonnet-4-6",
    identifiers: ["claude-3-sonnet-20240229"],
  },
  {
    shutdownDate: "2025-10-28",
    replacement: "claude-sonnet-4-6",
    identifiers: ["claude-3-5-sonnet-20240620", "claude-3-5-sonnet-20241022"],
  },
  {
    shutdownDate: "2026-01-05",
    replacement: "claude-opus-4-8",
    identifiers: ["claude-3-opus-20240229"],
  },
  {
    shutdownDate: "2026-02-19",
    replacement: "claude-haiku-4-5-20251001",
    identifiers: ["claude-3-5-haiku-20241022"],
  },
  {
    shutdownDate: "2026-02-19",
    replacement: "claude-sonnet-4-6",
    identifiers: ["claude-3-7-sonnet-20250219"],
  },
  {
    shutdownDate: "2026-04-20",
    replacement: "claude-haiku-4-5-20251001",
    identifiers: ["claude-3-haiku-20240307"],
  },
  {
    shutdownDate: "2026-06-15",
    replacement: "claude-sonnet-4-6",
    identifiers: ["claude-sonnet-4-20250514"],
  },
  {
    shutdownDate: "2026-06-15",
    replacement: "claude-opus-4-8",
    identifiers: ["claude-opus-4-20250514"],
  },
  {
    shutdownDate: "2026-08-05",
    replacement: "claude-opus-4-8",
    identifiers: ["claude-opus-4-1-20250805"],
  },
];

const googleModelRows = [
  {
    shutdownDate: "2025-10-30",
    replacement: "gemini-embedding-2",
    identifiers: [
      "embedding-001",
      "embedding-gecko-001",
      "gemini-embedding-exp",
      "gemini-embedding-exp-03-07",
    ],
  },
  {
    shutdownDate: "2025-11-10",
    replacement: "imagen-4.0-generate-001",
    identifiers: ["imagen-3.0-generate-002"],
  },
  {
    shutdownDate: "2025-11-12",
    replacement: "veo-3.1-generate-preview",
    identifiers: ["veo-3.0-generate-preview"],
  },
  {
    shutdownDate: "2025-11-12",
    replacement: "veo-3.1-fast-generate-preview",
    identifiers: ["veo-3.0-fast-generate-preview"],
  },
  {
    shutdownDate: "2025-11-14",
    replacement: "gemini-2.5-flash-image",
    identifiers: ["gemini-2.0-flash-preview-image-generation"],
  },
  {
    shutdownDate: "2025-11-18",
    replacement: "gemini-3.6-flash",
    identifiers: ["gemini-2.5-flash-preview-05-20"],
  },
  {
    shutdownDate: "2025-12-02",
    replacement: "gemini-3.1-pro-preview",
    identifiers: [
      "gemini-2.5-pro-preview-03-25",
      "gemini-2.5-pro-preview-05-06",
      "gemini-2.5-pro-preview-06-05",
    ],
  },
  {
    shutdownDate: "2025-12-09",
    replacement: "gemini-2.5-flash-lite",
    identifiers: ["gemini-2.0-flash-lite-preview", "gemini-2.0-flash-lite-preview-02-05"],
  },
  {
    shutdownDate: "2025-12-09",
    replacement: "gemini-3.1-flash-live-preview",
    identifiers: ["gemini-2.0-flash-live-001", "gemini-live-2.5-flash-preview"],
  },
  {
    shutdownDate: "2026-01-14",
    replacement: "gemini-embedding-2",
    identifiers: ["text-embedding-004"],
  },
  {
    shutdownDate: "2026-01-15",
    replacement: "gemini-2.5-flash-image",
    identifiers: ["gemini-2.5-flash-image-preview"],
  },
  {
    shutdownDate: "2026-02-17",
    replacement: "gemini-3.6-flash",
    identifiers: ["gemini-2.5-flash-preview-09-25"],
  },
  {
    shutdownDate: "2026-02-17",
    replacement: "imagen-4.0-generate-001",
    identifiers: ["imagen-4.0-generate-preview-06-06"],
  },
  {
    shutdownDate: "2026-02-17",
    replacement: "imagen-4.0-ultra-generate-001",
    identifiers: ["imagen-4.0-ultra-generate-preview-06-06"],
  },
  {
    shutdownDate: "2026-03-09",
    replacement: "gemini-3.1-pro-preview",
    identifiers: ["gemini-3-pro-preview"],
  },
  {
    shutdownDate: "2026-03-31",
    replacement: "gemini-3.1-flash-lite",
    identifiers: ["gemini-2.5-flash-lite-preview-09-2025"],
  },
  {
    shutdownDate: "2026-04-30",
    replacement: "gemini-robotics-er-1.6-preview",
    identifiers: ["gemini-robotics-er-1.5-preview"],
  },
  {
    shutdownDate: "2026-05-25",
    replacement: "gemini-3.1-flash-lite",
    identifiers: ["gemini-3.1-flash-lite-preview"],
  },
  {
    shutdownDate: "2026-06-01",
    replacement: "gemini-3.6-flash",
    identifiers: ["gemini-2.0-flash", "gemini-2.0-flash-001"],
  },
  {
    shutdownDate: "2026-06-01",
    replacement: "gemini-3.1-flash-lite",
    identifiers: ["gemini-2.0-flash-lite", "gemini-2.0-flash-lite-001"],
  },
  {
    shutdownDate: "2026-06-25",
    replacement: "gemini-3.1-flash-image",
    identifiers: ["gemini-3.1-flash-image-preview"],
  },
  {
    shutdownDate: "2026-06-25",
    replacement: "gemini-3-pro-image",
    identifiers: ["gemini-3-pro-image-preview"],
  },
  {
    shutdownDate: "2026-06-30",
    replacement: "veo-3.1-generate-preview",
    identifiers: ["veo-3.0-generate-001", "veo-2.0-generate-001"],
  },
  {
    shutdownDate: "2026-06-30",
    replacement: "veo-3.1-fast-generate-preview",
    identifiers: ["veo-3.0-fast-generate-001"],
  },
  {
    shutdownDate: "2026-08-10",
    replacement: "gemini-embedding-2",
    identifiers: ["embedding-2-preview"],
  },
  {
    shutdownDate: "2026-08-17",
    replacement: "gemini-3.1-flash-image",
    identifiers: [
      "imagen-4.0-generate-001",
      "imagen-4.0-ultra-generate-001",
      "imagen-4.0-fast-generate-001",
    ],
  },
  {
    shutdownDate: "2026-08-31",
    replacement: "gemini-robotics-er-2-preview",
    identifiers: ["gemini-robotics-er-1.6-preview"],
  },
  {
    shutdownDate: "2026-10-02",
    replacement: "gemini-3.1-flash-image-preview",
    identifiers: ["gemini-2.5-flash-image"],
  },
  {
    shutdownDate: "2027-05-07",
    replacement: "gemini-3.5-flash-lite",
    identifiers: ["gemini-3.1-flash-lite"],
  },
  {
    shutdownDate: "2028-05-14",
    replacement: "gemini-embedding-2",
    identifiers: ["gemini-embedding-001"],
  },
];

const modelRules = modelRows.flatMap((row) =>
  row.identifiers.map((identifier) => modelRule({ ...row, identifier })),
);

const anthropicModelRules = anthropicModelRows.flatMap((row) =>
  row.identifiers.map((identifier) =>
    modelRule({
      ...row,
      provider: "anthropic",
      identifier,
      migrationUrl: ANTHROPIC_MIGRATION_URL,
    }),
  ),
);

const googleModelRules = googleModelRows.flatMap((row) =>
  row.identifiers.map((identifier) =>
    modelRule({
      ...row,
      provider: "google",
      identifier,
      deadlineBasis: "earliest",
      note:
        `Migrate ${identifier} before Google's earliest published shutdown date, then run behavioral, latency, and cost regression tests.`,
    }),
  ),
);

export const DEPRECATIONS = Object.freeze(
  [...platformRules, ...modelRules, ...anthropicModelRules, ...googleModelRules]
    .sort(
      (left, right) =>
        left.shutdownDate.localeCompare(right.shutdownDate) ||
        left.id.localeCompare(right.id),
    )
    .map((rule) =>
      Object.freeze({
        ...rule,
        matchers: Object.freeze(rule.matchers.map((matcher) => Object.freeze(matcher))),
      }),
    ),
);

export const OFFICIAL_SOURCES = Object.freeze([
  {
    provider: "openai",
    title: "OpenAI API deprecations",
    url: DEPRECATIONS_URL,
  },
  {
    provider: "openai",
    title: "Assistants API migration guide",
    url: ASSISTANTS_MIGRATION_URL,
  },
  {
    provider: "anthropic",
    title: "Anthropic model deprecations",
    url: ANTHROPIC_DEPRECATIONS_URL,
  },
  {
    provider: "google",
    title: "Google Gemini deprecations",
    url: GOOGLE_DEPRECATIONS_URL,
  },
].map((source) => Object.freeze(source)));

export function getRule(id) {
  return DEPRECATIONS.find((rule) => rule.id === id);
}
