import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            利用規約
          </CardTitle>
          <p className="text-center text-muted-foreground">
            最終更新日: 2026年1月2日
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. はじめに</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              この利用規約（以下「本規約」）は、AI Market Analyzer（以下「本サービス」）の
              利用条件を定めるものです。本サービスを利用することにより、ユーザーは本規約に
              同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. サービスの概要</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                本サービスは、人工知能（AI）を活用した株式分析ツールです。以下の機能を提供します：
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>企業検索とリアルタイム株価表示</li>
                <li>AIによる投資分析とアドバイス</li>
                <li>インタラクティブな株価チャート</li>
                <li>主要財務指標の表示</li>
                <li>最新ニュースの自動収集と分析</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 免責事項（重要）</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2 text-amber-800">3.1 投資アドバイスではありません</h3>
                <p className="text-sm text-amber-700">
                  本サービスが提供する情報およびAI分析結果は、一般的な情報提供を目的としており、
                  投資アドバイス、投資勧誘、または投資推奨を構成するものではありません。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2 text-amber-800">3.2 投資判断の責任</h3>
                <p className="text-sm text-amber-700">
                  投資に関する最終的な判断は、ユーザー自身の責任において行ってください。
                  本サービスの情報に基づいて行った投資判断により生じた損失について、
                  当社は一切の責任を負いません。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2 text-amber-800">3.3 情報の正確性</h3>
                <p className="text-sm text-amber-700">
                  本サービスは、提供する情報の正確性、完全性、最新性について保証しません。
                  株価データ、財務情報、AI分析結果には誤りが含まれる可能性があります。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. 利用条件</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">4.1 利用資格</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>18歳以上であること</li>
                  <li>本規約に同意すること</li>
                  <li>日本国内からのアクセスであること（推奨）</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">4.2 禁止事項</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>本サービスの不正利用・悪用</li>
                  <li>自動化ツールによる大量アクセス</li>
                  <li>他のユーザーへの迷惑行為</li>
                  <li>サービスの改変・リバースエンジニアリング</li>
                  <li>商用目的での無断利用</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. アカウント</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">5.1 アカウント管理</h3>
                <p className="text-sm text-muted-foreground">
                  ユーザーは、自身のアカウント情報を適切に管理する責任があります。
                  パスワードの漏洩による不正利用について、当社は責任を負いません。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">5.2 アカウント停止</h3>
                <p className="text-sm text-muted-foreground">
                  本規約に違反した場合、当社はユーザーのアカウントを
                  事前通知なく停止または削除する権利を有します。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. 有料サービス</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-lg font-medium mb-2">6.1 料金</h3>
                <p className="text-sm text-muted-foreground">
                  有料プランの料金は、サービス内に表示された金額とします。
                  料金は予告なく変更される場合があります。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">6.2 返金ポリシー</h3>
                <p className="text-sm text-muted-foreground">
                  デジタルサービスの性質上、購入後の返金は原則として行いません。
                  ただし、サービスの重大な不具合がある場合は個別に対応いたします。
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 知的財産権</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本サービスに関するすべての知的財産権は、当社または正当な権利者に帰属します。
              ユーザーは、本サービスのコンテンツを個人的・非商用目的でのみ利用できます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. サービスの変更・終了</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              当社は、事前通知なくサービスの内容を変更、または提供を終了する場合があります。
              サービスの変更・終了により生じた損害について、当社は責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 損害賠償の制限</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本サービスの利用により生じた損害について、当社の責任は、
              ユーザーが過去12ヶ月間に支払った利用料金を上限とします。
              間接損害、特別損害、逸失利益については責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. 準拠法・管轄</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              本規約は日本法に準拠し、本規約に関する紛争については、
              東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. 規約の変更</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              当社は、必要に応じて本規約を変更する場合があります。
              重要な変更がある場合は、サービス内で通知いたします。
              変更後も本サービスを利用し続けることで、変更後の規約に同意したものとみなされます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. お問い合わせ</h2>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                本規約に関するご質問がございましたら、以下の連絡先までお問い合わせください。
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">連絡先情報</h3>
                <p className="text-sm text-muted-foreground">
                  サービス名: AI Market Analyzer<br />
                  運営: かぶあな<br />
                  連絡先: support@kabuana.com<br />
                  対応時間: 平日 9:00-18:00（JST）
                </p>
              </div>
            </div>
          </section>

          <div className="border-t pt-6 mt-8">
            <div className="flex justify-center space-x-4 text-sm">
              <Link href="/privacy-policy" className="text-primary hover:underline">
                プライバシーポリシー
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/support" className="text-primary hover:underline">
                サポート
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

