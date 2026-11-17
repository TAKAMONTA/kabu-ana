import {
  expect,
  expectNoPageProblems,
  json,
  searchBy,
  test,
} from "./fixtures";

test.describe("トップページ", () => {
  test("エラーなく表示され、スマホ幅で横にはみ出さない", async ({
    page,
    pageProblems,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("combobox", { name: "企業検索" })
    ).toBeVisible();
    await expect(
      page.getByText("迷ったら、サンプル銘柄をタップして体験できます")
    ).toBeVisible();
    // 話題の銘柄（モック）が描画されるまで待つ
    await expect(page.getByText("トヨタ自動車").first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, "横方向のはみ出し(px)").toBeLessThanOrEqual(0);

    expectNoPageProblems(pageProblems);
  });

  test("証券コードで検索すると会社名と円表示の株価が出る", async ({
    page,
    pageProblems,
    apiCalls,
  }) => {
    await page.goto("/");
    await searchBy(page, "7203");

    await expect(
      page.getByRole("heading", { level: 1, name: "トヨタ自動車" })
    ).toBeVisible();
    await expect(page.getByText("¥2,845.5", { exact: true })).toBeVisible();
    expect(apiCalls).toContain("POST /api/search");

    expectNoPageProblems(pageProblems);
  });

  test("見つからないときは検索欄のすぐ下に日本語のエラーが出る", async ({
    page,
    pageProblems,
    apiMocks,
  }) => {
    apiMocks["POST /api/search"] = json({ error: "Not found" }, 404);
    await page.goto("/");
    await searchBy(page, "zzzz");

    const input = page.getByRole("combobox", { name: "企業検索" });
    const alert = page.getByRole("alert").filter({
      hasText: "該当する銘柄が見つかりませんでした",
    });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("検索できませんでした");
    await expect(input).toHaveAttribute("aria-describedby", "search-error");
    await expect(alert).toHaveAttribute("id", "search-error");

    const inputBox = await input.boundingBox();
    const alertBox = await alert.boundingBox();
    expect(inputBox && alertBox).toBeTruthy();
    // 検索欄（と、スマホでは下に並ぶ検索ボタン）のすぐ下にある
    expect(alertBox!.y).toBeGreaterThan(inputBox!.y + inputBox!.height - 1);
    expect(alertBox!.y - (inputBox!.y + inputBox!.height)).toBeLessThan(120);

    // わざと 404 を返しているので、その読み込み失敗のログだけは許容する
    expectNoPageProblems(pageProblems, [/status of 404/]);
  });

  test("日本語入力の変換確定の Enter では検索しない", async ({
    page,
    apiCalls,
  }) => {
    await page.goto("/");
    const input = page.getByRole("combobox", { name: "企業検索" });
    await input.fill("とよた");

    const pressEnter = (isComposing: boolean) =>
      input.evaluate((element, composing) => {
        element.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
            isComposing: composing,
          })
        );
      }, isComposing);

    await pressEnter(true);
    // 検索ボタンの表示が変わらない・検索 API が呼ばれないことを少し待って確かめる
    await page.waitForTimeout(500);
    expect(apiCalls.filter(call => call === "POST /api/search")).toEqual([]);

    // 同じ方法で変換中でない Enter を送ると検索される（テスト自体の確認）
    const searchRequest = page.waitForRequest(
      request =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/search"
    );
    await pressEnter(false);
    await searchRequest;
  });

  test("検索後にロゴを押すと一面に戻る", async ({ page, pageProblems }) => {
    await page.goto("/");
    await searchBy(page, "7203");
    await expect(page.getByText("¥2,845.5", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "kabuana トップへ戻る" }).click();

    await expect(
      page.getByText("迷ったら、サンプル銘柄をタップして体験できます")
    ).toBeVisible();
    await expect(page.getByText("¥2,845.5", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "企業検索" })).toHaveValue(
      ""
    );
    await expect(page).toHaveURL(/\/$/);

    expectNoPageProblems(pageProblems);
  });

  test("ログイン画面は入力欄にラベルがあり、閉じて開き直すと入力が消える", async ({
    page,
    pageProblems,
  }) => {
    await page.goto("/");
    const openButton = page
      .getByRole("banner")
      .getByRole("button", { name: "ログイン", exact: true });

    await openButton.click();
    const dialog = page.getByRole("dialog", { name: "ログイン・新規登録" });
    await expect(dialog).toBeVisible();

    const email = dialog.getByLabel("メールアドレス");
    const password = dialog.getByLabel("パスワード", { exact: true });
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");

    await email.fill("e2e@example.com");
    await password.fill("secret-password");

    await dialog.getByRole("button", { name: "閉じる" }).click();
    await expect(dialog).toBeHidden();

    await openButton.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("メールアドレス")).toHaveValue("");
    await expect(dialog.getByLabel("パスワード", { exact: true })).toHaveValue(
      ""
    );

    expectNoPageProblems(pageProblems);
  });

  test("テーマ切替で <html> の dark クラスが切り替わる", async ({
    page,
    pageProblems,
  }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

    await page
      .getByRole("banner")
      .getByRole("button", { name: "ダークモードに切り替え" })
      .click();
    await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);

    await page
      .getByRole("banner")
      .getByRole("button", { name: "ライトモードに切り替え" })
      .click();
    await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);

    expectNoPageProblems(pageProblems);
  });
});
