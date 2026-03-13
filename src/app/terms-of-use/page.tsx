import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfUsePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            利用規約
          </CardTitle>
          <p className="text-center text-muted-foreground">
            最終更新日: 2026年3月12日
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. はじめに</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本利用規約（以下「本規約」）は、AI Market Analyzer（以下「本アプリ」）の利用に関する条件を定めるものです。
              本アプリを利用することにより、ユーザーは本規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. サービス内容</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本アプリは、AI技術を活用した株式市場の分析ツールです。以下の機能を提供します：
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mt-2">
              <li>株式情報の検索・表示</li>
              <li>AIによる株式分析レポート</li>
              <li>財務健全性評価</li>
              <li>ニュース分析</li>
              <li>株価チャート表示</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. アカウント</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">3.1 アカウント作成</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  プレミアム機能をご利用いただくには、メールアドレスとパスワードによるアカウント登録が必要です。
                  ユーザーは正確かつ最新の情報を提供する責任を負います。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">3.2 アカウント削除</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  ユーザーは、いつでもアプリ内の「アカウントを削除する」ボタンからアカウントを削除することができます。
                  アカウントを削除すると、関連するすべてのデータ（サブスクリプション情報を含む）が完全に削除され、
                  この操作は取り消すことができません。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. サブスクリプション（自動更新課金）</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">4.1 プラン内容</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  本アプリでは以下の自動更新サブスクリプションを提供しています：
                </p>
                <div className="bg-muted p-4 rounded-lg mt-2 space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold">プレミアム月額プラン:</span>{" "}
                    月額 ¥700（税込）/ 1ヶ月ごとに自動更新
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">プレミアム年額プラン:</span>{" "}
                    年額 ¥7,000（税込）/ 1年ごとに自動更新
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">4.2 課金・更新</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>お支払いは、購入確認時にApple IDアカウントに請求されます。</li>
                  <li>サブスクリプションは、現在の期間終了の少なくとも24時間前に自動更新をオフにしない限り、自動的に更新されます。</li>
                  <li>更新料金は、現在の期間終了前の24時間以内にアカウントに請求されます。</li>
                  <li>購入後、サブスクリプションの管理と自動更新のキャンセルは、Apple IDアカウントの設定から行えます。</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">4.3 キャンセル</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  サブスクリプションはいつでもキャンセルできます。キャンセルは、お使いのデバイスの「設定」＞「Apple ID」＞「サブスクリプション」から行えます。
                  キャンセル後も、現在の課金期間の終了まではプレミアム機能をご利用いただけます。
                  サブスクリプション期間中の返金は行われません。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">4.4 無料トライアル</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  無料トライアルが提供される場合、トライアル期間の未使用分は、ユーザーがサブスクリプションを購入した時点で失効します。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. 免責事項</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">5.1 投資に関する免責</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  本アプリが提供する情報やAI分析結果は、情報提供の目的のみに使用されます。
                  投資助言や投資の推奨を目的としたものではありません。
                  投資判断はユーザー自身の責任で行ってください。
                  本アプリの情報に基づく投資判断により生じた損失について、
                  当社は一切の責任を負いません。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">5.2 サービスの可用性</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  本アプリは「現状のまま」提供されます。サービスの中断、エラー、
                  データの不正確さについて保証するものではありません。
                  メンテナンスやシステム障害等により、予告なくサービスが中断される場合があります。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. 知的財産権</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本アプリのコンテンツ、デザイン、ソフトウェアに関する知的財産権は、
              当社または正当なライセンス所有者に帰属します。
              ユーザーは、個人的な非営利目的でのみ本アプリを使用できます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 禁止事項</h2>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>本アプリの不正利用、リバースエンジニアリング</li>
              <li>他のユーザーの利用を妨げる行為</li>
              <li>アプリの機能を悪用した行為</li>
              <li>自動化ツールによる過度なアクセス</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 規約の変更</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              当社は、必要に応じて本規約を変更する権利を有します。
              重要な変更がある場合は、アプリ内で通知いたします。
              変更後も本アプリの利用を継続した場合、変更後の規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 準拠法</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本規約は、日本法に準拠し解釈されるものとします。
              本規約に関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. お問い合わせ</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                本規約に関するご質問がございましたら、以下の連絡先までお問い合わせください。
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

          <section>
            <h2 className="text-xl font-semibold mb-3">Apple標準利用規約（EULA）</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本アプリのご利用には、Apple Inc.の標準エンドユーザーライセンス契約（EULA）も適用されます。
              詳細は以下のリンクをご確認ください：
            </p>
            <a
              href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              Apple標準EULA（英語）
            </a>
          </section>

          <div className="border-t pt-6 mt-8">
            <p className="text-xs text-muted-foreground text-center">
              本利用規約は、日本の法令に準拠して作成されています。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
