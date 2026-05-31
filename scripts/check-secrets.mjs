import fs from "node:fs";
import { execFileSync } from "node:child_process";

const FORBIDDEN_TRACKED_PATHS = [
  /(^|\/)android\/key\.properties$/,
  /\.jks$/,
  /\.keystore$/,
  /\.p8$/,
  /\.pem$/,
];

const TEXT_SECRET_PATTERNS = [
  {
    name: "known leaked Android signing password",
    pattern: new RegExp(["ta", "ka", "0213"].join(""), "i"),
  },
  {
    name: "hard-coded Android storePassword",
    pattern:
      /^\s*storePassword\s*=\s*(?!<|your_|your-secure-|your_secure_|$)[^\s#]+/im,
  },
  {
    name: "hard-coded Android keyPassword",
    pattern:
      /^\s*keyPassword\s*=\s*(?!<|your_|your-secure-|your_secure_|$)[^\s#]+/im,
  },
  {
    name: "private key block",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----[\s\S]*-----END (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/,
  },
  {
    name: "service account private key JSON",
    pattern: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/,
  },
];

const ALLOWED_TEXT_SECRET_FILES = new Set([".env.example"]);

function getTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

function isProbablyBinary(file) {
  const buffer = fs.readFileSync(file);
  return buffer.includes(0);
}

function main() {
  const trackedFiles = getTrackedFiles();
  const failures = [];
  const warnings = [];

  for (const file of trackedFiles) {
    for (const pattern of FORBIDDEN_TRACKED_PATHS) {
      if (pattern.test(file)) {
        if (fs.existsSync(file)) {
          failures.push(`${file}: tracked secret-like file`);
        } else {
          warnings.push(`${file}: tracked in HEAD, deleted in working tree`);
        }
      }
    }

    if (!fs.existsSync(file) || isProbablyBinary(file)) continue;

    const contents = fs.readFileSync(file, "utf8");
    if (ALLOWED_TEXT_SECRET_FILES.has(file)) continue;

    for (const item of TEXT_SECRET_PATTERNS) {
      if (item.pattern.test(contents)) {
        failures.push(`${file}: ${item.name}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("Potential tracked secrets found:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }
  if (warnings.length > 0) {
    console.warn("Commit these deletions before any Git-based deployment.");
  }

  console.log("Tracked secret scan: OK");
}

main();
