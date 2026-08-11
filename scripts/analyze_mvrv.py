"""
analyze_mvrv.py  v1
F13 MVRV Z-Score（市值 vs 實現價值）

數據來源：CoinMetrics Community API（完全免費，無需 key）
  BTC：2014-09-23 起
  ETH：2017-01-01 起
  SOL：不支援 → 用 BTC 值代替（兩者市場周期高度相關）

設計邏輯：
  MVRV < 1.0 = 市值低於實現價值 = 歷史底部區域 → f13_norm 高（看多）
  MVRV 1.0–2.0 = 正常範圍 → 中性
  MVRV > 3.0 = 市場過熱，頂部警告 → f13_norm 低（看空）

normalize 公式：
  f13_norm = clamp01(1 - (mvrv - MVRV_LOW) / (MVRV_HIGH - MVRV_LOW))
  MVRV_LOW = 0.5（極度低估，最強買入信號）
  MVRV_HIGH = 3.5（極度高估，最強賣出信號）
  → MVRV=0.5 → f13=1.0，MVRV=2.0 → f13=0.5，MVRV=3.5 → f13=0.0

策略（增量更新）：
  - 本機初次執行：抓完整歷史
  - GitHub Actions 每日：只抓最新 30 天增量，合併去重
  - API 不可用：graceful exit(0)，保留現有 CSV

輸出：
  data/mvrv_history.csv  ← 逐日 MVRV + f13_norm（XGBoost 用）
"""

from __future__ import annotations

import sys
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timezone, timedelta

DATA_DIR    = Path(__file__).parent.parent / "data"
OUT_HISTORY = DATA_DIR / "mvrv_history.csv"

COINMETRICS_URL = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"

# normalize 範圍
MVRV_LOW  = 0.5   # → f13_norm = 1.0（極度低估）
MVRV_HIGH = 3.5   # → f13_norm = 0.0（極度高估）


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def fetch_mvrv(asset: str, start_date: str, end_date: str) -> pd.DataFrame:
    """
    從 CoinMetrics Community API 抓 CapMVRVCur（支援分頁，抓完整歷史）。
    回傳 DataFrame，columns: [date(datetime64), mvrv(float)]
    """
    all_rows = []
    next_page = None

    while True:
        try:
            params = {
                "assets":      asset,
                "metrics":     "CapMVRVCur",
                "frequency":   "1d",
                "start_time":  start_date,
                "end_time":    end_date,
                "page_size":   1000,
            }
            if next_page:
                params["next_page_token"] = next_page

            r = requests.get(COINMETRICS_URL, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            rows = data.get("data", [])
            all_rows.extend(rows)

            next_page = data.get("next_page_token")
            if not next_page or not rows:
                break

        except Exception as e:
            print(f"    ⚠️  CoinMetrics fetch error ({asset}): {e}")
            break

    if not all_rows:
        return pd.DataFrame()

    df = pd.DataFrame(all_rows)
    df["date"] = pd.to_datetime(df["time"]).dt.normalize()
    df["mvrv"] = pd.to_numeric(df["CapMVRVCur"], errors="coerce")
    return df[["date", "mvrv"]].dropna().sort_values("date").reset_index(drop=True)


def compute_f13(mvrv_val: float) -> float:
    """
    normalize MVRV → f13_norm [0, 1]
    低 MVRV（低估）= 高分（看多信號）
    """
    return clamp01(1.0 - (mvrv_val - MVRV_LOW) / (MVRV_HIGH - MVRV_LOW))


def main():
    today     = datetime.now(timezone.utc).date()
    yesterday = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    print("Updating MVRV history (F13, CoinMetrics Community API)...")

    # 讀取現有歷史
    if OUT_HISTORY.exists():
        existing = pd.read_csv(OUT_HISTORY, parse_dates=["date"])
        latest_date = existing["date"].max().date()
        print(f"  Existing history: {len(existing)} rows, latest: {latest_date}")
        # 增量：只抓最新 30 天
        start_date = (latest_date - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        existing   = pd.DataFrame()
        start_date = "2014-01-01"
        print("  No existing history — fetching full history from 2014")

    # 抓 BTC（2014 起）和 ETH（2017 起）
    print(f"  Fetching BTC MVRV ({start_date} → {yesterday})...")
    btc_df = fetch_mvrv("btc", start_date, yesterday)
    print(f"    → {len(btc_df)} rows")

    print(f"  Fetching ETH MVRV ({start_date} → {yesterday})...")
    eth_df = fetch_mvrv("eth", start_date, yesterday)
    print(f"    → {len(eth_df)} rows")

    if len(btc_df) == 0 and len(eth_df) == 0:
        print("⚠️  CoinMetrics unreachable — keeping existing CSV unchanged")
        sys.exit(0)

    # 組合三個幣種
    frames = []

    if len(btc_df) > 0:
        btc_out          = btc_df.copy()
        btc_out["symbol"] = "BTCUSDT"
        btc_out["f13_norm"] = btc_out["mvrv"].apply(compute_f13).round(4)
        frames.append(btc_out[["symbol", "date", "mvrv", "f13_norm"]])

    if len(eth_df) > 0:
        eth_out          = eth_df.copy()
        eth_out["symbol"] = "ETHUSDT"
        eth_out["f13_norm"] = eth_out["mvrv"].apply(compute_f13).round(4)
        frames.append(eth_out[["symbol", "date", "mvrv", "f13_norm"]])

    # SOL：用 BTC 值代替（市場周期高度相關，BTC MVRV 作代理信號）
    if len(btc_df) > 0:
        sol_out           = btc_df.copy()
        sol_out["symbol"] = "SOLUSDT"
        sol_out["f13_norm"] = sol_out["mvrv"].apply(compute_f13).round(4)
        frames.append(sol_out[["symbol", "date", "mvrv", "f13_norm"]])

    new_data = pd.concat(frames, ignore_index=True)

    # 合併現有 + 新增，去重保留最新
    if len(existing) > 0:
        combined = pd.concat([existing, new_data], ignore_index=True)
        combined = combined.drop_duplicates(subset=["symbol", "date"], keep="last")
        combined = combined.sort_values(["symbol", "date"]).reset_index(drop=True)
    else:
        combined = new_data

    combined.to_csv(OUT_HISTORY, index=False)
    print(f"\n✅  mvrv_history: {len(combined)} rows → {OUT_HISTORY}")

    for sym in ["BTCUSDT", "ETHUSDT", "SOLUSDT"]:
        sym_df = combined[combined["symbol"] == sym]
        if len(sym_df) > 0:
            latest = sym_df.iloc[-1]
            proxy  = " (BTC proxy)" if sym == "SOLUSDT" else ""
            print(f"    {sym}{proxy}: {sym_df['date'].min().date()} → {sym_df['date'].max().date()} "
                  f"({len(sym_df)} days) | latest MVRV={latest['mvrv']:.3f}, f13={latest['f13_norm']:.3f}")


if __name__ == "__main__":
    main()
