/**
 * 検索結果の companyInfo.description の見せ方を決める。
 * 日本株は「プライム / 輸送用機器」や「輸送用機器」のような市場区分・業種だけが
 * 入ることが多く、それを「会社概要」と呼んで「続きを読む」を出すと、
 * 押しても何も増えないボタンになってしまう。
 */

/** これより短く、文として書かれていないものは市場区分・業種の短い表記とみなす */
const SHORT_LABEL_MAX_LENGTH = 40;
/** これより長いときだけ折りたたむ（スマホ幅で 10 行前後） */
export const COLLAPSIBLE_DESCRIPTION_LENGTH = 200;

export interface CompanyProfileView {
  title: "会社概要" | "市場・業種";
  text: string;
  collapsible: boolean;
}

export function getCompanyProfileView(
  description: string | null | undefined
): CompanyProfileView | null {
  const text = (description ?? "").trim();
  if (!text) return null;

  const isShortLabel =
    text.length <= SHORT_LABEL_MAX_LENGTH && !/[。．.!?！？]/.test(text);
  if (isShortLabel) {
    return { title: "市場・業種", text, collapsible: false };
  }

  return {
    title: "会社概要",
    text,
    collapsible: text.length > COLLAPSIBLE_DESCRIPTION_LENGTH,
  };
}
