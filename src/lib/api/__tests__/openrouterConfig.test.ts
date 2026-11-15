import { afterEach, describe, expect, it } from "vitest";
import { getOpenRouterApiKey, isOpenRouterConfigured } from "../openrouterConfig";

const original = process.env.OPENROUTER_API_KEY;

describe("isOpenRouterConfigured", () => {
  afterEach(() => {
    if (original === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = original;
  });

  it("rejects a missing key and both placeholder spellings", () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(isOpenRouterConfigured()).toBe(false);
    for (const placeholder of [
      "your_openrouter_api_key_here", // .env.example の値
      "your_openrouter_key_here", // analyze が以前判定していた値
      "   ",
    ]) {
      process.env.OPENROUTER_API_KEY = placeholder;
      expect(isOpenRouterConfigured()).toBe(false);
      expect(getOpenRouterApiKey()).toBeNull();
    }
  });

  it("accepts a real-looking key", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-abc";
    expect(isOpenRouterConfigured()).toBe(true);
    expect(getOpenRouterApiKey()).toBe("sk-or-v1-abc");
  });
});
