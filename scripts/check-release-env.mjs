import fs from "node:fs";

const DEFAULT_ENV_FILES = [
  ".env.local",
  ".env.production",
  ".env.vercel.check",
];

const REQUIRED_ENV = [
  {
    key: "APP_STORE_CONNECT_KEY_ID",
    label: "App Store Connect key ID",
  },
  {
    key: "APP_STORE_CONNECT_ISSUER_ID",
    label: "App Store Connect issuer ID",
  },
  {
    key: "APP_STORE_CONNECT_PRIVATE_KEY",
    label: "App Store Connect private key",
    sensitive: true,
    validate: (value) =>
      value.includes("BEGIN PRIVATE KEY") && value.includes("END PRIVATE KEY"),
  },
  {
    key: "IOS_BUNDLE_ID",
    label: "iOS bundle ID",
    validate: (value) => /^[A-Za-z0-9.-]+$/.test(value),
  },
  {
    key: "IOS_SUBSCRIPTION_PRODUCT_IDS",
    label: "iOS subscription product IDs",
    validate: hasCsvValues,
  },
  {
    key: "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY",
    label: "Google Play service account JSON",
    sensitive: true,
    validate: hasGoogleServiceAccountShape,
  },
  {
    key: "GOOGLE_PLAY_PACKAGE_NAME",
    label: "Google Play package name",
    validate: (value) => /^[A-Za-z0-9_.]+$/.test(value),
  },
  {
    key: "ANDROID_SUBSCRIPTION_PRODUCT_IDS",
    label: "Android subscription product IDs",
    validate: hasCsvValues,
  },
];

const OPTIONAL_ENV = [
  "ANDROID_KEYSTORE_FILE",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];

function parseEnvFiles(files) {
  const env = {};
  const loadedFiles = [];
  const fileKeys = new Map();

  for (const file of files) {
    if (!fs.existsSync(file)) continue;

    loadedFiles.push(file);
    fileKeys.set(file, new Set());
    const contents = fs.readFileSync(file, "utf8");

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const equalsIndex = line.indexOf("=");
      if (equalsIndex === -1) continue;

      const key = line.slice(0, equalsIndex).trim();
      const value = normalizeEnvValue(line.slice(equalsIndex + 1).trim());
      if (key) {
        env[key] = value;
        fileKeys.get(file).add(key);
      }
    }
  }

  return {
    env: {
      ...env,
      ...process.env,
    },
    loadedFiles,
    fileKeys,
  };
}

function normalizeEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function hasCsvValues(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean).length > 0;
}

function hasGoogleServiceAccountShape(value) {
  try {
    const parsed = JSON.parse(value);
    return Boolean(
      parsed &&
        parsed.type === "service_account" &&
        parsed.client_email &&
        parsed.private_key
    );
  } catch {
    return false;
  }
}

function isPlaceholder(value) {
  const trimmed = value.trim();
  return (
    !trimmed ||
    trimmed.includes("your_") ||
    trimmed.includes("...") ||
    /^<.+>$/.test(trimmed)
  );
}

function main() {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg ? targetArg.split("=")[1] : "all";
  const files = process.argv.filter((arg) => !arg.startsWith("--target=")).slice(2);
  const requiredEnv =
    target === "ios"
      ? REQUIRED_ENV.filter((item) => !item.key.startsWith("GOOGLE_PLAY_") && !item.key.startsWith("ANDROID_"))
      : REQUIRED_ENV;
  const { env, loadedFiles, fileKeys } = parseEnvFiles(
    files.length > 0 ? files : DEFAULT_ENV_FILES
  );

  console.log("Release env check");
  console.log(
    `Loaded: ${loadedFiles.length > 0 ? loadedFiles.join(", ") : "none"}`
  );
  console.log(`Target: ${target}`);
  console.log("");

  const failures = [];
  const warnings = [];

  for (const item of requiredEnv) {
    const value = env[item.key];
    if (!value || isPlaceholder(value)) {
      if (
        item.sensitive &&
        fileKeys.get(".env.vercel.check")?.has(item.key)
      ) {
        warnings.push(
          `${item.key} (${item.label}) exists in Vercel; value is not pullable locally`
        );
        continue;
      }
      failures.push(`${item.key} (${item.label}) is missing`);
      continue;
    }

    if (item.validate && !item.validate(value)) {
      failures.push(`${item.key} (${item.label}) is malformed`);
    }
  }

  const signingPresent = OPTIONAL_ENV.filter((key) => {
    const value = env[key];
    return value && !isPlaceholder(value);
  });

  if (failures.length > 0) {
    console.error("Missing or invalid production env:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error("");
    console.error("Add missing values in Vercel, then run:");
    console.error(
      "  npx vercel env pull .env.vercel.check --environment=production --yes"
    );
    console.error("  npm run check:release-env");
    process.exit(1);
  }

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  console.log("Required native purchase verification env: OK");
  console.log(
    `Android release signing env: ${
      signingPresent.length === OPTIONAL_ENV.length
        ? "OK"
        : "not fully set; needed only for signed local/CI AAB builds"
    }`
  );
}

main();
