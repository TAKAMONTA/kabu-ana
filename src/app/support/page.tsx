import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Mail, Clock, MessageCircle, HelpCircle, AlertTriangle, CheckCircle } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            サポート・お問い合わせ
          </CardTitle>
          <p className="text-center text-muted-foreground">
            ご質問やお困りのことがございましたら、お気軽にお問い合わせください
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* お問い合わせ方法 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">お問い合わせ方法</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Mail className="h-6 w-6 text-blue-600" />
                  <h3 className="text-lg font-medium text-blue-800">メールサポート</h3>
                </div>
                <p className="text-sm text-blue-700 mb-2">
                  support@kabuana.com
                </p>
                <p className="text-xs text-blue-600">
                  通常2営業日以内にご返信いたします
                </p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="h-6 w-6 text-green-600" />
                  <h3 className="text-lg font-medium text-green-800">対応時間</h3>
                </div>
                <p className="text-sm text-green-700 mb-2">
                  平日 9:00 - 18:00（JST）
                </p>
                <p className="text-xs text-green-600">
                  土日祝日はお休みをいただいております
                </p>
              </div>
            </div>
          </section>

          {/* よくある質問 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">よくある質問（FAQ）</h2>
            </div>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 text-foreground">
                  Q: 無料プランでは何ができますか？
                </h3>
                <p className="text-sm text-muted-foreground">
                  A: 無料プランでは、株式検索、リアルタイム株価表示、基本的なチャート表示、
                  企業情報の閲覧が可能です。ログイン不要でご利用いただけます。
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 text-foreground">
                  Q: AI分析機能の精度はどのくらいですか？
                </h3>
                <p className="text-sm text-muted-foreground">
                  A: AI分析は参考情報としてご利用ください。投資判断は必ずご自身の責任で行ってください。
                  分析結果の正確性を保証するものではありません。
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 text-foreground">
                  Q: 対応している市場・銘柄は？
                </h3>
                <p className="text-sm text-muted-foreground">
                  A: 日本株（東証）および米国株（NYSE、NASDAQ）に対応しています。
                  企業名、証券コード、ティッカーシンボルで検索できます。
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 text-foreground">
                  Q: データはどのくらいの頻度で更新されますか？
                </h3>
                <p className="text-sm text-muted-foreground">
                  A: 株価データはほぼリアルタイムで取得されます（15〜20分程度の遅延がある場合があります）。
                  財務データは四半期ごとに更新されます。
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 text-foreground">
                  Q: アカウントの削除方法は？
                </h3>
                <p className="text-sm text-muted-foreground">
                  A: アカウント削除をご希望の場合は、support@kabuana.com までご連絡ください。
                  登録メールアドレスをお知らせいただければ、速やかに対応いたします。
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2 text-foreground">
                  Q: 有料プランの解約方法は？
                </h3>
                <p className="text-sm text-muted-foreground">
                  A: 有料プランの解約は、設定画面またはsupport@kabuana.comへのご連絡で可能です。
                  解約後も契約期間終了までサービスをご利用いただけます。
                </p>
              </div>
            </div>
          </section>

          {/* トラブルシューティング */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-semibold">トラブルシューティング</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium mb-2 text-amber-800">
                  データが表示されない場合
                </h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• ページを再読み込みしてください</li>
                  <li>• ブラウザのキャッシュをクリアしてください</li>
                  <li>• 別のブラウザでお試しください</li>
                  <li>• インターネット接続を確認してください</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium mb-2 text-amber-800">
                  ログインできない場合
                </h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• メールアドレスとパスワードを確認してください</li>
                  <li>• パスワードリセットをお試しください</li>
                  <li>• Cookieが有効になっているか確認してください</li>
                  <li>• 解決しない場合はサポートまでご連絡ください</li>
                </ul>
              </div>
            </div>
          </section>

          {/* お問い合わせの際のお願い */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">お問い合わせの際のお願い</h2>
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-3">
                スムーズな対応のため、以下の情報をお知らせください：
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>お問い合わせの種類（質問・不具合報告・要望など）</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>発生した問題の詳細な説明</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>ご利用のデバイス・ブラウザ情報</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>エラーメッセージ（表示されている場合）</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>スクリーンショット（可能であれば）</span>
                </li>
              </ul>
            </div>
          </section>

          {/* 運営情報 */}
          <section>
            <h2 className="text-xl font-semibold mb-4">運営情報</h2>
            <div className="bg-muted rounded-lg p-4">
              <dl className="text-sm space-y-2">
                <div className="flex">
                  <dt className="font-medium w-32 text-foreground">サービス名:</dt>
                  <dd className="text-muted-foreground">AI Market Analyzer</dd>
                </div>
                <div className="flex">
                  <dt className="font-medium w-32 text-foreground">運営:</dt>
                  <dd className="text-muted-foreground">かぶあな</dd>
                </div>
                <div className="flex">
                  <dt className="font-medium w-32 text-foreground">連絡先:</dt>
                  <dd className="text-muted-foreground">support@kabuana.com</dd>
                </div>
              </dl>
            </div>
          </section>

          <div className="border-t pt-6 mt-8">
            <div className="flex justify-center space-x-4 text-sm">
              <Link href="/terms-of-service" className="text-primary hover:underline">
                利用規約
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/privacy-policy" className="text-primary hover:underline">
                プライバシーポリシー
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/" className="text-primary hover:underline">
                ホームに戻る
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

