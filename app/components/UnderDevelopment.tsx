export default function UnderDevelopment({
  title,
  icon,
  description,
}: {
  title: string;
  icon?: string;
  description?: string;
}) {
  return (
    <main>
      <div className="dev-container">
        {icon && <div className="dev-icon">{icon}</div>}
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}

        <div className="dev-notice">
          <div className="dev-badge">🚧 開発中</div>
          <h2>このページは現在開発中です</h2>
          <p>
            この機能は現在開発中です。
            <br />
            もうしばらくお待ちください。
          </p>

          <div className="dev-features">
            <h3>開発予定の機能</h3>
            <ul>
              <li>AI分析機能</li>
              <li>リアルタイム更新</li>
              <li>詳細レポート</li>
              <li>カスタマイズ可能な設定</li>
            </ul>
          </div>
        </div>

        <div className="back-link">
          <a href="/">ホームに戻る</a>
        </div>
      </div>
    </main>
  );
}
