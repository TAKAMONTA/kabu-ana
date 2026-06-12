# Production release environment

Native purchase verification fails closed when these production variables are missing. Add them in Vercel before deploying the purchase-verification release.

## Required Vercel production variables

```text
APP_STORE_CONNECT_KEY_ID
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_CONNECT_PRIVATE_KEY
IOS_BUNDLE_ID
IOS_SUBSCRIPTION_PRODUCT_IDS
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY
GOOGLE_PLAY_PACKAGE_NAME
ANDROID_SUBSCRIPTION_PRODUCT_IDS
```

Recommended values:

```text
IOS_BUNDLE_ID=com.takaapps.kabunavi
IOS_SUBSCRIPTION_PRODUCT_IDS=com.takaapps.kabunavi.Monthly,com.takaapps.kabunavi.Yearly
GOOGLE_PLAY_PACKAGE_NAME=app.vercel.kabu_9t7mdgybz_takamontas_projects.twa
ANDROID_SUBSCRIPTION_PRODUCT_IDS=premium_monthly,premium_yearly
```

`APP_STORE_CONNECT_PRIVATE_KEY` should be the `.p8` private key content. Keep the begin/end lines. If entering it through the Vercel dashboard, paste it as a multi-line value.

`GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` should be the full service account JSON for a Google Play Developer API account that can read subscription purchases.

## Safe verification flow

Pull production env to the ignored local check file:

```bash
npx vercel env pull .env.vercel.check --environment=production --yes
```

Validate required purchase-verification env without printing secret values:

```bash
npm run check:release-env
```

For an App Store-only release, use the iOS target check:

```bash
npm run check:release-env:ios
```

Run the full web preflight after the environment check passes:

```bash
npm run preflight:release
```

For an App Store-only release:

```bash
npm run preflight:release:ios
```

Run the native build preflight before TestFlight or Google Play uploads:

```bash
npm run preflight:release:native
```

Only deploy after preflight passes.

## Optional Android signing env

For signed local or CI AAB builds, prefer environment variables over `android/key.properties`:

```text
ANDROID_KEYSTORE_FILE
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Do not commit keystores, `.pem` files, or `android/key.properties`.

You can check tracked files for common signing-secret mistakes with:

```bash
npm run check:secrets
```
