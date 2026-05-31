import { afterEach, describe, expect, it } from "vitest";
import { getApiBaseUrl, getApiUrl } from "../apiClient";

const setWindow = (value: unknown) => {
  Object.defineProperty(globalThis, "window", {
    value,
    configurable: true,
  });
};

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("apiClient", () => {
  it("keeps web requests relative even when Capacitor exists on window", () => {
    setWindow({
      Capacitor: {
        isNativePlatform: () => false,
      },
      location: {
        protocol: "http:",
      },
    });

    expect(getApiBaseUrl()).toBe("");
    expect(getApiUrl("/api/top-trading-value")).toBe("/api/top-trading-value");
  });

  it("uses production API on native Capacitor", () => {
    setWindow({
      Capacitor: {
        isNativePlatform: () => true,
      },
      location: {
        protocol: "http:",
      },
    });

    expect(getApiBaseUrl()).toBe("https://kabu-ana.com");
    expect(getApiUrl("/api/top-trading-value")).toBe(
      "https://kabu-ana.com/api/top-trading-value"
    );
  });

  it("uses production API for capacitor protocol", () => {
    setWindow({
      location: {
        protocol: "capacitor:",
      },
    });

    expect(getApiBaseUrl()).toBe("https://kabu-ana.com");
  });
});
