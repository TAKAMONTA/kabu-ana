// 旧PWA用 Service Worker の後始末専用スクリプト。
// 以前このファイルを登録した端末では、古いキャッシュ（kabuana-*）が
// 最新の株価・画面を上書きし続ける恐れがあるため、更新時に
// キャッシュを削除して自身を登録解除する。新規登録は行っていない。
// ファイルを消すと更新チェックが 404 になり旧 SW が残り続けるので、削除しないこと。
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith("kabuana-"))
          .map(key => caches.delete(key))
      );
      await self.registration.unregister();
    })()
  );
});
