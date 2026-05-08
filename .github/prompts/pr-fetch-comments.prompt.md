---
description: "Fetch unresolved comments for a pull request and save a canonical workflow document in docs/tmp"
name: "pr-fetch-comments"
argument-hint: "[pr=active]"
agent: "agent"
---

# PR Fetch Comments

## Inputs

* ${input:pr:active}: (Optional, defaults to `active`) Pull request number, URL, or `active` for the current workspace pull request.

## Requirements

1. Resolve the target pull request from `${input:pr}`. Prefer the active pull request from workspace context. If that is unavailable, infer it from the current branch or ask the user for the pull request identifier.
2. Fetch unresolved pull request review comments and unresolved review threads only. Exclude already resolved or outdated threads unless the platform cannot distinguish them, in which case note that limitation in the report.
3. Save the result as a markdown document at `docs/tmp/{yyyy-MM-dd}-pr{N}-comments.md`, where the date is the current local date and `{N}` is the numeric pull request identifier.
4. Overwrite the target file with a fresh snapshot each time the prompt runs. Treat that file as the canonical workflow artifact for later `pr-triage-comments` and `pr-address-comments` runs.
5. Format the document as a concise review artifact using [docs/tmp/coderabbit-unresolved-pr2.md](../../docs/tmp/coderabbit-unresolved-pr2.md) as the shape reference.
6. Include these sections in the saved file:
   * A title identifying the pull request.
   * Source metadata: pull request URL, fetched timestamp, unresolved count.
   * A summary table at the beginning of the file with these columns in this order: `Severity`, `Code`, `Triage`, `Status`, `Caption`.
   * One section per unresolved thread with file path, line information when available, author, thread URL, quoted comment content, severity, code, triage label, local status, and caption.
7. Set the default `Triage` value to `🟣 pending` for every row unless the source already contains an explicit triage state.
8. Set the default `Status` value to `📝 todo` for every row unless the source already contains an explicit local progress state.
9. Assign a severity to each unresolved thread and sort both the summary table and the detailed thread sections by decreasing severity. Use this priority order unless the review system already provides a stronger severity signal: `Critical`, `High`, `Medium`, `Low`, `Information`.
10. Generate a short issue code for each row using the format `{prefix}-##`, where the prefix matches severity: `C` for `Critical`, `H` for `High`, `M` for `Medium`, `L` for `Low`, and `I` for `Information`. Number each severity bucket independently after sorting, so the first critical item is `C-01`, the second critical item is `C-02`, the first high item is `H-01`, and so on.
11. Write a short caption for each row that summarizes the concern in one line.
12. Prefix severity, triage, and status values with icons for fast scanning. Use these defaults unless the source already provides a stronger visual cue:
   * Severity: `🔴 Critical`, `🟠 High`, `🟡 Medium`, `🔵 Low`, `⚪ Information`
   * Triage: `🟣 pending`, `🛠️ fix`, `🧪 technical_spike`, `⛔ reject`, `🧬 duplicate`, `✅ already_addressed`, `⏸️ defer`, `❓ needs_clarification`
   * Status: `📝 todo`, `🚧 in_progress`, `⛔ blocked`, `✅ done`
13. After saving the file, reply with only the output path, the pull request used, and the unresolved comment count.

## Notes

* Prefer built-in GitHub pull request context when available.
* If tool support is missing, use the available repository tooling to fetch the same data without making up fields.
* Use `Status` for local progress tracking only. Prefer `todo`, `in_progress`, `blocked`, or `done`.
* Keep the text label after each icon so the output still works in plain-text contexts.