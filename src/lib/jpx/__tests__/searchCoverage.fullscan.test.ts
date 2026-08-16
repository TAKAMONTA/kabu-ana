import { describe, expect, it } from "vitest";
import { JPX_STOCK_MASTER } from "../stockMaster";
import {
  crossAssetSummary,
  equitiesOf,
  expectedNoMiss,
  missSummary,
  nonEquitiesOf,
  scanSelfResolution,
} from "./coverageHelpers";

/**
 * 銘柄マスタ**全件**の「名称（＋別名）→ 自コード」総当たり。
 *
 * 既定スイート（`npx vitest run`）からは vitest.config.ts の exclude で外し、
 * `npm run test:jpx-fullscan` でのみ実行する。全件は数十秒かかるため、
 * 日常のテスト実行を遅くしないための分離である（サンプル版は searchCoverage.test.ts）。
 *
 * 判定ロジックは coverageHelpers に集約しており、サンプル版と完全に同一。
 */

const equities = equitiesOf(JPX_STOCK_MASTER);
const nonEquities = nonEquitiesOf(JPX_STOCK_MASTER);

const SCAN_TIMEOUT_MS = 600_000;

describe("full scan: every master entry resolves to itself", () => {
  it(
    "(a) resolves every equity name and alias to its own code",
    () => {
      const report = scanSelfResolution(equities, { includeAliases: true });
      console.info(
        `[fullscan][a] equities: ${report.ok}/${report.total} ok, ` +
          `${report.misses.length} miss, ${report.crossAssetMisses.length} cross-asset`
      );

      expect(missSummary(report, 200)).toBe(expectedNoMiss(report));
    },
    SCAN_TIMEOUT_MS
  );

  it(
    "(b) resolves every non-equity name to its own code",
    () => {
      const report = scanSelfResolution(nonEquities, { includeAliases: true });
      console.info(
        `[fullscan][b] funds: ${report.ok}/${report.total} ok, ` +
          `${report.misses.length} miss, ${report.crossAssetMisses.length} cross-asset`
      );

      expect(missSummary(report, 200)).toBe(expectedNoMiss(report));
    },
    SCAN_TIMEOUT_MS
  );

  it(
    "(c) never hijacks across the equity / fund boundary in either direction",
    () => {
      const equityReport = scanSelfResolution(equities, {
        includeAliases: true,
      });
      const fundReport = scanSelfResolution(nonEquities, {
        includeAliases: true,
      });
      const crossAsset = [
        ...equityReport.crossAssetMisses,
        ...fundReport.crossAssetMisses,
      ];
      console.info(
        `[fullscan][c] cross-asset hijacks: ${crossAsset.length} ` +
          `(equity->fund ${equityReport.crossAssetMisses.length}, ` +
          `fund->equity ${fundReport.crossAssetMisses.length}) ` +
          `over ${equityReport.total + fundReport.total} queries`
      );

      expect(crossAssetSummary(crossAsset, 200)).toBe("0 cross-asset");
    },
    SCAN_TIMEOUT_MS
  );
});
