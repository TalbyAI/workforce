---
description: "Address items from a triaged PR comments workflow document and update the same document as work progresses"
name: "pr-address-comments"
argument-hint: "document=... [code=...]"
---

# PR Address Comments

## Inputs

* ${input:document}: (Required) Path to the triaged markdown comments document to process.
* ${input:code}: (Optional) One comment code to target, such as `H-01`. When omitted, process all addressable `📝 todo` items in the document.

## Requirements

1. Read the document at `${input:document}`. Require this path explicitly. Do not guess or auto-resolve a comments file for this prompt.
2. Identify scope from the inputs:
   * If `${input:code}` is provided, process only that item.
   * Otherwise, process all items whose current `Status` is `📝 todo` and whose triage can be advanced by the current run.
3. Work item by item. After each item, update the same document in place before moving to the next item.
4. Use the current triage category to choose the action:
   * `🛠️ fix`: make the required code or documentation change now, run the narrowest relevant validation, then update the item metadata, summary table, and `## Triage Review` row. Mark `Status` as `✅ done` only when the fix is implemented and validated.
   * `❓ needs_clarification`: ask the user the minimum question needed to unblock the item, record the question and answer in the item section, then re-triage the item based on the new evidence. Do not mark the item `✅ done` in this path.
   * `🧪 technical_spike`: create a concise spike artifact at `docs/tmp/{yyyy-MM-dd}-pr{N}-{code}-spike.md` when enough information exists, record the artifact path and findings in the item section, then re-triage the item based on the new evidence. Do not mark the item `✅ done` in this path.
   * `⛔ reject`, `✅ already_addressed`, `⏸️ defer`, or `🧬 duplicate`: record the rationale or cross-reference needed to make the state explicit, then update the document without attempting a code change.
5. When evidence is strong, you may auto-update `Triage` during the run. After a clarification or spike, an item may move to `🛠️ fix` or `⛔ reject`.
6. If an item's triage changes during the run, stop after updating the document unless that item was explicitly selected by `${input:code}` and the user has made it clear that the current run should continue with the new scope.
7. For non-fix paths, do not use `✅ done`. Leave `Status` as `⛔ blocked` unless a validated code or documentation fix was completed in this run.
8. Preserve existing severity, code, file path, line references, and quoted comment text.
9. Keep the summary table, per-item metadata lines, and `## Triage Review` section synchronized after every item update.
10. If the item cannot be progressed responsibly from the available evidence, ask the user instead of guessing.
11. Prefer the narrowest validation that can falsify the change you made. If no focused validation exists, state that in the item notes.
12. After saving the document, reply with only the updated path, the processed item count, and the processed codes.

## Notes

* Default batch behavior is for addressable `📝 todo` items only.
* A later run may continue after clarification or spike work changed the triage.
* Keep the comments document as the canonical workflow artifact. Do not create a separate triaged copy.
