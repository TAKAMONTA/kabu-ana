import { describe, expect, it } from "vitest";
import {
  ATTENTION_SCORE_THRESHOLDS,
  getAttentionBadgeTone,
  shouldShowAttentionScore,
} from "../attentionScore";

describe("attention score display", () => {
  it("hides numeric score when every visible item has the same score", () => {
    expect(shouldShowAttentionScore([0.72, 0.72, 0.72])).toBe(false);
  });

  it("shows numeric score when scores differ", () => {
    expect(shouldShowAttentionScore([0.92, 0.76, 0.61])).toBe(true);
  });

  it("classifies badge tone from shared thresholds", () => {
    expect(getAttentionBadgeTone(ATTENTION_SCORE_THRESHOLDS.high)).toBe("high");
    expect(getAttentionBadgeTone(ATTENTION_SCORE_THRESHOLDS.medium)).toBe("medium");
    expect(getAttentionBadgeTone(ATTENTION_SCORE_THRESHOLDS.medium - 0.01)).toBe("low");
  });
});
