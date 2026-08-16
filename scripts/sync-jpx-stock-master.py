#!/usr/bin/env python3
"""Generate the local JPX stock master from the official listed-company Excel.

収録対象は「内国株式（プライム/スタンダード/グロース）」に加えて
「ETF・ETN」と「REIT・ベンチャーファンド・カントリーファンド・インフラファンド」。
各エントリには assetType（equity / etf / reit）を付与する。

収録しない区分とその理由:
  - PRO Market: 特定投資家向け市場で一般投資家は売買できないため、
    検索できても発注・投資判断につながらない。
  - 外国株式（プライム/スタンダード/グロース）: 計5銘柄のみ。
    国内株と銘柄コード体系・情報源の前提が異なり、今回のスコープ外。
  - 出資証券: 計2銘柄のみ。協同組織金融機関の優先出資証券で、
    株式ともファンドとも異なる扱いが必要なため今回のスコープ外。
いずれも将来必要になった場合は ASSET_TYPE_BY_PRODUCT に追加すれば収録できる。
"""

from __future__ import annotations

import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE_URL = "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xls"
ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "src" / "lib" / "jpx" / "stockMaster.generated.json"


def load_pandas():
    try:
        import pandas as pd

        return pd
    except ImportError as exc:
        raise SystemExit(
            "pandas and xlrd are required to parse JPX .xls files. "
            "Install them in your local tooling environment, then rerun this script."
        ) from exc


def source_xls_path() -> Path:
    local_path = os.environ.get("JPX_STOCK_MASTER_XLS")
    if local_path:
        return Path(local_path).expanduser().resolve()

    target = Path(tempfile.gettempdir()) / "jpx-listed-companies-data_j.xls"
    urllib.request.urlretrieve(SOURCE_URL, target)
    return target


def normalize_date(raw: str) -> str:
    value = raw.strip()
    if len(value) == 8 and value.isdigit():
        return f"{value[:4]}-{value[4:6]}-{value[6:8]}"
    return value


# 「市場・商品区分」の完全一致値 → assetType。内国株式だけは
# 「プライム（内国株式）」のように市場名が前置されるため部分一致で判定する。
DOMESTIC_EQUITY_MARKER = "内国株式"
ETF_PRODUCT = "ETF・ETN"
FUND_PRODUCT = "REIT・ベンチャーファンド・カントリーファンド・インフラファンド"
ASSET_TYPE_BY_PRODUCT = {
    ETF_PRODUCT: "etf",
    FUND_PRODUCT: "reit",
}

# 非個別株の marketSegment 表示ラベル。個別株の marketSegment は
# 「プライム/スタンダード/グロース」という*市場*の名前だが、ETF・REIT には
# 対応する市場区分が存在しない（区分そのものが商品種別）。UIでは
# `${marketSegment} / ${sector33}` の形で表示されるため、33文字の生値
# （FUND_PRODUCT）をそのまま出すと読めない。生値は marketProduct に残す。
MARKET_SEGMENT_BY_ASSET_TYPE = {
    "etf": "ETF・ETN",
    "reit": "REIT・ファンド",
}

# 業種・規模欄の欠損表現。ETF/REIT行は全業種欄がこの値になる。
MISSING_VALUES = {"-", "－", "−", "―", "‐"}


def classify_asset_type(product: str) -> str | None:
    """「市場・商品区分」から assetType を決める。収録対象外は None。"""
    if DOMESTIC_EQUITY_MARKER in product:
        return "equity"
    return ASSET_TYPE_BY_PRODUCT.get(product)


def market_segment(product: str, asset_type: str) -> str:
    if asset_type == "equity":
        return product.split("（", 1)[0].strip()
    return MARKET_SEGMENT_BY_ASSET_TYPE[asset_type]


def normalize_missing(value: str) -> str:
    """欠損記号（"-" 等）を空文字に畳む。UIに "-" を出さないため。"""
    text = str(value).strip()
    return "" if text in MISSING_VALUES else text


def main() -> None:
    pd = load_pandas()
    xls_path = source_xls_path()
    data = pd.read_excel(xls_path, dtype=str).fillna("")

    required_columns = [
        "日付",
        "コード",
        "銘柄名",
        "市場・商品区分",
        "33業種区分",
        "17業種区分",
    ]
    missing = [column for column in required_columns if column not in data.columns]
    if missing:
        raise SystemExit(f"JPX file is missing expected columns: {', '.join(missing)}")

    asset_types = data["市場・商品区分"].map(
        lambda product: classify_asset_type(str(product).strip())
    )
    listed = data[asset_types.notna()]
    if listed.empty:
        raise SystemExit("JPX file contains no rows for the collected market segments")
    updated_at = normalize_date(str(listed["日付"].iloc[0]))

    stocks = []
    counts: dict[str, int] = {}
    for row in listed.to_dict("records"):
        product = str(row["市場・商品区分"]).strip()
        asset_type = classify_asset_type(product)
        assert asset_type is not None  # listed 側で除外済み
        counts[asset_type] = counts.get(asset_type, 0) + 1
        stocks.append(
            {
                "code": str(row["コード"]).strip(),
                "name": str(row["銘柄名"]).strip(),
                "marketSegment": market_segment(product, asset_type),
                "marketProduct": product,
                # ETF/REIT行は業種欄がすべて "-"。空文字に正規化する。
                "sector33": normalize_missing(row["33業種区分"]),
                "sector17": normalize_missing(row["17業種区分"]),
                "assetType": asset_type,
            }
        )

    payload = {
        "sourceUrl": SOURCE_URL,
        "updatedAt": updated_at,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "stocks": stocks,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    breakdown = ", ".join(f"{key}={counts[key]}" for key in sorted(counts))
    print(f"Wrote {len(stocks)} JPX listed instruments ({breakdown}) to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
