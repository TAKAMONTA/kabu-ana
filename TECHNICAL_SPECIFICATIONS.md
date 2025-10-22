# 🔧 株穴（kabu-ana）技術仕様書

## 📋 概要

**プロジェクト名**: 株穴（kabu-ana）- AI株式分析カルテ  
**技術スタック**: Next.js 14.2.3 + TypeScript + Firebase  
**対象ブラウザ**: Chrome, Firefox, Safari, Edge（最新版）  
**対応デバイス**: PC, タブレット, スマートフォン

## 🏗️ システムアーキテクチャ

### 全体構成図

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Login/LP    │  │ Dashboard   │  │ Karte       │        │
│  │ (/login)    │  │ (/dashboard)│  │ (/karte)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                    Authentication Layer                     │
│                  (Firebase Authentication)                  │
├─────────────────────────────────────────────────────────────┤
│                      API Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Auth API    │  │ Analysis    │  │ User Data   │        │
│  │             │  │ API         │  │ API         │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                     Backend Services                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Firestore   │  │ AI APIs     │  │ Stock APIs  │        │
│  │ Database    │  │ (OpenAI/    │  │ (Alpha      │        │
│  │             │  │ Claude/     │  │ Vantage)    │        │
│  │             │  │ Gemini)     │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 📁 プロジェクト構造

### 現在のファイル構造

```
kabu-anal/
├── app/
│   ├── globals.css                 # グローバルスタイル
│   ├── layout.tsx                  # ルートレイアウト
│   ├── page.tsx                    # ホームページ（現在）
│   ├── api/
│   │   └── ai-analysis/
│   │       └── route.ts            # AI分析API
│   ├── components/
│   │   ├── AIKarteDisplay.tsx      # カルテ表示コンポーネント
│   │   ├── MockKarteData.ts        # モックデータ
│   │   └── UnderDevelopment.tsx    # 開発中表示
│   ├── karte/
│   │   ├── page.tsx                # カルテページ
│   │   ├── SearchableKarte.tsx     # 検索機能付きカルテ
│   │   └── demo/
│   │       └── page.tsx            # デモページ
│   ├── lib/
│   │   ├── firebase.ts             # Firebase設定
│   │   └── aiPrompts.ts            # AIプロンプト定義
│   └── [その他機能ページ]/
├── public/                         # 静的ファイル
├── package.json                    # 依存関係
├── next.config.js                  # Next.js設定
├── tsconfig.json                   # TypeScript設定
├── firebase.json                   # Firebase設定
├── firestore.rules                 # Firestoreセキュリティルール
├── firestore.indexes.json          # Firestoreインデックス
└── vercel.json                     # Vercel設定
```

### 追加予定のファイル構造

```
app/
├── login/
│   ├── page.tsx                    # ログイン/LPページ
│   └── components/
│       ├── LoginForm.tsx           # ログインフォーム
│       ├── LandingHero.tsx         # ヒーローセクション
│       └── FeatureSection.tsx      # 機能紹介セクション
├── dashboard/
│   ├── page.tsx                    # ダッシュボードページ
│   └── components/
│       ├── UserStats.tsx           # ユーザー統計
│       ├── RecentAnalyses.tsx      # 最近の分析
│       ├── FavoriteStocks.tsx      # お気に入り銘柄
│       └── MarketOverview.tsx      # 市場概況
├── components/
│   ├── common/
│   │   ├── Header.tsx              # 共通ヘッダー
│   │   ├── Sidebar.tsx             # サイドバー
│   │   ├── Footer.tsx              # フッター
│   │   └── LoadingSpinner.tsx      # ローディング
│   ├── auth/
│   │   ├── AuthProvider.tsx        # 認証プロバイダー
│   │   ├── ProtectedRoute.tsx      # 認証保護ルート
│   │   └── UserMenu.tsx            # ユーザーメニュー
│   └── ui/
│       ├── Button.tsx              # ボタンコンポーネント
│       ├── Modal.tsx               # モーダル
│       └── Toast.tsx               # トースト通知
├── hooks/
│   ├── useAuth.ts                  # 認証フック
│   ├── useFirestore.ts             # Firestoreフック
│   └── useAnalysis.ts              # 分析フック
├── utils/
│   ├── constants.ts                # 定数定義
│   ├── helpers.ts                  # ヘルパー関数
│   └── validation.ts               # バリデーション
└── types/
    ├── auth.ts                     # 認証関連型定義
    ├── analysis.ts                 # 分析関連型定義
    └── user.ts                     # ユーザー関連型定義
```

