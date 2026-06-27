#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://kabu-ana.com";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_BRIEF_MAX_AGE_HOURS = 36;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeBaseUrl(baseUrl) {
  const parsed = new URL(baseUrl || DEFAULT_BASE_URL);
  return parsed.origin;
}

function getNow(options) {
  if (options.now instanceof Date) return options.now;
  if (typeof options.now === "function") return options.now();
  return new Date();
}

function getNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function truncate(value, maxLength = 300) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

async function fetchJson({ baseUrl, fetchImpl, path, timeoutMs, init = {} }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`${path} returned non-JSON response: ${truncate(text)}`);
    }

    if (!response.ok) {
      throw new Error(
        `${path} returned HTTP ${response.status}: ${truncate(text)}`
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${path} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function validateToyotaEdinetSearch(payload) {
  const errors = [];
  const companyInfo = isRecord(payload?.companyInfo) ? payload.companyInfo : {};
  const financialHistory = Array.isArray(payload?.financialHistory)
    ? payload.financialHistory
    : [];

  if (payload?.error) errors.push(`error=${payload.error}`);
  if (companyInfo.symbol !== "7203") {
    errors.push(
      `companyInfo.symbol expected 7203 but got ${companyInfo.symbol}`
    );
  }
  if (!hasText(payload?.edinetCode)) errors.push("edinetCode is missing");
  if (!hasText(payload?.accountingStandard)) {
    errors.push("accountingStandard is missing");
  }
  if (!isRecord(payload?.ratios) || Object.keys(payload.ratios).length === 0) {
    errors.push("ratios are missing");
  }
  if (financialHistory.length === 0) {
    errors.push("financialHistory is empty");
  }

  if (errors.length > 0) {
    throw new Error(`Toyota EDINET enrichment unhealthy: ${errors.join("; ")}`);
  }
}

function validateMarketDataRoute(payload, { symbol, expectedMarket }) {
  const errors = [];
  const expectedMarkets = Array.isArray(expectedMarket)
    ? expectedMarket
    : [expectedMarket];
  const companyInfo = isRecord(payload?.companyInfo) ? payload.companyInfo : {};
  const stockData = isRecord(payload?.stockData) ? payload.stockData : {};
  const metadata = isRecord(payload?.metadata) ? payload.metadata : {};

  const price = Number(stockData.price);
  const changePercent = Number(stockData.changePercent);
  const high52 = Number(stockData.high52);
  const low52 = Number(stockData.low52);
  const dataSource = String(metadata.dataSource ?? "");

  if (payload?.error) errors.push(`error=${payload.error}`);
  if (companyInfo.symbol !== symbol) {
    errors.push(
      `companyInfo.symbol expected ${symbol} but got ${companyInfo.symbol}`
    );
  }
  if (!expectedMarkets.includes(companyInfo.market)) {
    errors.push(
      `companyInfo.market expected one of ${expectedMarkets.join(", ")} but got ${companyInfo.market}`
    );
  }
  if (!Number.isFinite(price) || price <= 0)
    errors.push("stockData.price is not positive");
  if (!Number.isFinite(changePercent) || Math.abs(changePercent) > 50) {
    errors.push(
      `stockData.changePercent is implausible: ${stockData.changePercent}`
    );
  }
  if (!Number.isFinite(high52) || high52 <= 0)
    errors.push("stockData.high52 is missing");
  if (!Number.isFinite(low52) || low52 <= 0)
    errors.push("stockData.low52 is missing");
  if (Number.isFinite(high52) && Number.isFinite(low52) && high52 <= low52) {
    errors.push(`52w range is invalid: low=${low52}, high=${high52}`);
  }
  if (/serp/i.test(dataSource)) {
    errors.push(
      `metadata.dataSource still points to legacy serp path: ${dataSource}`
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Market data route unhealthy for ${symbol}: ${errors.join("; ")}`
    );
  }
}

function validateMorningBrief(payload, { now, briefMaxAgeHours }) {
  const brief = payload?.data?.brief;
  const generatedAt = payload?.data?.generatedAt ?? payload?.lastSuccessfulAt;
  const errors = [];

  if (payload?.error) errors.push(`error=${payload.error}`);
  if (!isRecord(brief)) errors.push("brief is missing");

  if (isRecord(brief)) {
    if (!hasText(brief.headline_jp))
      errors.push("brief.headline_jp is missing");
    if (!hasText(brief.summary_jp)) errors.push("brief.summary_jp is missing");
    if (!Array.isArray(brief.key_drivers) || brief.key_drivers.length === 0) {
      errors.push("brief.key_drivers is empty");
    }
    if (
      !Array.isArray(brief.stocks_to_watch) ||
      brief.stocks_to_watch.length === 0
    ) {
      errors.push("brief.stocks_to_watch is empty");
    }
  }

  if (!hasText(generatedAt)) {
    errors.push("generatedAt is missing");
  } else {
    const generatedTime = Date.parse(generatedAt);
    if (!Number.isFinite(generatedTime)) {
      errors.push(`generatedAt is invalid: ${generatedAt}`);
    } else {
      const ageHours = (now.getTime() - generatedTime) / 3_600_000;
      if (ageHours > briefMaxAgeHours) {
        errors.push(
          `generatedAt is older than ${briefMaxAgeHours}h (${ageHours.toFixed(
            1
          )}h)`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Morning brief unhealthy: ${errors.join("; ")}`);
  }
}

export function createProductionSmokeChecks(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = getNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const briefMaxAgeHours = getNumber(
    options.briefMaxAgeHours,
    DEFAULT_BRIEF_MAX_AGE_HOURS
  );

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this Node.js runtime");
  }

  const requestJson = (path, init) =>
    fetchJson({ baseUrl, fetchImpl, path, timeoutMs, init });

  return [
    {
      name: "search-edinet-7203",
      label: "Toyota search includes EDINET financial enrichment",
      async run() {
        const payload = await requestJson("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "7203" }),
        });
        validateToyotaEdinetSearch(payload);
      },
    },
    {
      name: "market-data-route-7203",
      label: "Toyota market data uses current router-quality fields",
      async run() {
        const payload = await requestJson("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "7203" }),
        });
        validateMarketDataRoute(payload, {
          symbol: "7203",
          expectedMarket: "TYO",
        });
      },
    },
    {
      name: "market-data-route-aapl",
      label: "Apple market data uses current router-quality fields",
      async run() {
        const payload = await requestJson("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "AAPL" }),
        });
        validateMarketDataRoute(payload, {
          symbol: "AAPL",
          expectedMarket: ["NASDAQ", "NMS", "NasdaqGS", "US"],
        });
      },
    },
    {
      name: "morning-brief",
      label: "Morning brief returns usable generated content",
      async run({ now }) {
        const payload = await requestJson("/api/signals/claude-brief", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        validateMorningBrief(payload, { now, briefMaxAgeHours });
      },
    },
  ];
}

