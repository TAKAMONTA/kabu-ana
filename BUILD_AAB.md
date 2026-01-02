# Android AAB ビルド手順

## バージョン情報
- **現在のバージョン**: versionCode 11, versionName "1.1"

## ビルド手順

### 1. Next.jsアプリをビルド
```bash
npm run build
```
これにより `out/` ディレクトリに静的ファイルが生成されます。

### 2. Capacitorで同期
```bash
npx cap sync android
```
これにより、Next.jsアプリのビルド結果がAndroidプロジェクトに同期されます。

### 3. AABファイルをビルド

#### 方法1: npmスクリプトを使用（推奨）
```bash
npm run build:aab
```

#### 方法2: 手動でビルド
```bash
cd android
gradlew.bat bundleRelease
```

### 4. ビルドされたAABファイルの場所
ビルドが成功すると、以下の場所にAABファイルが生成されます：
```
android/app/build/outputs/bundle/release/app-release.aab
```

### 5. Google Play Consoleへのアップロード
1. Google Play Consoleにログイン
2. アプリを選択
3. 「リリース」→「本番環境」または「テスト環境」を選択
4. 「新しいリリースを作成」をクリック
5. 生成されたAABファイル（`app-release.aab`）をアップロード
6. リリースノートを入力
7. 「確認」→「リリースを開始」

## トラブルシューティング

### ビルドエラーが発生する場合
- `key.properties` ファイルが `android/` ディレクトリに存在するか確認
- キーストアファイル（`upload-keystore.jks`）が存在するか確認
- Android SDKが正しくインストールされているか確認

### バージョンアップ方法
次回のバージョンアップ時は、`android/app/build.gradle` の以下を更新：
```gradle
versionCode 12  // 前回より1増やす
versionName "1.2"  // セマンティックバージョニングに従って更新
```

