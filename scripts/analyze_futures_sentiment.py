"""
analyze_futures_sentiment.py  v3
期貨市場情緒指標

數據來源：Bybit 期貨公開 API（免費，無需 key，無地理限制）
  F9 Funding Rate：每 8 小時結算一次，負值代表空頭付費多頭（空頭過多）
  F10 Long/Short Ratio：大戶帳戶多空比

策略（解決 GitHub Actions 美國 IP 被 Binance 451 封鎖問題）：
  - 歷史 CSV（funding_rate_history.csv）已在本機用 Binance API 生成，包含 2019 年起完整數據
  - 每次 Actions 執行：讀現有 CSV → 用 Bybit 抓最新 200 筆增量 → 合併去重 → 存回
  - 歷史數據永遠保留，Bybit 只負責追加近期新數據
  - Bybit 抓不到：graceful exit(0)，保留現有 CSV，不中斷 workflow

輸出：
  data/funding_rate_history.csv    ← 逐日歷史（F9 動態回測用）
  data/futures_sentiment_results.csv ← 即時快照（Dashboard 用）
"""

import sys
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timezone, timedelta
import time

DATA_DIR     = Path(__file__).parent.parent / "data"
OUT_HISTORY  = DATA_DIR / "funding_rate_history.csv"
OUT_SNAPSHOT = DATA_DIR / "futures_sentiment_results.csv"

SYMBOLS      = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
BYBIT_URL    = "https://api.bybit.com/v5/market/funding/history"
BYBIT_LS_URL = "https://api.bybit.com/v5/market/account-ratio"


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


# ── Bybit Funding Rate 抓取（最新 200 筆 ≈ 67 天）────────────────────────────

def fetch_bybit_funding(symbol: str) -> pd.DataFrame:
    """
    從 Bybit 抓最新 200 筆 Funding Rate。
    回傳 DataFrame，columns: [fundingTime(UTC datetime), fundingRate(float)]
    """
    try:
        r = requests.get(
            BYBIT_URL,
            params={"category": "linear", "symbol": symbol, "limit": 200},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("retCode") != 0:
            print(f"    ⚠️  Bybit {symbol}: retCode={data.get('retCode')} {data.get('retMsg')}")
            return pd.DataFrame()
        rows = data["result"]["list"]
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows)
        df["fundingTime"] = pd.to_datetime(df["fundingRateTimestamp"].astype(int), unit="ms", utc=True)
        df["fundingRate"] = df["fundingRate"].astype(float)
        return df[["fundingTime", "fundingRate"]].sort_values("fundingTime").reset_index(drop=True)
    except Exception as e:
        print(f"    ⚠️  Bybit fetch error ({symbol}): {e}")
        return pd.DataFrame()


def compute_daily_f9(symbol: str, raw_df: pd.DataFrame) -> pd.DataFrame:
    """
    把每 8h 一筆的 Funding Rate 聚合為逐日數據，計算 F9 normalized score。
    """
    df = raw_df.copy()
    df["date"] = df["fundingTime"].dt.date

    daily = df.groupby("date")["fundingRate"].agg(
        daily_avg="mean",
        daily_min="min",
        daily_max="max",
        daily_count="count",
    ).reset_index()
    daily["date"] = pd.to_datetime(daily["date"])

    # 7 天滾動負值比例（用原始 8h 數據）
    df_sorted = df.sort_values("fundingTime").reset_index(drop=True)
    df_sorted["is_negative"] = (df_sorted["fundingRate"] < 0).astype(int)
    df_sorted["neg_pct_7d"] = df_sorted["is_negative"].rolling(21, min_periods=1).mean()
    last_of_day = df_sorted.groupby("date")["neg_pct_7d"].last().reset_index()
    last_of_day["date"] = pd.to_datetime(last_of_day["date"])

    daily = daily.merge(last_of_day, on="date", how="left")

    daily["f9_norm"] = daily.apply(
        lambda row: clamp01(
            clamp01(0.5 - row["daily_avg"] * 500) * 0.8 +
            (row["neg_pct_7d"] or 0) * 0.2
        ),
        axis=1,
    ).round(4)

    daily["symbol"] = symbol
    return daily[["symbol", "date", "daily_avg", "daily_min", "daily_max", "daily_count", "neg_pct_7d", "f9_norm"]]


# ── Bybit Long/Short Ratio（即時快照）────────────────────────────────────────

