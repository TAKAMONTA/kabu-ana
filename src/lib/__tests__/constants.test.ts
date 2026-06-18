import { describe, expect, it } from "vitest";
import { APP_NAME } from "../constants";

describe("app constants", () => {
  it("uses the approved public app name", () => {
    expect(APP_NAME).toBe("kabuana");
  });
});
