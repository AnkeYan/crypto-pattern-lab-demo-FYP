"""
analyze_halving.py
Bitcoin Halving Cycle Analysis

定義：
  已知 BTC Halving 日期：
    Halving 1: 2012-11-28（BTC 數據從 2017-08 開始，此次不包含）
    Halving 2: 2016-07-09（數據覆蓋，計算 -180d to +365d）
    Halving 3: 2020-05-11
    Halving 4: 2024-04-20

對每次 Halving 計算：
  - 前 30/90/180 天的回報
  - 後 30/90/180/365 天的回報
  - 前後各天的價格（相對 Halving 日當天標準化 = 1.0）

輸出 data/halving_results.csv
Schema:
  halving_number, date, btc_price_at_halving,
  pre_30d_return, pre_90d_return, pre_180d_return,
  post_30d_return, post_90d_return, post_180d_return, post_365d_return,
  pre_30d_available, pre_90d_available, pre_180d_available,
  post_30d_available, post_90d_available, post_180d_available, post_365d_available

另外輸出 halving_price_path.csv：
  halving_number, date, day_offset, relative_price
  （-180 to +365 天，每天一行，relative_price = 當天價格 / Halving 當天價格）
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR  = Path(__file__).parent.parent / "data"
OUT_STATS = DATA_DIR / "halving_results.csv"
OUT_PATH  = DATA_DIR / "halving_price_path.csv"

# Known BTC Halving dates
HALVINGS = [
    {"number": 2, "date": "2016-07-09"},
    {"number": 3, "date": "2020-05-11"},
    {"number": 4, "date": "2024-04-20"},
]

PRE_WINDOWS  = [30, 90, 180]
POST_WINDOWS = [30, 90, 180, 365]
PATH_RANGE   = (-180, 365)   # day_offset range for price path output


def analyze_halvings():
    df = pd.read_csv(DATA_DIR / "BTCUSDT.csv")
    df["date"] = pd.to_datetime(df["open_time"], unit="ms").dt.normalize()
    df = df.sort_values("date").drop_duplicates("date").reset_index(drop=True)
    close = df.set_index("date")["close"].astype(float)

    stats_rows = []
    path_rows  = []

    for h in HALVINGS:
        halving_date = pd.Timestamp(h["date"])
        number       = h["number"]

        # Find closest available trading day
        if halving_date not in close.index:
            # Get nearest date
            available = close.index[close.index >= halving_date]
            if len(available) == 0:
                print(f"  Halving {number} ({h['date']}): no post-halving data, skipping")
                continue
            halving_date = available[0]

        halving_price = float(close.loc[halving_date])
        print(f"  Halving {number}: {halving_date.date()}, price=${halving_price:,.2f}")

        # ── Stats row ──────────────────────────────────────────────────────────
        row = {
            "halving_number":      number,
            "date":                halving_date.strftime("%Y-%m-%d"),
            "btc_price_at_halving": round(halving_price, 2),
        }

        for w in PRE_WINDOWS:
            target_date = halving_date - pd.Timedelta(days=w)
            available = close.index[close.index <= target_date]
            if len(available) > 0:
                price_then = float(close.loc[available[-1]])
                ret = (halving_price - price_then) / price_then
                row[f"pre_{w}d_return"]    = round(ret, 6)
                row[f"pre_{w}d_available"] = True
            else:
                row[f"pre_{w}d_return"]    = None
                row[f"pre_{w}d_available"] = False

        for w in POST_WINDOWS:
            target_date = halving_date + pd.Timedelta(days=w)
            available = close.index[close.index <= target_date]
            # Use last available date on or before target_date
            future = close.index[close.index >= halving_date + pd.Timedelta(days=1)]
            future_target = close.index[close.index <= target_date]
            future_target = future_target[future_target > halving_date]
            if len(future_target) > 0:
                price_then = float(close.loc[future_target[-1]])
                ret = (price_then - halving_price) / halving_price
                row[f"post_{w}d_return"]    = round(ret, 6)
                row[f"post_{w}d_available"] = True
            else:
                row[f"post_{w}d_return"]    = None
                row[f"post_{w}d_available"] = False

        stats_rows.append(row)

        # ── Price path ─────────────────────────────────────────────────────────
        for offset in range(PATH_RANGE[0], PATH_RANGE[1] + 1):
            target_date = halving_date + pd.Timedelta(days=offset)
            # Find nearest available date (within 3 days)
            nearby = close.index[
                (close.index >= target_date - pd.Timedelta(days=2)) &
                (close.index <= target_date + pd.Timedelta(days=2))
            ]
            if len(nearby) > 0:
                nearest = nearby[abs(nearby - target_date).argmin()]
                rel_price = float(close.loc[nearest]) / halving_price
                path_rows.append({
                    "halving_number": number,
                    "date":           nearest.strftime("%Y-%m-%d"),
                    "day_offset":     offset,
                    "relative_price": round(rel_price, 6),
                })

    # Save
    pd.DataFrame(stats_rows).to_csv(OUT_STATS, index=False)
    pd.DataFrame(path_rows).to_csv(OUT_PATH, index=False)

    print(f"\n✅  halving_results:    {len(stats_rows)} rows → {OUT_STATS}")
    print(f"✅  halving_price_path: {len(path_rows)} rows → {OUT_PATH}")

    # Print summary
    print("\n=== Halving Summary ===")
    for row in stats_rows:
        print(f"\n  Halving #{row['halving_number']} ({row['date']}) @ ${row['btc_price_at_halving']:,.2f}")
        for w in PRE_WINDOWS:
            ret = row.get(f"pre_{w}d_return")
            avail = row.get(f"pre_{w}d_available")
            ret_str = f"{ret*100:+.1f}%" if ret is not None else "N/A"
            print(f"    Pre-{w}d:  {ret_str}" + (" [no data]" if not avail else ""))
        for w in POST_WINDOWS:
            ret = row.get(f"post_{w}d_return")
            avail = row.get(f"post_{w}d_available")
            ret_str = f"{ret*100:+.1f}%" if ret is not None else "still ahead"
            print(f"    Post-{w}d: {ret_str}" + (" [no data]" if not avail else ""))


if __name__ == "__main__":
    analyze_halvings()