def fetch_bybit_ls_snapshot(symbol: str) -> dict:
    try:
        r = requests.get(
            BYBIT_LS_URL,
            params={"category": "linear", "symbol": symbol, "period": "1d", "limit": 1},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("retCode") != 0 or not data["result"]["list"]:
            raise ValueError(f"retCode={data.get('retCode')}")
        d = data["result"]["list"][0]
        long_pct  = round(float(d["buyRatio"]), 4)
        short_pct = round(1.0 - long_pct, 4)
        ratio     = round(long_pct / short_pct, 4) if short_pct > 0 else None
        return {"ls_ratio_latest": ratio, "ls_long_pct": long_pct, "ls_short_pct": short_pct}
    except Exception as e:
        print(f"    ⚠️  Bybit L/S ratio ({symbol}): {e}")
        return {"ls_ratio_latest": None, "ls_long_pct": None, "ls_short_pct": None}


def normalize_f10(ls_short_pct) -> float:
    if ls_short_pct is None:
        return 0.5
    return clamp01((ls_short_pct - 0.20) / 0.35)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── Part 1: 增量更新歷史 CSV ──────────────────────────────────────────────
    print("Updating Funding Rate history (F9, incremental via Bybit)...")

    # 讀取現有歷史 CSV
    if OUT_HISTORY.exists():
        existing = pd.read_csv(OUT_HISTORY, parse_dates=["date"])
        print(f"  Existing history: {len(existing)} rows, latest: {existing['date'].max().date()}")
    else:
        existing = pd.DataFrame()
        print("  No existing history — will build from Bybit data only")

    new_daily_frames = []
    any_bybit_success = False

    for symbol in SYMBOLS:
        print(f"  {symbol}...")
        raw_df = fetch_bybit_funding(symbol)
        if len(raw_df) == 0:
            print(f"    ⚠️  No data from Bybit")
            continue
        any_bybit_success = True
        earliest = raw_df["fundingTime"].min().strftime("%Y-%m-%d")
        latest   = raw_df["fundingTime"].max().strftime("%Y-%m-%d")
        print(f"    → {len(raw_df)} rows from Bybit ({earliest} → {latest})")

        daily_df = compute_daily_f9(symbol, raw_df)
        new_daily_frames.append(daily_df)

    if not any_bybit_success:
        print("⚠️  Bybit unreachable — keeping existing CSVs unchanged")
        sys.exit(0)

    # 合併：現有歷史 + Bybit 新增，去重保留最新
    if new_daily_frames:
        new_daily = pd.concat(new_daily_frames, ignore_index=True)
        if len(existing) > 0:
            combined = pd.concat([existing, new_daily], ignore_index=True)
            combined = combined.drop_duplicates(subset=["symbol", "date"], keep="last")
            combined = combined.sort_values(["symbol", "date"]).reset_index(drop=True)
        else:
            combined = new_daily

        # 截止到昨天
        cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        combined = combined[combined["date"].dt.date <= cutoff]
        combined.to_csv(OUT_HISTORY, index=False)
        print(f"\n✅  funding_rate_history: {len(combined)} rows → {OUT_HISTORY}")
        for sym in SYMBOLS:
            sym_df = combined[combined["symbol"] == sym]
            if len(sym_df) > 0:
                print(f"    {sym}: {sym_df['date'].min().date()} → {sym_df['date'].max().date()} ({len(sym_df)} days)")

    # ── Part 2: 即時快照（Dashboard 用）──────────────────────────────────────
    print("\nFetching snapshot (Dashboard, Bybit)...")
    snapshot_rows = []

    for symbol in SYMBOLS:
        print(f"  {symbol}...")

        # F9：從剛才抓到的 raw Bybit 數據取最後 21 筆
        try:
            raw_df = fetch_bybit_funding(symbol)
            if len(raw_df) > 0:
                last21    = raw_df.tail(21)
                fr_latest = float(raw_df.iloc[-1]["fundingRate"])
                fr_7d_avg = float(last21["fundingRate"].mean())
                neg_pct   = float((last21["fundingRate"] < 0).mean())
                f9_norm   = clamp01(clamp01(0.5 - fr_7d_avg * 500) * 0.8 + neg_pct * 0.2)
            else:
                fr_latest = fr_7d_avg = neg_pct = 0.0
                f9_norm = 0.5
        except Exception:
            fr_latest = fr_7d_avg = neg_pct = 0.0
            f9_norm = 0.5

        ls = fetch_bybit_ls_snapshot(symbol)
        f10_norm = normalize_f10(ls["ls_short_pct"])

        snapshot_rows.append({
            "symbol":               symbol,
            "date":                 today,
            "funding_rate_latest":  round(fr_latest, 8),
            "funding_rate_7d_avg":  round(fr_7d_avg, 8),
            "funding_rate_neg_pct": round(neg_pct, 4),
            **ls,
            "f9_norm":              round(f9_norm, 4),
            "f10_norm":             round(f10_norm, 4),
        })

        ls_ratio_str = f"{ls['ls_ratio_latest']:.4f}" if ls["ls_ratio_latest"] is not None else "N/A"
        ls_short_str = f"{ls['ls_short_pct']:.4f}"   if ls["ls_short_pct"]    is not None else "N/A"
        print(f"    FR latest={fr_latest:.6f}, 7d_avg={fr_7d_avg:.6f}, neg={neg_pct:.0%}, f9={f9_norm:.3f}")
        print(f"    L/S ratio={ls_ratio_str}, short={ls_short_str}, f10={f10_norm:.3f}")

    snap_df = pd.DataFrame(snapshot_rows)
    snap_df.to_csv(OUT_SNAPSHOT, index=False)
    print(f"\n✅  futures_sentiment_results: {len(snap_df)} rows → {OUT_SNAPSHOT}")


if __name__ == "__main__":
    main()
