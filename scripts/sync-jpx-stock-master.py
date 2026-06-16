#!/usr/bin/env python3
"""Generate the local JPX stock master from the official listed-company Excel."""

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


def market_segment(product: str) -> str:
    return product.split("（", 1)[0].strip()


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

    domestic_equities = data[data["市場・商品区分"].str.contains("内国株式", regex=False)]
    updated_at = normalize_date(str(domestic_equities["日付"].iloc[0]))

    stocks = []
    for row in domestic_equities.to_dict("records"):
        product = str(row["市場・商品区分"]).strip()
        stocks.append(
            {
                "code": str(row["コード"]).strip(),
                "name": str(row["銘柄名"]).strip(),
                "marketSegment": market_segment(product),
                "marketProduct": product,
                "sector33": str(row["33業種区分"]).strip(),
                "sector17": str(row["17業種区分"]).strip(),
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
    print(f"Wrote {len(stocks)} JPX domestic equities to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
