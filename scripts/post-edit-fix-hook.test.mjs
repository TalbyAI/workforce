import path from "node:path";
import { describe, expect, it } from "vitest";

import { isPathWithinRoot } from "./post-edit-fix-hook.mjs";

describe("isPathWithinRoot", () => {
  // Scenario: repo containment check rejects sibling paths that only share the prefix.
  it("rejects sibling directories with the same prefix as the repo root", () => {
    const repoRoot = path.join("E:", "talby", "talby-workforce");
    const siblingPath = path.join(
      "E:",
      "talby",
      "talby-workforce-malicious",
      "scripts",
      "evil.mjs"
    );

    expect(isPathWithinRoot(siblingPath, repoRoot)).toBe(false);
  });

  // Scenario: repo containment check still accepts files inside the repo tree.
  it("accepts files that are inside the repo root", () => {
    const repoRoot = path.join("E:", "talby", "talby-workforce");
    const nestedPath = path.join(
      repoRoot,
      "packages",
      "application",
      "src",
      "index.ts"
    );

    expect(isPathWithinRoot(nestedPath, repoRoot)).toBe(true);
  });
});
