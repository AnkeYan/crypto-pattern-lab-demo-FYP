"""
analyze_active_addresses.py
BTC 鏈上活躍地址（F11）

數據來源：Blockchain.com API（免費，無需 key，無地理限制）
  URL: https://api.blockchain.info/charts/n-unique-addresses?timespan=all&format=json
  BTC 每日唯一活躍地址數，從 2009 年起（用於校準從 2014-09-17 起）

F11 設計邏輯：
  - 計算當天活躍地址相對於 30 天移動均線的偏離程度
  - 地址數萎縮（低於均線）→ 高分（用戶恐慌退出，歷史上常見底部特徵）
  - 地址數活躍（高於均線）→ 低分（市場熱絡，非超賣信號）
  - 公式：ratio = addr / ma30，ratio < 1 → 高分，ratio > 1 → 低分
  - 正規化：f11_norm = clamp(0.5 + (1 - ratio) * 2, 0, 1)
    - ratio=0.7（比均線低 30%）→ f11_norm=0.90
    - ratio=1.0（等於均線）     → f11_norm=0.50
    - ratio=1.3（比均線高 30%）→ f11_norm=0.10

只做 BTC（ETH/SOL 無免費歷史鏈上數據）。
ETH/SOL 在 calibration / XGBoost 中 f11_norm = 0.5（中性，不影響分數）。

輸出 data/active_addresses_history.csv
Schema: date, addr_count, ma30, ratio, f11_norm
"""

import sys
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timezone, timedelta

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "active_addresses_history.csv"

API_URL  = "https://api.blockchain.info/charts/n-unique-addresses?timespan=all&format=json"


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def fetch_active_addresses() -> pd.DataFrame:
    """
    從 Blockchain.com 抓取 BTC 全歷史每日活躍地址數。
    回傳 DataFrame，columns: [date(datetime), addr_count(float)]
    """
    try:
        r = requests.get(API_URL, timeout=20)
        r.raise_for_status()
        data = r.json()
        vals = data.get("values", [])
        if not vals:
            print("⚠️  No data returned from Blockchain.com API")
            return pd.DataFrame()

        df = pd.DataFrame(vals)                          # columns: x, y
        df = df.rename(columns={"x": "timestamp", "y": "addr_count"})
        df["date"] = pd.to_datetime(df["timestamp"].astype(int), unit="s", utc=True).dt.normalize()
        df = df[["date", "addr_count"]].sort_values("date").reset_index(drop=True)
        return df

    except Exception as e:
        print(f"⚠️  Blockchain.com API error: {e}")
        return pd.DataFrame()


def compute_f11(df: pd.DataFrame) -> pd.DataFrame:
    """
    計算 30 天移動均線、ratio、f11_norm。
    """
    df = df.copy()
    df["ma30"]    = df["addr_count"].rolling(30, min_periods=15).mean()
    df["ratio"]   = df["addr_count"] / df["ma30"].replace(0, np.nan)

    # f11_norm：ratio < 1（地址萎縮）→ 高分；ratio > 1 → 低分
    # clamp(0.5 + (1 - ratio) * 2, 0, 1)
    df["f11_norm"] = df["ratio"].apply(
        lambda r: clamp01(0.5 + (1.0 - r) * 2.0) if pd.notna(r) else 0.5
    ).round(4)

    df["ma30"]  = df["ma30"].round(0)
    df["ratio"] = df["ratio"].round(4)
    return df[["date", "addr_count", "ma30", "ratio", "f11_norm"]]


def main():
    print("Fetching BTC Active Addresses (F11) from Blockchain.com...")

    raw_df = fetch_active_addresses()
    if len(raw_df) == 0:
        print("❌  No data — keeping existing CSV if present")
        sys.exit(0)

    print(f"  → {len(raw_df)} rows fetched ({raw_df['date'].min().date()} → {raw_df['date'].max().date()})")

    # 截止到昨天（不含今天未完整數據）
    cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    cutoff_ts = pd.Timestamp(cutoff, tz="UTC")
    raw_df = raw_df[raw_df["date"] <= cutoff_ts].reset_index(drop=True)

    result_df = compute_f11(raw_df)

    # 去掉 ma30 尚未穩定的前 14 行（min_periods=15）
    result_df = result_df.dropna(subset=["ma30"]).reset_index(drop=True)

    result_df.to_csv(OUT_PATH, index=False)
    print(f"✅  active_addresses_history: {len(result_df)} rows → {OUT_PATH}")
    print(f"    Date range: {result_df['date'].min().date()} → {result_df['date'].max().date()}")
    print(f"    f11_norm range: {result_df['f11_norm'].min():.3f} – {result_df['f11_norm'].max():.3f}")
    print(f"    Latest: addr={result_df.iloc[-1]['addr_count']:.0f}, "
          f"ma30={result_df.iloc[-1]['ma30']:.0f}, "
          f"ratio={result_df.iloc[-1]['ratio']:.3f}, "
          f"f11={result_df.iloc[-1]['f11_norm']:.3f}")


if __name__ == "__main__":
    main()
