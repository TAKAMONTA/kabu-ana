import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenRouterClient } from "../openrouter";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    isAxiosError: vi.fn(() => false),
  },
}));

describe("OpenRouterClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the analysis and AI reflection from one OpenRouter request", async () => {
    const post = vi.mocked(axios.post);
    post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                investmentAdvice: "参考情報として中立に確認します。",
                targetPrice: {
                  shortTerm: 100,
                  mediumTerm: 110,
                  longTerm: 120,
                },
                stopLoss: {
                  shortTerm: 90,
                  mediumTerm: 85,
                  longTerm: 80,
                },
                riskLevel: "medium",
                confidence: 70,
                keyFactors: ["材料"],
                recommendations: ["分散して確認"],
                swot: {
                  strengths: ["強み"],
                  weaknesses: ["弱み"],
                  opportunities: ["機会"],
                  threats: ["脅威"],
                },
                aiReflection: "長期の事業変化を見たい銘柄です。",
              }),
            },
          },
        ],
      },
    });

    const client = new OpenRouterClient("openrouter-key");
    const result = await client.analyzeStock(
      { name: "Example", symbol: "EX", market: "NASDAQ" },
      { price: 100, change: 1, changePercent: 1 },
      []
    );

    expect(result.aiReflection).toBe("長期の事業変化を見たい銘柄です。");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      max_tokens: 2500,
    });
    expect(post.mock.calls[0][1].messages[1].content).toContain(
      "\"aiReflection\""
    );
  });
});