export async function runProductionSmokeCheck(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const now = getNow(options);
  const startedAt = performance.now();
  const checks = options.checks ?? createProductionSmokeChecks(options);
  const passed = [];
  const failed = [];

  for (const check of checks) {
    const checkStartedAt = performance.now();
    try {
      await check.run({ now });
      passed.push({
        name: check.name,
        label: check.label,
        durationMs: Math.round(performance.now() - checkStartedAt),
      });
    } catch (error) {
      failed.push({
        name: check.name,
        label: check.label,
        message: error instanceof Error ? error.message : String(error),
        durationMs: Math.round(performance.now() - checkStartedAt),
      });
    }
  }

  return {
    ok: failed.length === 0,
    baseUrl,
    checkedAt: now.toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    passed,
    failed,
  };
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.KABUANA_PRODUCTION_URL ?? DEFAULT_BASE_URL,
    briefMaxAgeHours: process.env.KABUANA_BRIEF_MAX_AGE_HOURS,
    json: false,
    timeoutMs: process.env.KABUANA_SMOKE_TIMEOUT_MS,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      args.json = true;
    } else if (arg.startsWith("--base-url=")) {
      args.baseUrl = arg.slice("--base-url=".length);
    } else if (arg.startsWith("--brief-max-age-hours=")) {
      args.briefMaxAgeHours = arg.slice("--brief-max-age-hours=".length);
    } else if (arg.startsWith("--timeout-ms=")) {
      args.timeoutMs = arg.slice("--timeout-ms=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    ...args,
    briefMaxAgeHours: getNumber(
      args.briefMaxAgeHours,
      DEFAULT_BRIEF_MAX_AGE_HOURS
    ),
    timeoutMs: getNumber(args.timeoutMs, DEFAULT_TIMEOUT_MS),
  };
}

function printResult(result) {
  console.log("Production smoke check");
  console.log(`Base URL: ${result.baseUrl}`);
  console.log(`Checked at: ${result.checkedAt}`);
  console.log("");

  for (const check of result.passed) {
    console.log(`[OK] ${check.label} (${check.durationMs}ms)`);
  }
  for (const check of result.failed) {
    console.error(`[FAIL] ${check.label} (${check.durationMs}ms)`);
    console.error(`  ${check.message}`);
  }

  console.log("");
  if (result.ok) {
    console.log(`Production smoke check: OK (${result.durationMs}ms)`);
  } else {
    console.error(
      `Production smoke check: FAILED (${result.failed.length} failed, ${result.durationMs}ms)`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runProductionSmokeCheck(options);

  if (options.json) {
    const output = result.ok ? console.log : console.error;
    output(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }

  process.exitCode = result.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
