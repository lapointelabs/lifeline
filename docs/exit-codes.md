# Exit codes

Lifeline uses stable exit codes so it can gate pull requests without scraping terminal output.

| Code | Meaning |
| --- | --- |
| `0` | The scan completed and no finding met `--fail-on`. |
| `1` | The scan completed and at least one finding met `--fail-on`. |
| `2` | Lifeline could not run, received invalid input, or completed with incomplete eligible-file coverage. |

Severity order is `notice` < `warning` < `critical`. A shutdown within 30 days, including an already-expired dependency, is critical. A shutdown within 90 days is a warning. Later scheduled shutdowns are notices.

Use `--fail-on never` while introducing Lifeline to an existing repository. The default is `--fail-on critical`.

Oversized and unreadable eligible files make coverage incomplete. Use `--allow-incomplete` only when CI should accept that reduced coverage; the report still records each coverage issue.
