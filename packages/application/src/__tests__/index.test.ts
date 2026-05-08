import { describe, expect, it } from "vitest";

import * as application from "../index";

describe("application package entrypoint", () => {
  it("keeps the runtime surface empty until application use cases are exported", () => {
    expect(Object.keys(application)).toEqual([]);
  });
});
