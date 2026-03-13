---
description: iOSアプリをビルドしてApp Storeに審査提出する
---

// turbo-all

# iOS ビルド & App Store 提出ワークフロー

プロジェクトディレクトリ: `/Users/taka/Downloads/kabu-ana-master/kabu-ana-master`

## ステップ1: ビルド番号をインクリメント

`ios/App/App.xcodeproj/project.pbxproj` ファイル内の `CURRENT_PROJECT_VERSION` の値を現在の値から +1 にインクリメントする（2箇所あるので両方更新する）。

## ステップ2: 静的ビルド

```bash
cd /Users/taka/Downloads/kabu-ana-master/kabu-ana-master && npm run build:static
```

ビルドが失敗した場合はエラーを確認して修正する。

## ステップ3: Capacitor同期

```bash
cd /Users/taka/Downloads/kabu-ana-master/kabu-ana-master && npx cap sync ios
```

## ステップ4: Xcodeでアーカイブ

```bash
cd /Users/taka/Downloads/kabu-ana-master/kabu-ana-master/ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath ./build/App.xcarchive archive
```

もしコード署名エラーが出た場合は、以下のオプションを追加して再試行:
```bash
cd /Users/taka/Downloads/kabu-ana-master/kabu-ana-master/ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath ./build/App.xcarchive archive CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=J3U2LZ2886
```

## ステップ5: App Store Connectにアップロード

```bash
cd /Users/taka/Downloads/kabu-ana-master/kabu-ana-master/ios/App && xcodebuild -exportArchive -archivePath ./build/App.xcarchive -exportPath ./build/export -exportOptionsPlist /Users/taka/Downloads/kabu-ana-master/kabu-ana-master/ios/App/ExportOptions.plist
```

ExportOptions.plist が存在しない場合は、以下の内容で作成する:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>J3U2LZ2886</string>
    <key>destination</key>
    <string>upload</string>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
```

## ステップ6: App Store Connectでビルド選択と審査提出

ブラウザでApp Store Connectを操作する:

1. `https://appstoreconnect.apple.com/apps/6746928147/distribution/ios/version/inflight` を開く
2. 5秒待ってページ読み込み完了を待つ
3. 「ビルド」セクションまでスクロール
4. 現在のビルドの行にホバーして「−」(マイナス)ボタンをクリックして既存ビルドを削除
5. 「−」ボタンが見つからない場合は、左メニューの「App Review」をクリックし、提出アイテムの削除ボタンを探してクリック
6. 配信ページに戻り、「ビルドを追加」または「+」ボタンをクリック
7. 最新のビルドを選択して「完了」
8. 「保存」ボタンをクリック
9. 「審査用に追加」ボタンをクリック
10. 確認画面が出たら「提出」をクリック

## 完了確認

ステータスが「審査待ち」になっていることを確認して完了を報告する。
