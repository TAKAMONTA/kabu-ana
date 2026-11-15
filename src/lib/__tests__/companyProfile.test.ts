import { describe, expect, it } from "vitest";
import {
  COLLAPSIBLE_DESCRIPTION_LENGTH,
  getCompanyProfileView,
} from "../companyProfile";

describe("getCompanyProfileView", () => {
  it("市場区分・業種だけの短い表記は「市場・業種」とし、折りたたまない", () => {
    expect(getCompanyProfileView("プライム / 輸送用機器")).toEqual({
      title: "市場・業種",
      text: "プライム / 輸送用機器",
      collapsible: false,
    });
    expect(getCompanyProfileView("輸送用機器")?.title).toBe("市場・業種");
  });

  it("文章の説明は「会社概要」とし、長いときだけ折りたたむ", () => {
    const short = "自動車の製造・販売を行う。海外売上比率が高い。";
    expect(getCompanyProfileView(short)).toEqual({
      title: "会社概要",
      text: short,
      collapsible: false,
    });

    const long = "あ".repeat(COLLAPSIBLE_DESCRIPTION_LENGTH + 1) + "。";
    expect(getCompanyProfileView(long)?.collapsible).toBe(true);
  });

  it("空の説明は表示しない", () => {
    expect(getCompanyProfileView("")).toBeNull();
    expect(getCompanyProfileView("   ")).toBeNull();
    expect(getCompanyProfileView(undefined)).toBeNull();
  });
});