## 🔧 技術仕様詳細

### Next.js 設定

#### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: [
      "lh3.googleusercontent.com", // Google プロフィール画像
      "firebasestorage.googleapis.com", // Firebase Storage
    ],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./app/*"],
      "@/components/*": ["./app/components/*"],
      "@/lib/*": ["./app/lib/*"],
      "@/hooks/*": ["./app/hooks/*"],
      "@/utils/*": ["./app/utils/*"],
      "@/types/*": ["./app/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Firebase 設定

#### firebase.json

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

#### firestore.rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザーデータ
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 分析履歴
    match /analyses/{analysisId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // お気に入り
    match /favorites/{favoriteId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // ユーザー統計
    match /user_stats/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // 公開データ（市場情報等）
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null &&
        request.auth.token.admin == true;
    }

    // システム設定（管理者のみ）
    match /system/{document=**} {
      allow read, write: if request.auth != null &&
        request.auth.token.admin == true;
    }
  }
}
```

#### firestore.indexes.json

```json
{
  "indexes": [
    {
      "collectionGroup": "analyses",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "favorites",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "addedAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "analyses",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "stockCode",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## 🔐 認証システム設計

### Firebase Authentication 設定

#### app/lib/auth.ts

```typescript
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Google認証プロバイダー
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// ユーザー情報の型定義
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: "free" | "premium";
  createdAt: Date;
  lastLoginAt: Date;
  preferences: {
    theme: "light" | "dark";
    language: "ja" | "en";
    notifications: boolean;
  };
}

// メール・パスワードでログイン
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await updateLastLogin(result.user.uid);
    return result;
  } catch (error) {
    throw error;
  }
};

// メール・パスワードで新規登録
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // プロフィール更新
    await updateProfile(result.user, { displayName });

    // Firestoreにユーザー情報を保存
    await createUserProfile(result.user, { displayName });

    return result;
  } catch (error) {
    throw error;
  }
};

// Googleでログイン
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);

    // 初回ログインの場合、ユーザープロフィールを作成
    const userDoc = await getDoc(doc(db, "users", result.user.uid));
    if (!userDoc.exists()) {
      await createUserProfile(result.user);
    } else {
      await updateLastLogin(result.user.uid);
    }

    return result;
  } catch (error) {
    throw error;
  }
};

// ログアウト
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

// パスワードリセット
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw error;
  }
};

// ユーザープロフィール作成
const createUserProfile = async (
  user: User,
  additionalData?: { displayName?: string }
) => {
  const userProfile: UserProfile = {
    uid: user.uid,
    email: user.email!,
    displayName: additionalData?.displayName || user.displayName || "",
    photoURL: user.photoURL || undefined,
    plan: "free",
    createdAt: new Date(),
    lastLoginAt: new Date(),
    preferences: {
      theme: "light",
      language: "ja",
      notifications: true,
    },
  };

  await setDoc(doc(db, "users", user.uid), userProfile);

  // ユーザー統計の初期化
  await setDoc(doc(db, "user_stats", user.uid), {
    totalAnalyses: 0,
    favoriteCount: 0,
    lastAnalysisAt: null,
    monthlyUsage: {},
  });
};

// 最終ログイン時刻更新
const updateLastLogin = async (uid: string) => {
  await updateDoc(doc(db, "users", uid), {
    lastLoginAt: new Date(),
  });
};

// 認証状態監視
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
```

### 認証フック

#### app/hooks/useAuth.ts

```typescript
'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChange } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  error: null
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // ユーザープロフィールをリアルタイム監視
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (doc) => {
            if (doc.exists()) {
              setUserProfile(doc.data() as UserProfile);
            }
          },
          (error) => {
            setError(error.message);
          }
        );

        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

## 📊 データベース設計詳細

### Firestore コレクション仕様

#### users コレクション

```typescript
interface User {
  uid: string; // Firebase Auth UID
  email: string; // メールアドレス
  displayName: string; // 表示名
  photoURL?: string; // プロフィール画像URL
  plan: "free" | "premium"; // プラン
  createdAt: Timestamp; // 作成日時
  lastLoginAt: Timestamp; // 最終ログイン日時
  preferences: {
    theme: "light" | "dark"; // テーマ
    language: "ja" | "en"; // 言語
    notifications: boolean; // 通知設定
  };
}
```

#### analyses コレクション

```typescript
interface Analysis {
  id: string; // ドキュメントID
  userId: string; // ユーザーID
  stockCode: string; // 銘柄コード
  stockName: string; // 銘柄名
  market: "JP" | "US"; // 市場
  analysisData: {
    stockInfo: {
      code: string;
      name: string;
      market: string;
      currentPrice: number;
      priceChange: number;
      priceChangePercent: number;
    };
    companyOverview: {
      description: string;
      industry: string;
      sector: string;
      employees: number;
      founded: string;
      headquarters: string;
      website: string;
    };
    metrics: {
      per: number;
      pbr: number;
      roe: number;
      roa: number;
      dividendYield: number;
      marketCap: number;
    };
    aiScore: {
      overall: number;
      growth: number;
      profitability: number;
      stability: number;
      valuation: number;
    };
    // ... その他の分析データ
  };
  createdAt: Timestamp; // 作成日時
  isPublic: boolean; // 公開設定
  tags?: string[]; // タグ
}
```

#### favorites コレクション

```typescript
interface Favorite {
  id: string; // ドキュメントID
  userId: string; // ユーザーID
  stockCode: string; // 銘柄コード
  stockName: string; // 銘柄名
  market: "JP" | "US"; // 市場
  addedAt: Timestamp; // 追加日時
  notes?: string; // メモ
}
```

#### user_stats コレクション

```typescript
interface UserStats {
  userId: string; // ユーザーID（ドキュメントID）
  totalAnalyses: number; // 総分析回数
  favoriteCount: number; // お気に入り数
  lastAnalysisAt: Timestamp | null; // 最終分析日時
  monthlyUsage: {
    [yearMonth: string]: {
      // 'YYYY-MM' 形式
      analyses: number; // 月間分析回数
      favorites: number; // 月間お気に入り追加数
    };
  };
  streakDays: number; // 連続利用日数
  achievements: string[]; // 達成バッジ
}
```

## 🎨 UI/UXコンポーネント設計

### 共通コンポーネント

#### Button コンポーネント

```typescript
// app/components/ui/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = ''
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
    ghost: 'text-blue-600 hover:bg-blue-50 focus:ring-blue-500'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </button>
  );
};
```

#### Modal コンポーネント

```typescript
// app/components/ui/Modal.tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        <div className={`inline-block w-full ${sizeClasses[size]} p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl`}>
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};
```

## 🔌 API設計

### AI分析API拡張

#### app/api/ai-analysis/route.ts（拡張版）

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { doc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { stockCode, market, step, previousData } = await request.json();

    // レート制限チェック
    const canAnalyze = await checkRateLimit(session.user.id);
    if (!canAnalyze) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    let result;

    switch (step) {
      case 1:
        result = await identifyCompany(stockCode, market);
        break;
      case 2:
        result = await fetchStockPrice(stockCode, market, previousData);
        break;
      case 3:
        result = await performDetailedAnalysis(stockCode, market, previousData);

        // 分析結果をFirestoreに保存
        await saveAnalysisResult(session.user.id, {
          stockCode,
          market,
          analysisData: result,
        });

        // ユーザー統計を更新
        await updateUserStats(session.user.id);
        break;
      default:
        return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// レート制限チェック
async function checkRateLimit(userId: string): Promise<boolean> {
  // 実装: ユーザーの月間利用回数をチェック
  // 無料プランは月5回、プレミアムプランは無制限
  return true; // 簡略化
}

// 分析結果保存
async function saveAnalysisResult(userId: string, analysisData: any) {
  const analysisId = `${userId}_${Date.now()}`;
  await setDoc(doc(db, "analyses", analysisId), {
    userId,
    ...analysisData,
    createdAt: new Date(),
    isPublic: false,
  });
}

// ユーザー統計更新
async function updateUserStats(userId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  await updateDoc(doc(db, "user_stats", userId), {
    totalAnalyses: increment(1),
    lastAnalysisAt: new Date(),
    [`monthlyUsage.${currentMonth}.analyses`]: increment(1),
  });
}
```

### ユーザーデータAPI

#### app/api/user/profile/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// プロフィール取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userDoc = await getDoc(doc(db, 'users', session.user.id));
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(userDoc.data());
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// プロフィール更新
export async function PUT(request: NextRequest) {
  try {
    const session = await
```
