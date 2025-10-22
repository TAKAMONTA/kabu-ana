"use client";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">
          プライバシーポリシー
        </h1>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <p>
              株価分析AIカードサービス（以下「本サービス」）は、ユーザーの個人情報の保護を最重要事項と考えています。
              本プライバシーポリシーでは、本サービスにおける個人情報の収集、利用、管理について説明いたします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第1条：収集する個人情報
            </h2>
            <p>
              本サービスでは、以下の個人情報を収集いたします。収集する個人情報は、本サービスの提供に必要な最小限の情報であり、
              氏名、住所、電話番号、メールアドレス、Googleアカウント情報（Googleログインを使用した場合）、
              プロフィール情報（ユーザーが設定した場合）を含みます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第2条：個人情報の利用目的
            </h2>
            <p>本サービスでは、以下の目的で個人情報を利用いたします。</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>メールアドレス</li>
              <li>アカウント管理とサービス提供</li>
              <li>Googleアカウント連携（Googleログインを使用した場合）</li>
              <li>プロフィール情報の表示</li>
            </ul>
            <p className="mt-3">
              これらの個人情報は、本サービスの提供に必要な範囲内でのみ利用され、それ以外の目的での利用はいたしません。
              また、本サービスは、個人情報の利用目的を明確にし、ユーザーに事前に通知いたします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第3条：個人情報の第三者提供
            </h2>
            <p>
              本サービスでは、以下の場合を除き、個人情報を第三者に提供いたしません。
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>本サービスの利用規約に基づく</li>
              <li>ユーザーからの事前の同意を得た場合</li>
              <li>
                本サービスの新機能や改善機能の提供、またはユーザーからのお問い合わせへの対応
              </li>
              <li>法令に基づく場合</li>
              <li>本サービスが適切に管理し、ユーザーの同意を得た場合</li>
              <li>ユーザーが設定した公開プロフィール情報の表示</li>
              <li>法令に基づく場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第4条：個人情報の管理・保護
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                本サービスでは、個人情報の適切な管理・保護を行い、ユーザーの同意を得た場合を除き、個人情報の第三者提供はいたしません。
              </li>
              <li>
                管理・保護のための措置を講じた場合でも、本サービスは、ユーザーに対して、個人情報の管理・保護に関する情報を提供いたします。
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第5条：個人情報の開示・訂正
            </h2>
            <p>
              本サービスでは、ユーザーからの個人情報の開示・訂正のご要望にお応えいたします。
              また、本サービスは、個人情報の開示・訂正に関する手続きを定め、ユーザーに通知いたします。
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>本サービスの利用規約に基づく場合</li>
              <li>ユーザーからの事前の同意を得た場合</li>
              <li>
                本サービスの新機能や改善機能の提供、またはユーザーからのお問い合わせへの対応
              </li>
              <li>法令に基づく場合</li>
              <li>本サービスが適切に管理し、ユーザーの同意を得た場合</li>
              <li>ユーザーが設定した公開プロフィール情報の表示</li>
              <li>法令に基づく場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第6条：個人情報の削除
            </h2>
            <p>
              本サービスでは、ユーザーからの個人情報の削除のご要望にお応えいたします。
              また、本サービスは、ユーザーが設定した公開プロフィール情報の表示を削除いたします。
              削除のご要望にお応えいたします。
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>本サービスの利用規約に基づく場合</li>
              <li>
                本サービスの新機能や改善機能の提供、またはユーザーからのお問い合わせへの対応
              </li>
              <li>法令に基づく場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第7条：個人情報の適切な取り扱い
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                ユーザーは、本サービスの適切な利用に関する個人情報の取り扱いについて、本サービスが定める個人情報の取り扱いに関する規定に従い、適切に取り扱うものとします。
              </li>
              <li>
                本サービスでは、ユーザーからの個人情報の取り扱いに関するお問い合わせにお応えいたします。
              </li>
              <li>
                本サービスでは、法令に基づく個人情報の取り扱いに関する規定を定め、個人情報の取り扱いに関する規定を定めた場合には、その規定に従い、適切に取り扱うものとします。
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第8条：個人情報の安全管理措置
            </h2>
            <p>
              本サービスでは、ユーザーの個人情報の安全管理措置を講じ、個人情報の漏洩、滅失、き損の防止その他の個人情報の安全管理のために必要かつ適切な措置を講じ、その措置の内容をユーザーに通知いたします。
              また、本サービスは、個人情報の安全管理措置に関する規定を定め、その規定に従い、適切に取り扱うものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第9条：Cookieの利用
            </h2>
            <p>
              本サービスでは、ユーザーの利便性向上のためにCookieを使用いたします。
              Cookieとは、ウェブサイトがユーザーのコンピュータに送信する小さなテキストファイルであり、
              ユーザーの設定やログイン情報を記憶し、サービスの利便性向上に役立ちます。
            </p>
            <p className="mt-2">
              ユーザーは、ブラウザの設定によりCookieの利用を制限することができますが、
              その場合、本サービスの一部機能が正常に動作しない場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第10条：本プライバシーポリシーの変更
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                本プライバシーポリシーの変更は、本サービスが定める方法により、ユーザーに通知いたします。
              </li>
              <li>
                本サービスでは、ユーザーからの個人情報の取り扱いに関するお問い合わせにお応えいたします。
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              第11条：お問い合わせ先
            </h2>
            <p>
              本プライバシーポリシーに関するお問い合わせは、以下の連絡先までお願いいたします。
            </p>
            <div className="mt-3 p-4 bg-gray-100 rounded">
              <p>サービス名：株価分析AIカード</p>
              <p>Eメール：[お問い合わせ用メールアドレス]</p>
            </div>
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
