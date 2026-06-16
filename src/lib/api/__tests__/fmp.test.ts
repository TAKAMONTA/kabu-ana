import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FMPClient, resetFMPAccessCacheForTests } from "../fmp";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

describe("FMPClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFMPAccessCacheForTests();
  });

  it("stops comprehensive search after the first forbidden response", async () => {
    const get = vi.mocked(axios.get);
    get.mockRejectedValueOnce({
      message: "Request failed with status code 403",
      response: { status: 403 },
    });

    const client = new FMPClient("restricted-key");
    const results = await client.comprehensiveSearch("7203");

    expect(results).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("skips FMP requests for new clients after a forbidden response", async () => {
    const get = vi.mocked(axios.get);
    get.mockRejectedValueOnce({
      message: "Request failed with status code 403",
      response: { status: 403 },
    });

    await new FMPClient("restricted-key").comprehensiveSearch("7203");
    get.mockClear();

    const results = await new FMPClient("restricted-key").comprehensiveSearch("SOFI");

    expect(results).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});
