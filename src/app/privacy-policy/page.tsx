import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            プライバシーポリシー
          </CardTitle>
          <p className="text-center text-muted-foreground">
            最終更新日: 2025年10月24日
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. はじめに</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI Market Analyzer（以下「本アプリ」）は、ユーザーのプライバシーを尊重し、
              個人情報の保護に努めます。本プライバシーポリシーは、本アプリがどのような情報を収集し、
              どのように使用するかについて説明します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. 収集する情報</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">2.1 自動収集情報</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>IPアドレス（セキュリティ目的）</li>
                  <li>ブラウザ情報（技術的サポート目的）</li>
                  <li>アクセス日時（サービス改善目的）</li>
                  <li>使用デバイス情報（最適化目的）</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">2.2 ユーザー入力情報</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>検索クエリ（企業名、証券コード等）</li>
                  <li>認証情報（ログイン時のみ）</li>
                  <li>設定情報（ユーザー設定）</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 情報の使用目的</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">3.1 サービス提供</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>株式情報の検索と表示</li>
                  <li>AI分析機能の提供</li>
                  <li>チャートデータの表示</li>
                  <li>ニュース情報の提供</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">3.2 サービス改善</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>アプリのパフォーマンス向上</li>
                  <li>新機能の開発</li>
                  <li>ユーザー体験の改善</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. データの保存期間</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">4.1 自動収集データ</h3>
                <p className="text-sm text-muted-foreground">
                  ログデータ: 最大90日間保存後、自動削除
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">4.2 ユーザー入力データ</h3>
                <p className="text-sm text-muted-foreground">
                  検索クエリ: セッション終了時に削除<br />
                  認証情報: アカウント削除まで保存
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. データの共有</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">5.1 第三者との共有</h3>
                <p className="text-sm text-muted-foreground">
                  本アプリは、以下の場合を除き、個人情報を第三者と共有しません：
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
                  <li>ユーザーの明示的な同意がある場合</li>
                  <li>法的義務に基づく場合</li>
                  <li>サービス提供に必要な場合（API連携等）</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">5.2 外部サービス連携</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>SERPAPI: 検索データ取得</li>
                  <li>OpenRouter: AI分析処理</li>
                  <li>Financial Modeling Prep: 財務データ取得</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. ユーザーの権利</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">6.1 データアクセス権</h3>
                <p className="text-sm text-muted-foreground">
                  ユーザーは、自分の個人情報の内容を確認する権利があります。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">6.2 データ削除権</h3>
                <p className="text-sm text-muted-foreground">
                  ユーザーは、自分の個人情報の削除を要求する権利があります。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">6.3 データ修正権</h3>
                <p className="text-sm text-muted-foreground">
                  ユーザーは、不正確な個人情報の修正を要求する権利があります。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. セキュリティ対策</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">7.1 技術的対策</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>HTTPS通信による暗号化</li>
                  <li>APIキーの安全な管理</li>
                  <li>定期的なセキュリティ監査</li>
                  <li>アクセス制限の実装</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">7.2 組織的対策</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>アクセス権限の管理</li>
                  <li>従業員の教育・訓練</li>
                  <li>インシデント対応体制</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. クッキー（Cookie）の使用</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本アプリは、サービス提供のために必要なクッキーを使用します。
              クッキーの使用は、ユーザー体験の向上とセキュリティの確保を目的としています。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. プライバシーポリシーの変更</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本プライバシーポリシーは、必要に応じて変更される場合があります。
              重要な変更がある場合は、アプリ内で通知いたします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. お問い合わせ</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                プライバシーポリシーに関するご質問やご要望がございましたら、
                以下の連絡先までお問い合わせください。
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">連絡先情報</h3>
                <p className="text-sm text-muted-foreground">
                  アプリ名: AI Market Analyzer<br />
                  連絡先: support@kabuana.com<br />
                  対応時間: 平日 9:00-18:00（JST）
                </p>
              </div>
            </div>
          </section>

          <div className="border-t pt-6 mt-8">
            <p className="text-xs text-muted-foreground text-center">
              本プライバシーポリシーは、日本の個人情報保護法および
              関連する法令に準拠して作成されています。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
