# キーストアファイルとリセットリクエストのステータスを確認するスクリプト

Write-Host "=== キーストアファイルの確認 ===" -ForegroundColor Cyan

$keystorePath = "C:\Users\tnaka\kabuana\android\app\upload-keystore.jks"
$oldKeystorePath = "C:\Users\tnaka\takken\keystore\upload-keystore.jks"

# 新しいキーストアファイルの確認
if (Test-Path $keystorePath) {
    Write-Host "✓ 新しいキーストアファイルが見つかりました: $keystorePath" -ForegroundColor Green
    $fileInfo = Get-Item $keystorePath
    Write-Host "  作成日時: $($fileInfo.CreationTime)" -ForegroundColor Gray
    Write-Host "  ファイルサイズ: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "✗ 新しいキーストアファイルが見つかりません: $keystorePath" -ForegroundColor Yellow
    Write-Host "  キーストアファイルを生成する必要があります。" -ForegroundColor Yellow
}

# 古いキーストアファイルの確認
if (Test-Path $oldKeystorePath) {
    Write-Host "✓ 古いキーストアファイルが見つかりました: $oldKeystorePath" -ForegroundColor Green
} else {
    Write-Host "✗ 古いキーストアファイルが見つかりません: $oldKeystorePath" -ForegroundColor Red
    Write-Host "  （これは正常です。新しい鍵を生成する必要があります）" -ForegroundColor Gray
}

# 公開鍵証明書の確認
$certPath = "C:\Users\tnaka\kabuana\android\app\upload-keystore.pem"
if (Test-Path $certPath) {
    Write-Host "✓ 公開鍵証明書が見つかりました: $certPath" -ForegroundColor Green
} else {
    Write-Host "✗ 公開鍵証明書が見つかりません: $certPath" -ForegroundColor Yellow
    Write-Host "  Google Play Consoleにアップロードするために必要です。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== key.propertiesファイルの確認 ===" -ForegroundColor Cyan

$keyPropertiesPath = "C:\Users\tnaka\kabuana\android\key.properties"
if (Test-Path $keyPropertiesPath) {
    Write-Host "✓ key.propertiesファイルが見つかりました" -ForegroundColor Green
    $content = Get-Content $keyPropertiesPath -Raw
    if ($content -match "storeFile=(.+)") {
        $storeFile = $matches[1].Trim()
        Write-Host "  現在の設定: $storeFile" -ForegroundColor Gray
        if ($storeFile -match "takken\\keystore") {
            Write-Host "  ⚠️  古いパスが設定されています。新しいパスに更新する必要があります。" -ForegroundColor Yellow
        } elseif ($storeFile -match "kabuana\\android\\app") {
            Write-Host "  ✓ 新しいパスが設定されています。" -ForegroundColor Green
        }
    }
} else {
    Write-Host "✗ key.propertiesファイルが見つかりません" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 次のステップ ===" -ForegroundColor Cyan

if (-not (Test-Path $keystorePath)) {
    Write-Host "1. 新しいキーストアファイルを生成:" -ForegroundColor Yellow
    Write-Host "   .\android\generate-keystore.ps1" -ForegroundColor White
    Write-Host ""
}

Write-Host "2. Google Play Consoleでリセットリクエストのステータスを確認:" -ForegroundColor Yellow
Write-Host "   - 「アップロード鍵のリセットのリクエスト」リンクをクリック" -ForegroundColor White
Write-Host "   - リクエストのステータス（承認待ち、承認済み、拒否など）を確認" -ForegroundColor White
Write-Host ""
Write-Host "3. 新しい鍵でビルドしてテスト:" -ForegroundColor Yellow
Write-Host "   cd android" -ForegroundColor White
Write-Host "   .\gradlew bundleRelease" -ForegroundColor White
Write-Host "   生成された .aab ファイルをGoogle Play Consoleにアップロードして動作確認" -ForegroundColor White

