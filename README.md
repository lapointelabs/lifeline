# Lifeline

Find AI APIs and models that will break before they break production.

Lifeline is a local-first repository scanner for dated AI platform deprecations. It identifies the file and line using a deprecated model or API, shows the shutdown deadline and replacement, and produces an integrity-addressed report suitable for CI or a migration handoff.

```bash
npx @lapointelabs/lifeline scan .
```

No account, API key, source upload, or configuration is required. The scanner has no runtime dependencies and never makes a network request.

## What it catches

- OpenAI API and platform shutdowns, including Assistants, reusable prompts, Evals, Videos, and self-serve fine-tuning changes.
- OpenAI model retirements across GPT, o-series, audio, realtime, image, Sora, and specialized models.
- Anthropic Claude model retirements on Anthropic-operated platforms.
- Google Gemini API model shutdowns across Gemini, embeddings, Imagen, Veo, and robotics.

Every rule links to an official provider source: [OpenAI](https://developers.openai.com/api/docs/deprecations), [Anthropic](https://platform.claude.com/docs/en/about-claude/model-deprecations), or [Google Gemini](https://ai.google.dev/gemini-api/docs/deprecations). Google dates are preserved as earliest published shutdown dates rather than represented as guaranteed final dates.

Provider schedules are platform-specific. Anthropic rules do not claim Amazon Bedrock or Google Cloud retirement dates, and Google Gemini API rules do not claim Vertex AI dates.

See [provider coverage](docs/providers.md) for the platform boundary and date semantics behind each catalog.

## Commands

Scan the current repository:

```bash
lifeline scan
```

Scan another path and write a Markdown handoff:

```bash
lifeline scan ../my-app --format markdown --output lifeline-report.md
```

Generate SARIF for GitHub code scanning:

```bash
lifeline scan . --format sarif --output lifeline.sarif
```

List known deadlines without scanning source code:

```bash
lifeline deadlines
```

Limit a scan or deadline list to selected providers:

```bash
lifeline scan . --provider anthropic --provider google
lifeline deadlines --provider openai
```

Use a fixed date for a reproducible audit:

```bash
lifeline scan . --as-of 2026-08-04 --format json
```

## Scan options

| Option | Description |
| --- | --- |
| `--format, -f <pretty\|json\|markdown\|sarif>` | Select output format. |
| `--output, -o <file>` | Write the full report to a file. |
| `--fail-on <critical\|warning\|notice\|never>` | Set the CI failure threshold. Default: `critical`. |
| `--as-of <YYYY-MM-DD>` | Evaluate deadlines from a fixed date. |
| `--include-docs` | Include Markdown and other prose files. |
| `--provider <openai\|anthropic\|google>` | Limit the catalog to a provider; may be repeated. Default: all providers. |
| `--ignore <glob>` | Add an ignore pattern; may be repeated. |
| `--max-file-size <size>` | Maximum file size, such as `750kb` or `2mb`. Default: `1mb`. |
| `--allow-incomplete` | Do not return exit code 2 when eligible paths could not be scanned. |
| `--no-color` | Disable ANSI color in terminal output. |
| `--quiet, -q` | When writing a file, suppress the terminal summary. |

Lifeline skips common generated, dependency, cache, and VCS directories. It also reads optional glob patterns from `.lifelineignore` at the scan root. Later `!` patterns can re-include files.

Suppress an intentional occurrence inline with `lifeline-ignore`, or suppress the following line with `lifeline-ignore-next-line`:

```js
// lifeline-ignore-next-line -- retained for a compatibility fixture
const retiredModel = "gpt-4-0613";
```

Oversized or unreadable eligible files make coverage incomplete and return exit code 2 by default. Reports include the affected paths and skip-reason counts. Expected exclusions such as ignored directories, unsupported file types, symlinks, and binary files do not make coverage incomplete.

## Evidence reports

JSON and Markdown reports include a SHA-256 evidence digest. The digest covers scanned source contents and relative paths, provider and scan configuration, coverage issues, catalog version, scan date, matches, deadlines, replacements, migration guidance, official source URLs, and stable finding fingerprints. Volatile values such as runtime duration and absolute paths are excluded, so scanning the same content with the same catalog and `--as-of` date produces the same digest while distinct repositories receive distinct evidence.

The digest verifies the normalized evidence payload; it intentionally excludes display-only values such as generation time, runtime duration, and absolute target paths. It is not an identity signature or a guarantee that semantic behavior is unchanged.

## CI

Copy [`examples/github-actions.yml`](examples/github-actions.yml) into `.github/workflows/lifeline.yml`, or start with a simple check:

```yaml
- run: npx --yes @lapointelabs/lifeline scan . --fail-on critical
```

See [exit codes](docs/exit-codes.md) for rollout behavior.

## Library API

```js
import { scan, createReport } from "@lapointelabs/lifeline";

const result = await scan(".", { asOf: "2026-08-04" });
const report = createReport(result);

console.log(report.summary);
```

Select providers through the library API with `providers: ["anthropic", "google"]`.

## Development

```bash
npm test
npm run check
npm run release:check
```

## Scope

Version 0.2 covers the direct OpenAI API, Anthropic-operated Claude platforms, and the Gemini Developer API. Provider-hosted variants such as Azure OpenAI, Amazon Bedrock, and Vertex AI can use different model identifiers and retirement schedules; Lifeline does not apply one provider's dates to another provider's platform.

Lifeline performs static matching. It cannot discover model names assembled entirely at runtime, and a literal identifier in executable source may still be a test fixture or compatibility reference. Use ignore patterns and inline suppressions for reviewed exceptions.

MIT © Lapointe Labs
