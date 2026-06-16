# 新しいキーストアファイルを生成するスクリプト
# 使用方法: PowerShellで実行してください
# 秘密情報はこのファイルに書かず、環境変数または対話入力で指定します。

$keystorePath = if ($env:ANDROID_KEYSTORE_FILE) {
    $env:ANDROID_KEYSTORE_FILE
} else {
    Join-Path $PSScriptRoot "app\upload-keystore.jks"
}
$keyAlias = if ($env:ANDROID_KEY_ALIAS) { $env:ANDROID_KEY_ALIAS } else { "upload" }

function Read-PlainSecret {
    param(
        [string]$Prompt,
        [string]$EnvironmentVariable
    )

    $envValue = [Environment]::GetEnvironmentVariable($EnvironmentVariable)
    if (-not [string]::IsNullOrWhiteSpace($envValue)) {
        return $envValue
    }

    $secureValue = Read-Host $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$keystorePassword = Read-PlainSecret "キーストアのパスワードを入力してください" "ANDROID_KEYSTORE_PASSWORD"
$keyPassword = Read-PlainSecret "キーのパスワードを入力してください" "ANDROID_KEY_PASSWORD"

# キーストアファイルが既に存在する場合は確認
if (Test-Path $keystorePath) {
    Write-Host "警告: キーストアファイルが既に存在します: $keystorePath" -ForegroundColor Yellow
    $response = Read-Host "上書きしますか？ (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "キャンセルされました。" -ForegroundColor Red
        exit
    }
}

# キーストアファイルを生成
Write-Host "キーストアファイルを生成中..." -ForegroundColor Green
keytool -genkeypair -v -storetype PKCS12 -keystore $keystorePath -alias $keyAlias -keyalg RSA -keysize 2048 -validity 10000 -storepass $keystorePassword -keypass $keyPassword -dname "CN=Kabuana, OU=Development, O=TakaApps, L=Tokyo, ST=Tokyo, C=JP"

if ($LASTEXITCODE -eq 0) {
    Write-Host "キーストアファイルが正常に生成されました: $keystorePath" -ForegroundColor Green
    
    # 公開鍵証明書をエクスポート（Google Play Consoleにアップロードするために必要）
    $certPath = "C:\Users\tnaka\kabuana\android\app\upload-keystore.pem"
    Write-Host "公開鍵証明書をエクスポート中..." -ForegroundColor Green
    keytool -export -rfc -keystore $keystorePath -alias $keyAlias -file $certPath -storepass $keystorePassword
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "公開鍵証明書が正常にエクスポートされました: $certPath" -ForegroundColor Green
        Write-Host ""
        Write-Host "次のステップ:" -ForegroundColor Cyan
        Write-Host "1. Google Play Consoleで「署名鍵を変更」をクリック" -ForegroundColor Cyan
        Write-Host "2. 上記の公開鍵証明書ファイル ($certPath) をアップロード" -ForegroundColor Cyan
        Write-Host "3. key.propertiesファイルを更新してください" -ForegroundColor Cyan
    } else {
        Write-Host "公開鍵証明書のエクスポートに失敗しました。" -ForegroundColor Red
    }
} else {
    Write-Host "キーストアファイルの生成に失敗しました。" -ForegroundColor Red
    Write-Host "keytoolコマンドがPATHに含まれていることを確認してください。" -ForegroundColor Yellow
}
