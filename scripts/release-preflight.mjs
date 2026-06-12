import { spawnSync } from "node:child_process";

const native = process.argv.includes("--native");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : "all";

const checks = [
  ["node", ["scripts/check-release-env.mjs", `--target=${target}`]],
  ["npm", ["run", "check:secrets"]],
  ["npm", ["run", "lint"]],
  ["npx", ["vitest", "run", "src/lib/signals", "src/lib/purchases", "src/lib/utils"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "build:static"]],
  ["plutil", ["-lint", "ios/App/App/PrivacyInfo.xcprivacy"]],
  ["git", ["diff", "--check"]],
];

if (native) {
  checks.push(
    [
      "xcodebuild",
      [
        "-workspace",
        "ios/App/App.xcworkspace",
        "-scheme",
        "App",
        "-configuration",
        "Debug",
        "-sdk",
        "iphonesimulator",
        "-destination",
        "generic/platform=iOS Simulator",
        "build",
        "CODE_SIGNING_ALLOWED=NO",
      ],
    ],
    [
      "./gradlew",
      [":app:bundleRelease"],
      {
        cwd: "android",
        env: {
          ...process.env,
          JAVA_HOME:
            process.env.JAVA_HOME || "/opt/homebrew/opt/openjdk@17",
        },
      },
    ]
  );
}

for (const [command, args, options = {}] of checks) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
    env: options.env || process.env,
  });

  if (result.status !== 0) {
    console.error(
      `\nRelease preflight failed at: ${[command, ...args].join(" ")}`
    );
    process.exit(result.status || 1);
  }
}

console.log("\nRelease preflight: OK");
