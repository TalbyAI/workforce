---
description: "Triage a PR comments workflow document into fix, technical spike, reject, or other actionable categories"
name: "pr-triage-comments"
argument-hint: "document=... [categories=default]"
agent: "agent"
---

# PR Triage Comments

## Inputs

* ${input:document}: (Required) Path to the markdown comments document produced by `pr-fetch-comments`.
* ${input:categories:default}: (Optional, defaults to `default`) Category set to use. `default` means: `fix`, `technical_spike`, `reject`, `duplicate`, `already_addressed`, `defer`, `needs_clarification`.

## Requirements

1. Read the document at `${input:document}` and identify each discrete triage item. Treat each review thread as one item unless the source clearly groups multiple comments together.
2. Require `${input:document}` explicitly. Do not guess or auto-resolve a comments file for this prompt.
3. For each item, assign exactly one primary triage category. Prefer these categories when `${input:categories}` is `default`:
   * `fix`: valid issue with a clear code or documentation change to make now.
   * `technical_spike`: valid concern, but it needs research, design work, or broader investigation before implementation.
   * `reject`: not a valid issue, based on incorrect assumptions, out of scope, or not worth acting on.
   * `duplicate`: materially overlaps with another item in the same document.
   * `already_addressed`: the concern appears to be resolved already by existing changes.
   * `defer`: valid, but better handled later because it is lower priority or blocked by other work.
   * `needs_clarification`: the concern might be valid, but the document does not provide enough detail to decide.
4. If none of the default categories fit, introduce one short replacement label and explain why the default set was insufficient.
5. For each item, provide:
   * a stable item identifier derived from the comment code or list order
   * the assigned triage category
   * a local status: `todo`, `in_progress`, `blocked`, or `done`
   * a confidence level: `high`, `medium`, or `low`
   * a short rationale grounded in the source text
   * a recommended next action
6. If the document already includes severity, code, file path, or line references, preserve them in the output.
7. Save the triage result back into `${input:document}` instead of returning a chat-only answer.
8. Update the markdown review artifact in place:
   * replace the existing summary table so it includes `Severity`, `Code`, `Triage`, `Status`, and `Caption` in that order
   * update per-item metadata lines so each item includes both `Triage` and `Status`
   * add or replace a `## Triage Review` section with a markdown table using these columns in this order: `Item`, `Category`, `Status`, `Confidence`, `Why`, `Next Action`
9. After the table, add a short `## Notes` section that lists:
   * duplicate groupings
   * items that need clarification
   * any proposed new category labels
10. Do not invent evidence that is not present in the document. When the source is ambiguous, prefer `needs_clarification` or `technical_spike` over pretending certainty.
11. Prefix severity, triage, and status values with icons for fast scanning. Use these defaults unless the document already defines a different convention:
   * Severity: `🔴 Critical`, `🟠 High`, `🟡 Medium`, `🔵 Low`, `⚪ Information`
   * Triage: `🛠️ fix`, `🧪 technical_spike`, `⛔ reject`, `🧬 duplicate`, `✅ already_addressed`, `⏸️ defer`, `❓ needs_clarification`, `🟣 pending`
   * Status: `📝 todo`, `🚧 in_progress`, `⛔ blocked`, `✅ done`
12. After saving the file, reply with only the updated path, item count, and any new category labels introduced.
13. Keep the response concise and decision-oriented.

## Notes

* This prompt is intended for PR comments workflow documents, not generic issue lists.
* If `${input:document}` is missing or cannot be resolved, ask for the path instead of guessing.
* Use `done` when the concern is already addressed in the current branch.
* Keep the text label after each icon so the output remains searchable and unambiguous.