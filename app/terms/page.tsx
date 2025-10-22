"use client";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">利用規約</h1>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第1条：サービス概要
            </h2>
            <p>
              本規約は、株価分析AIカードサービス（以下「本サービス」）の利用条件を定めるものです。
              登録ユーザーの方は、本規約に同意の上、本サービスをご利用いただきます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第2条：利用登録
            </h2>
            <p>
              本サービスの利用を希望する方は、本規約に同意の上、本サービスが定める方法により利用登録を行ってください。
              本サービスは、登録申請を審査し、利用登録を承認するものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第3条：投資判断について
            </h2>
            <p className="font-semibold text-red-600 mb-2">重要</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                本サービスで提供される情報は、投資判断の参考情報であり、投資勧誘を目的としたものではありません。
              </li>
              <li>
                投資は自己責任で行い、本サービスは投資結果について一切の責任を負いません。
              </li>
              <li>
                本サービスの情報を参考にした投資により損失が生じた場合、本サービスは一切の責任を負いません。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第4条：禁止事項
            </h2>
            <p>
              ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>法令に違反する行為</li>
              <li>本サービスまたは他のユーザーに損害を与える行為</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>本サービスの情報を無断で複製する行為</li>
              <li>その他、本サービスが不適切と判断する行為</li>
              <li>他のユーザーに迷惑をかける行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第5条：本サービスの提供
            </h2>
            <p>
              本サービスは、利用規約に基づき、本サービスを提供いたします。
              本サービスは、本サービスの提供を中断または停止する場合があります。
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>本サービスに係るシステムの保守点検または更新を行う場合</li>
              <li>
                地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合
              </li>
              <li>その他、本サービスの提供が困難となった場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第6条：免責事項
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                本サービスは、本サービスに起因してユーザーまたは第三者に生じたあらゆる損害について、一切の責任を負いません。
              </li>
              <li>
                本サービスは、本サービスの情報の正確性、完全性、有用性について、一切の保証を行いません。
              </li>
              <li>
                本サービスで提供される株価情報や分析結果の内容について、本サービスは一切の保証を行いません。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第7条：個人情報の取り扱い
            </h2>
            <p>
              本サービスは、ユーザーの個人情報の取り扱いについて、別途定めるプライバシーポリシーに従い適切に取り扱います。
              本サービスは、本プライバシーポリシーに従い、個人情報を適切に取り扱います。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第8条：規約の変更
            </h2>
            <p>
              本サービスは、必要に応じて、本規約を変更することがあります。
              変更後の規約は、本サービスが定める方法により、ユーザーに通知いたします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第9条：準拠法・管轄裁判所
            </h2>
            <p>
              本規約の解釈にあたっては、日本法を準拠法とします。
              本サービスに関して紛争が生じた場合には、本サービスの本店所在地を管轄する裁判所を専属的合意管轄裁判所とします。
            </p>
          </section>

          <div className="mt-12 pt-6 border-t border-gray-300">
            <p className="text-sm text-gray-600">制定日：2025年1月1日</p>
            <p className="text-sm text-gray-600">最終更新：2025年1月1日</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            ログインページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
