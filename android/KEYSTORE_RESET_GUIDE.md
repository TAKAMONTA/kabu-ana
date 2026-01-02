# Google Play Console 署名鍵リセット手順

## 📋 概要

署名鍵を忘れてしまった場合、Google Play Consoleの「署名鍵を変更」機能を使用して新しいアップロードキーを設定できます。

## 🔧 手順

### ステップ1: 新しいキーストアファイルを生成

1. PowerShellを開きます
2. プロジェクトのルートディレクトリに移動します：
   ```powershell
   cd C:\Users\tnaka\kabuana
   ```
3. キーストア生成スクリプトを実行します：
   ```powershell
   .\android\generate-keystore.ps1
   ```

   または、手動でkeytoolコマンドを実行：
   ```powershell
   keytool -genkeypair -v -storetype PKCS12 -keystore android\app\upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000 -storepass taka0213 -keypass taka0213 -dname "CN=Kabuana, OU=Development, O=TakaApps, L=Tokyo, ST=Tokyo, C=JP"
   ```

4. 公開鍵証明書をエクスポート：
   ```powershell
   keytool -export -rfc -keystore android\app\upload-keystore.jks -alias upload -file android\app\upload-keystore.pem -storepass taka0213
   ```

### ステップ2: Google Play Consoleでアップロード鍵のリセットをリクエスト

1. [Google Play Console](https://play.google.com/console) にログインします
2. 対象のアプリを選択します
3. 左側のメニューから「**リリース**」→「**アプリの署名**」を選択します
   - または、画像にある「**署名鍵を変更**」リンクをクリックします
4. 「**アップロード鍵のリセットをリクエスト**」ボタンをクリックします
5. 鍵を紛失した理由を選択します（例：「鍵を紛失しました」）
6. ステップ1で生成した `.pem` ファイル（`android\app\upload-keystore.pem`）をアップロードします
7. 「**リクエスト**」ボタンをクリックして送信します

### ステップ3: 承認を待つ

- Googleから確認メールが届きます
- 通常、48時間以内に新しいアップロード鍵が有効になります
- 承認後、メール通知が届きます

### ステップ4: key.propertiesファイルを更新

承認後、`android/key.properties` ファイルを更新します：

```properties
storeFile=C:\\Users\\tnaka\\kabuana\\android\\app\\upload-keystore.jks
storePassword=taka0213
keyAlias=upload
keyPassword=taka0213
```

### ステップ5: 新しい鍵でビルド

新しい鍵が有効になったら、通常通りApp Bundleをビルドしてアップロードできます：

```powershell
cd android
.\gradlew bundleRelease
```

生成された `.aab` ファイルをGoogle Play Consoleにアップロードします。

## ⚠️ 重要な注意事項

1. **既存のアプリ署名キーは変更されません**
   - Google Play App Signingを使用している場合、アップロードキーとアプリ署名キーは別々です
   - アップロードキーを変更しても、既存のユーザーへの影響はありません

2. **キーストアファイルのバックアップ**
   - 新しいキーストアファイルは安全な場所にバックアップしてください
   - パスワードも忘れずに記録してください

3. **承認期間**
   - リセットリクエストの承認には通常48時間かかります
   - 緊急の場合は、Google Play Consoleのサポートに連絡してください

## 🔍 トラブルシューティング

### リセットリクエストが48時間以上経っても返事が来ない場合

**1. Google Play Console内でリクエストのステータスを確認**

1. [Google Play Console](https://play.google.com/console) にログイン
2. 対象のアプリを選択
3. 左側のメニューから「**リリース**」→「**アプリの署名**」を選択
4. 「**アップロード鍵**」セクションを確認
   - リクエストのステータス（承認待ち、承認済み、拒否など）が表示されます
   - 「**アップロード鍵のリセットをリクエスト**」ボタンが表示されている場合、まだ承認されていない可能性があります

**2. メールを確認**

- Google Play Consoleに登録されているメールアドレスを確認
- **迷惑メールフォルダ**も確認してください
- 送信元アドレス：`noreply@android.com` または `play-developer-support@google.com`
- メールの件名に「Upload key reset」や「アップロード鍵のリセット」が含まれている可能性があります

**3. 既に承認されている可能性を確認**

実際に新しい鍵でビルドしてアップロードしてみてください：

1. 新しいキーストアファイルが生成されていることを確認
2. `android/key.properties` が正しく設定されていることを確認
3. App Bundleをビルド：
   ```powershell
   cd android
   .\gradlew bundleRelease
   ```
4. Google Play Consoleでアップロードを試みる
   - エラーが出ない場合 → 既に承認されている可能性が高い
   - 署名エラーが出る場合 → まだ承認されていない

**4. Google Play Consoleサポートに連絡**

上記の確認をしても解決しない場合：

1. [Google Play Console ヘルプ](https://support.google.com/googleplay/android-developer/answer/7218994) にアクセス
2. 「**お問い合わせ**」または「**サポートに連絡**」をクリック
3. 以下の情報を含めて連絡：
   - アプリ名とパッケージ名
   - リクエストを送信した日時（できるだけ正確に）
   - リセットが必要な理由
   - 現在の状況（48時間以上経過しても返事がない）

**5. リクエストを再送信する**

Google Play Console内でリクエストのステータスが「失敗」や「拒否」になっている場合、またはリクエストが見当たらない場合：

1. 新しい公開鍵証明書（.pemファイル）を生成
2. 再度リセットリクエストを送信
3. リクエスト送信日時を記録しておく

### keytoolコマンドが見つからない場合

JDKがインストールされていることを確認してください：
```powershell
java -version
keytool -version
```

JDKがインストールされていない場合は、[Oracle JDK](https://www.oracle.com/java/technologies/downloads/) または [OpenJDK](https://adoptium.net/) をインストールしてください。

### キーストアファイルのパス

現在の設定では、キーストアファイルは以下の場所に保存されます：
- `C:\Users\tnaka\kabuana\android\app\upload-keystore.jks`

必要に応じて、パスを変更してください。

## 📚 参考リンク

- [Google Play App Signing の概要](https://support.google.com/googleplay/android-developer/answer/9842756)
- [アップロード鍵をリセットする](https://support.google.com/googleplay/android-developer/answer/9842756#reset)

