"use client";

import { useState } from "react";

// ツールチップコンポーネント
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, content, position = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "bottom-full left-1/2 transform -translate-x-1/2 mb-2";
      case "bottom":
        return "top-full left-1/2 transform -translate-x-1/2 mt-2";
      case "left":
        return "right-full top-1/2 transform -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 transform -translate-y-1/2 ml-2";
      default:
        return "bottom-full left-1/2 transform -translate-x-1/2 mb-2";
    }
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-10 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap ${getPositionClasses()}`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-gray-900 transform rotate-45 ${
              position === "top"
                ? "top-full left-1/2 -translate-x-1/2 -mt-1"
                : position === "bottom"
                  ? "bottom-full left-1/2 -translate-x-1/2 -mb-1"
                  : position === "left"
                    ? "left-full top-1/2 -translate-y-1/2 -ml-1"
                    : "right-full top-1/2 -translate-y-1/2 -mr-1"
            }`}
          ></div>
        </div>
      )}
    </div>
  );
}

// コピーボタンコンポーネント
interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = "コピー" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
    >
      {copied ? (
        <>
          <span className="mr-1">✓</span>
          コピー済み
        </>
      ) : (
        <>
          <span className="mr-1">📋</span>
          {label}
        </>
      )}
    </button>
  );
}

// お気に入りボタンコンポーネント
interface FavoriteButtonProps {
  stockCode: string;
  companyName: string;
}

export function FavoriteButton({
  stockCode,
  companyName,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(() => {
    if (typeof window !== "undefined") {
      const favorites = JSON.parse(
        localStorage.getItem("favoriteStocks") || "[]"
      );
      return favorites.some((fav: any) => fav.code === stockCode);
    }
    return false;
  });

  const toggleFavorite = () => {
    if (typeof window !== "undefined") {
      const favorites = JSON.parse(
        localStorage.getItem("favoriteStocks") || "[]"
      );
      const stock = {
        code: stockCode,
        name: companyName,
        addedAt: new Date().toISOString(),
      };

      if (isFavorite) {
        const updatedFavorites = favorites.filter(
          (fav: any) => fav.code !== stockCode
        );
        localStorage.setItem(
          "favoriteStocks",
          JSON.stringify(updatedFavorites)
        );
      } else {
        favorites.push(stock);
        localStorage.setItem("favoriteStocks", JSON.stringify(favorites));
      }

      setIsFavorite(!isFavorite);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      className={`inline-flex items-center px-3 py-1 text-sm rounded-full transition-colors ${
        isFavorite
          ? "bg-red-100 text-red-600 hover:bg-red-200"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      <span className="mr-1">{isFavorite ? "❤️" : "🤍"}</span>
      {isFavorite ? "お気に入り済み" : "お気に入り"}
    </button>
  );
}

// 共有ボタンコンポーネント
interface ShareButtonProps {
  stockCode: string;
  companyName: string;
  url?: string;
}

export function ShareButton({ stockCode, companyName, url }: ShareButtonProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareUrl = url || `${window.location.origin}/analysis/${stockCode}`;
  const shareText = `${companyName} (${stockCode}) の分析結果`;

  const shareToTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank");
    setShowShareMenu(false);
  };

  const shareToLine = () => {
    const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;
    window.open(lineUrl, "_blank");
    setShowShareMenu(false);
  };

  const shareToFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, "_blank");
    setShowShareMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowShareMenu(!showShareMenu)}
        className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-full transition-colors"
      >
        <span className="mr-1">📤</span>
        共有
      </button>

      {showShareMenu && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
          <button
            onClick={shareToTwitter}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
          >
            <span className="mr-2">🐦</span>
            Twitter
          </button>
          <button
            onClick={shareToLine}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
          >
            <span className="mr-2">💬</span>
            LINE
          </button>
          <button
            onClick={shareToFacebook}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
          >
            <span className="mr-2">📘</span>
            Facebook
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          <div className="px-4 py-2">
            <CopyButton text={shareUrl} label="URLをコピー" />
          </div>
        </div>
      )}
    </div>
  );
}

// アラート設定ボタンコンポーネント
interface AlertButtonProps {
  stockCode: string;
  companyName: string;
  currentPrice?: number;
}

export function AlertButton({
  stockCode,
  companyName,
  currentPrice,
}: AlertButtonProps) {
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertPrice, setAlertPrice] = useState(currentPrice || 0);
  const [alertType, setAlertType] = useState<"above" | "below">("above");

  const saveAlert = () => {
    if (typeof window !== "undefined") {
      const alerts = JSON.parse(localStorage.getItem("stockAlerts") || "[]");
      const alert = {
        id: Date.now(),
        stockCode,
        companyName,
        price: alertPrice,
        type: alertType,
        createdAt: new Date().toISOString(),
      };

      alerts.push(alert);
      localStorage.setItem("stockAlerts", JSON.stringify(alerts));
      setShowAlertForm(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowAlertForm(!showAlertForm)}
        className="inline-flex items-center px-3 py-1 text-sm bg-yellow-100 text-yellow-600 hover:bg-yellow-200 rounded-full transition-colors"
      >
        <span className="mr-1">🔔</span>
        アラート設定
      </button>

      {showAlertForm && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
          <h4 className="font-semibold text-sm mb-3">価格アラート設定</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">価格</label>
              <input
                type="number"
                value={alertPrice}
                onChange={e => setAlertPrice(Number(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                placeholder="価格を入力"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">条件</label>
              <select
                value={alertType}
                onChange={e =>
                  setAlertType(e.target.value as "above" | "below")
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="above">以上になったら</option>
                <option value="below">以下になったら</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={saveAlert}
                className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                設定
              </button>
              <button
                onClick={() => setShowAlertForm(false)}
                className="flex-1 px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// アクションバーコンポーネント
interface ActionBarProps {
  stockCode: string;
  companyName: string;
  currentPrice?: number;
  shareUrl?: string;
}

export function ActionBar({
  stockCode,
  companyName,
  currentPrice,
  shareUrl,
}: ActionBarProps) {
  return (
    <div className="flex items-center space-x-3">
      <FavoriteButton stockCode={stockCode} companyName={companyName} />
      <ShareButton
        stockCode={stockCode}
        companyName={companyName}
        url={shareUrl}
      />
      <AlertButton
        stockCode={stockCode}
        companyName={companyName}
        currentPrice={currentPrice}
      />
    </div>
  );
}
