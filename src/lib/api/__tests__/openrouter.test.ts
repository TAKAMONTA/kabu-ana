import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OpenRouterClient,
  buildAnalysisPrompt,
  extractJsonFromContent,
  parseJsonFromAiContent,
} from "../openrouter";

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
                analysisConclusion:
                  "収益性は安定している一方、材料の持続性が焦点です。次は利益率と受注動向を確認したい局面です。",
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
    expect(result.analysisConclusion).toBe(
      "収益性は安定している一方、材料の持続性が焦点です。次は利益率と受注動向を確認したい局面です。"
    );
    expect(post).toHaveBeenCalledTimes(1);
    const payload = post.mock.calls[0]![1] as {
      max_tokens: number;
      messages: Array<{ content: string }>;
    };
    expect(payload).toMatchObject({
      max_tokens: 2500,
    });
    expect(payload.messages[1]!.content).toContain('"analysisConclusion"');
    expect(payload.messages[1]!.content).toContain('"aiReflection"');
  });

  it("builds analysis prompt with causal narrative structure", () => {
    const streamingPrompt = buildAnalysisPrompt(
      { name: "Example", symbol: "EX", market: "NASDAQ" },
      { price: 100, change: 1, changePercent: 1 },
      [],
      true
    );
    const jsonPrompt = buildAnalysisPrompt(
      { name: "Example", symbol: "EX", market: "NASDAQ" },
      { price: 100, change: 1, changePercent: 1 },
      [],
      false
    );

    for (const prompt of [streamingPrompt, jsonPrompt]) {
      expect(prompt).toContain("ファクト");
      expect(prompt).toContain("意味");
      expect(prompt).toContain("だから私は");
      expect(prompt).toContain("指標を並べるだけ");
      expect(prompt).toContain("指標の意味づけ");
    }

    expect(streamingPrompt).toContain("良い例");
    expect(streamingPrompt).toContain("悪い例");
  });

  it("extracts JSON from fenced AI responses", () => {
    const fenced = 'Here is the result:\n```json\n{"impact":"positive","impactScore":42}\n```';
    expect(extractJsonFromContent(fenced)).toBe(
      '{"impact":"positive","impactScore":42}'
    );
    const parsed = parseJsonFromAiContent<{ impact: string; impactScore: number }>(
      fenced
    );
    expect(parsed.impact).toBe("positive");
    expect(parsed.impactScore).toBe(42);
  });

  it("parses financial evaluation from fenced JSON", async () => {
    const post = vi.mocked(axios.post);
    post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: `\`\`\`json
{
  "bs": { "score": 4, "summary": "自己資本比率は良好" },
  "pl": { "score": 5, "summary": "高い利益率" },
  "cf": { "score": 4, "summary": "FCFは黒字" },
  "overall": { "score": 4, "label": "総合評価" },
  "analysis": "財務体質は強い",
  "recommendations": ["次期決算を確認"]
}
\`\`\``,
            },
          },
        ],
      },
    });

    const client = new OpenRouterClient("openrouter-key");
    const result = await client.analyzeFinancials("Example", "EX", {});

    expect(result.parseFailed).toBeUndefined();
    expect(result.bs.summary).toBe("自己資本比率は良好");
    expect(result.pl.score).toBe(5);
    expect(result.analysis).toBe("財務体質は強い");
  });

  it("parses news analysis from fenced JSON", async () => {
    const post = vi.mocked(axios.post);
    post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: `\`\`\`json
{
  "impact": "positive",
  "impactScore": 30,
  "analysis": "好材料が中心",
  "keyPoints": ["新製品発表"],
  "recommendations": ["売上への寄与を確認"]
}
\`\`\``,
            },
          },
        ],
      },
    });

    const client = new OpenRouterClient("openrouter-key");
    const result = await client.analyzeNewsImpact("Example", "EX", [
      { title: "ニュース", snippet: "概要", source: "test", date: "2026-01-01" },
    ]);

    expect(result.parseFailed).toBeUndefined();
    expect(result.impact).toBe("positive");
    expect(result.analysis).toBe("好材料が中心");
    expect(result.keyPoints).toEqual(["新製品発表"]);
  });

  it("marks financial evaluation as failed when JSON is invalid", async () => {
    const post = vi.mocked(axios.post);
    post.mockResolvedValue({
      data: {
        choices: [{ message: { content: "not json at all" } }],
      },
    });

    const client = new OpenRouterClient("openrouter-key");
    const result = await client.analyzeFinancials("Example", "EX", {});

    expect(result.parseFailed).toBe(true);
    expect(result.analysis).toContain("読み取れませんでした");
  });
});
