# Lifeline

Find AI APIs and models that will break before they break production.

Lifeline is a local-first repository scanner for dated AI platform deprecations. It identifies the file and line using a deprecated OpenAI model or API, shows the shutdown deadline and replacement, and produces an integrity-addressed report suitable for CI or a migration handoff.

```bash
npx @lapointelabs/lifeline scan .
```

No account, API key, source upload, or configuration is required. The scanner has no runtime dependencies and never makes a network request.

## What it catches

- Assistants API and Threads usage before the August 26, 2026 shutdown.
- Reusable Prompt, Evals platform, and Videos API calls.
- Deprecated and recently retired OpenAI model identifiers.
- Current scheduled audio, realtime, image, GPT, o-series, and Sora retirements.

Every rule links to the official [OpenAI deprecation schedule](https://developers.openai.com/api/docs/deprecations). Assistants findings also link to the official [migration guide](https://developers.openai.com/api/docs/assistants/migration).

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
| `--ignore <glob>` | Add an ignore pattern; may be repeated. |
| `--max-file-size <size>` | Maximum file size, such as `750kb` or `2mb`. Default: `1mb`. |
| `--no-color` | Disable ANSI color in terminal output. |
| `--quiet, -q` | When writing a file, suppress the terminal summary. |

Lifeline skips common generated, dependency, cache, and VCS directories. It also reads optional patterns from `.lifelineignore` at the scan root.

## Evidence reports

JSON and Markdown reports include a SHA-256 evidence digest. The digest covers the scanned source contents and relative paths, scan coverage and errors, scan date, catalog version, matches, deadlines, and replacements. Volatile values such as runtime duration and absolute paths are excluded, so scanning the same content with the same Lifeline catalog and `--as-of` date produces the same digest while distinct repositories receive distinct evidence.

The digest proves report integrity; it is not an identity signature or a guarantee that semantic behavior is unchanged. Static matching also cannot discover model names assembled entirely at runtime.

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

## Development

```bash
npm test
npm run check
npm run release:check
```

## Scope

Version 0.1 intentionally begins with OpenAI because the Assistants API deadline is urgent and the official migration has several non-equivalent runtime behaviors. The catalog is structured for additional providers, but Lifeline does not claim coverage it has not implemented.

MIT © Lapointe Labs
