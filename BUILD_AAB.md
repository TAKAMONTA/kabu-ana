# Android AAB ビルド手順

## バージョン情報
- **現在のバージョン**: versionCode 27, versionName "1.5.5"

## ビルド手順

### 1. Next.jsアプリをビルド
```bash
npm run build:static
```
`capacitor.config.ts` の `webDir` が `out` のため、通常の `npm run build`（`.next/`を生成）ではなく、静的エクスポート（`EXPORT_STATIC=true next build`）で `out/` ディレクトリを生成する必要があります。

### 2. Capacitorで同期
```bash
npx cap sync android
```
これにより、Next.jsアプリのビルド結果がAndroidプロジェクトに同期されます。

上記1・2は `npm run build:android` でまとめて実行できます。

### 3. AABファイルをビルド

ビルドにはJava 21（例: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`）とAndroid SDK（`ANDROID_HOME=/Users/taka/Library/Android/sdk` など）が必要です。

リリース署名は `android/key.properties` に以下の4項目（`storeFile` / `storePassword` / `keyAlias` / `keyPassword`）を記載するか、以下の環境変数で指定できます。実値はコミットしないでください（`android/key.properties` は `.gitignore` 済みです）。

```bash
export ANDROID_KEYSTORE_FILE=/absolute/path/to/upload-keystore.jks
export ANDROID_KEYSTORE_PASSWORD=your_secure_store_password
export ANDROID_KEY_ALIAS=upload
export ANDROID_KEY_PASSWORD=your_secure_key_password
```

**警告**: 上記の署名設定（`key.properties` または環境変数）が未設定の場合、`bundleRelease` は**未署名のAAB**を生成します。未署名AABはGoogle Play Consoleにアップロードできないため、アップロード前に必ず署名済みであることを確認してください。

#### 方法1: npmスクリプトを使用（推奨）
```bash
npm run build:aab
```
（内部で `npm run build:static` → `npx cap sync android` → `cd android && ./gradlew bundleRelease` を順に実行します）

#### 方法2: 手動でビルド
```bash
cd android
./gradlew bundleRelease
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
- `ANDROID_KEYSTORE_FILE` などの署名用環境変数、またはローカル専用の `android/key.properties` が設定されているか確認
- キーストアファイル（`upload-keystore.jks`）が存在するか確認
- Android SDKが正しくインストールされているか確認

### バージョンアップ方法
次回のバージョンアップ時は、`android/app/build.gradle` の以下を更新（現在は versionCode 27, versionName "1.5.5"）：
```gradle
versionCode 28  // 前回より1増やす
versionName "1.5.6"  // セマンティックバージョニングに従って更新
```
iOSをストアに合わせて更新する場合は、`ios/App/App.xcodeproj/project.pbxproj` の `CURRENT_PROJECT_VERSION`（Debug/Release両方）を同じ値に、`MARKETING_VERSION`（Debug/Release両方）を同じバージョン名に揃えてください。
