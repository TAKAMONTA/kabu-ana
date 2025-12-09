@echo off
echo ========================================
echo AABファイルを再ビルドします
echo バージョン: Code 11, Name 1.1
echo ========================================
echo.

echo 古いAABファイルを削除中...
if exist "android\app\release\app-release.aab" del "android\app\release\app-release.aab"
if exist "android\app\build\outputs\bundle\release\*.aab" del "android\app\build\outputs\bundle\release\*.aab"

echo.
echo Gradleクリーンを実行中...
cd android
call gradlew.bat clean
cd ..

echo.
echo Next.jsアプリをビルド中...
call npm run build

echo.
echo Capacitorで同期中...
call npx cap sync android

echo.
echo AABファイルをビルド中...
cd android
call gradlew.bat bundleRelease
cd ..

echo.
echo ========================================
echo ビルド完了！
echo AABファイルの場所:
echo android\app\build\outputs\bundle\release\app-release.aab
echo ========================================
pause

