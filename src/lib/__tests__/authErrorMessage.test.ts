import { describe, expect, it } from "vitest";
import { extractAuthErrorCode, toAuthErrorMessage } from "../authErrorMessage";
import { NETWORK_ERROR_MESSAGE } from "../friendlyError";

describe("extractAuthErrorCode", () => {
  it("error.code を優先して取り出す", () => {
    expect(
      extractAuthErrorCode({ code: "auth/wrong-password", message: "x" })
    ).toBe("auth/wrong-password");
  });

  it("code が無くても Firebase の message からコードを拾う", () => {
    expect(
      extractAuthErrorCode({
        message: "Firebase: Error (auth/invalid-credential).",
      })
    ).toBe("auth/invalid-credential");
    expect(
      extractAuthErrorCode("Firebase: Error (auth/too-many-requests).")
    ).toBe("auth/too-many-requests");
  });

  it("コードが無いものは null", () => {
    expect(extractAuthErrorCode(new Error("boom"))).toBeNull();
    expect(extractAuthErrorCode(null)).toBeNull();
    expect(extractAuthErrorCode(42)).toBeNull();
  });
});

describe("toAuthErrorMessage", () => {
  it("認証情報の誤りはどれも同じ案内にする（どちらが違うかは明かさない）", () => {
    for (const code of [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
      "auth/invalid-login-credentials",
    ]) {
      expect(toAuthErrorMessage({ code }, "login")).toBe(
        "メールアドレスまたはパスワードが違います。"
      );
    }
  });

  it("登録時のよくあるエラーを日本語にする", () => {
    expect(
      toAuthErrorMessage({ code: "auth/email-already-in-use" }, "register")
    ).toContain("すでに登録されています");
    expect(toAuthErrorMessage({ code: "auth/weak-password" }, "register")).toBe(
      "パスワードは6文字以上で設定してください。"
    );
    expect(toAuthErrorMessage({ code: "auth/invalid-email" }, "register")).toBe(
      "メールアドレスの形式が正しくありません。"
    );
  });

  it("通信エラーと試行回数超過を案内する", () => {
    expect(
      toAuthErrorMessage({ code: "auth/network-request-failed" }, "login")
    ).toBe(NETWORK_ERROR_MESSAGE);
    expect(
      toAuthErrorMessage({ code: "auth/too-many-requests" }, "login")
    ).toContain("しばらく待って");
  });

  it("パスワード再設定で未登録のときは専用の案内にする", () => {
    expect(
      toAuthErrorMessage({ code: "auth/user-not-found" }, "resetPassword")
    ).toBe("このメールアドレスで登録されたアカウントが見つかりませんでした。");
  });

  it("未知のコードや英語の生メッセージは操作ごとの既定文言にし、英語を出さない", () => {
    const login = toAuthErrorMessage(
      new Error("Firebase: Error (auth/internal-error)."),
      "login"
    );
    expect(login).toBe("ログインできませんでした。もう一度お試しください。");
    expect(login).not.toMatch(/Firebase|auth\//);
    expect(toAuthErrorMessage(new Error("boom"), "register")).toBe(
      "アカウントを作成できませんでした。もう一度お試しください。"
    );
  });
});
