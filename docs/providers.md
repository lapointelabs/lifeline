# Provider coverage

Catalog version `2026.08.04.2` was reviewed on August 4, 2026.

| Provider selector | Covered platform | Official schedule | Date semantics |
| --- | --- | --- | --- |
| `openai` | OpenAI API | [OpenAI API deprecations](https://developers.openai.com/api/docs/deprecations) | Scheduled shutdown dates |
| `anthropic` | Anthropic-operated Claude API platforms | [Anthropic model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) | Scheduled retirement dates |
| `google` | Gemini Developer API | [Gemini deprecations](https://ai.google.dev/gemini-api/docs/deprecations) | Earliest published shutdown dates |

Dates are not portable between hosting platforms. Azure OpenAI, Amazon Bedrock, Google Cloud Vertex AI, and other partner-operated services may expose related models under different identifiers and lifecycle schedules. Lifeline only reports the schedule named in each finding's official source.

Rules without a dated shutdown are not included in the scanner. For example, a provider may mark a preview model deprecated before publishing its retirement date; Lifeline will add a dated rule once the official schedule supplies one.
