"""
analyze_btc_dominance.py
BTC Dominance 變化率 — F15

數據來源：CoinGecko /api/v3/global（免費，無需 API key）
BTC Dominance = BTC 市值 / 全市場市值（%）

F15 設計邏輯：
  BTC Dom 上升 → 資金從 Altcoin 流回 BTC（避險情緒）
    → 對 BTC：中性偏正（資金流入）
    → 對 ETH/SOL：偏負（Altcoin 失血）
  BTC Dom 下降 → 資金流向 Altcoin（風險偏好上升）
    → 對 BTC：中性偏負
    → 對 ETH/SOL：偏正（Altcoin 季節）

F15 = 7日 BTC Dom 變化率（今天 - 7天前，百分點差值）
  分幣種給分：BTC 與 ETH/SOL 方向相反

歸一化設計（scale = 差值 ±3 個百分點為極端值）：
  BTC:
    dom 上升 +3pp → f15 = 0.75（略正，資金流入）
    dom 持平  0pp → f15 = 0.5
    dom 下降 -3pp → f15 = 0.25
  ETH/SOL（反向）：
    dom 上升 +3pp → f15 = 0.25（Altcoin 失血 = 偏負）
    dom 持平  0pp → f15 = 0.5
    dom 下降 -3pp → f15 = 0.75（Altcoin 季節 = 偏正）

策略（參考 F9 增量模式）：
  - 本地存 btc_dominance_history.csv（逐日快照）
  - 每次執行：抓今天快照 → 追加到 CSV → 計算 7d 差值
  - API 失敗：graceful exit(0)，保留現有 CSV

輸出：
  data/btc_dominance_history.csv   ← 逐日歷史（F15 動態回測用）
  data/btc_dominance_results.csv   ← 即時快照（Dashboard 用）
"""

import sys
import requests
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

DATA_DIR     = Path(__file__).parent.parent / "data"
OUT_HISTORY  = DATA_DIR / "btc_dominance_history.csv"
OUT_SNAPSHOT = DATA_DIR / "btc_dominance_results.csv"

SYMBOLS      = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
COINGECKO_URL = "https://api.coingecko.com/api/v3/global"


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def fetch_btc_dominance() -> Optional[float]:
    """從 CoinGecko 抓當前 BTC Dominance（%）。失敗回傳 None。"""
    try:
        r = requests.get(COINGECKO_URL, timeout=15)
        r.raise_for_status()
        data = r.json()
        btc_dom = float(data["data"]["market_cap_percentage"]["btc"])
        print(f"  CoinGecko BTC Dominance: {btc_dom:.4f}%")
        return btc_dom
    except Exception as e:
        print(f"  ⚠️  CoinGecko fetch failed: {e}")
        return None



def fetch_dominance_history(days: int = 30) -> pd.DataFrame:
    """
    從 CoinGecko 抓最近 N 天的 BTC dominance 歷史（近似值）。
    用 BTC market cap history / implied total market cap 計算。
    回傳 DataFrame: [date, btc_dominance]
    """
    try:
        # 抓 BTC market cap 歷史
        r1 = requests.get(
            "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
            params={"vs_currency": "usd", "days": days, "interval": "daily"},
            timeout=15,
        )
        r1.raise_for_status()
        btc_mc_hist = r1.json().get("market_caps", [])
        if not btc_mc_hist:
            return pd.DataFrame()

        # 用最後一點反算 implied total market cap
        r2 = requests.get(COINGECKO_URL, timeout=15)
        r2.raise_for_status()
        g = r2.json()["data"]
        current_btc_dom = float(g["market_cap_percentage"]["btc"])
        latest_btc_mc   = float(btc_mc_hist[-1][1])
        implied_total   = latest_btc_mc / (current_btc_dom / 100)

        rows = []
        seen_dates = set()
        for ts, mc in btc_mc_hist:
            date_str = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            if date_str in seen_dates:
                continue
            seen_dates.add(date_str)
            dom = round(mc / implied_total * 100, 4)
            rows.append({"date": date_str, "btc_dominance": dom})

        df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
        print(f"  Backfilled {len(df)} days of BTC dominance history")
        return df

    except Exception as e:
        print(f"  ⚠️  History backfill failed: {e}")
        return pd.DataFrame()

def compute_f15(dom_change_7d: float, symbol: str) -> float:
    """
    把 7d BTC Dom 差值轉成 f15_cont (0–1)。
    BTC：dom 上升 = 高分；ETH/SOL：dom 上升 = 低分（反向）。
    scale: ±3 個百分點為極端值。
    """
    # 每 1pp 差值對應 0.25/3 ≈ 0.0833 的分數偏移
    if symbol == "BTCUSDT":
        return clamp01(0.5 + dom_change_7d * (0.25 / 3.0))
    else:
        # ETH/SOL 反向
        return clamp01(0.5 - dom_change_7d * (0.25 / 3.0))


def main():
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── 首次執行：先 backfill 30 天歷史 ─────────────────────────────────────
    if not OUT_HISTORY.exists():
        print("  First run: backfilling 30 days of BTC dominance history...")
        hist_backfill = fetch_dominance_history(days=30)
        if not hist_backfill.empty:
            hist_backfill.to_csv(OUT_HISTORY, index=False)
            print(f"  ✅  Backfilled {len(hist_backfill)} rows → {OUT_HISTORY}")

    # ── 抓今天的 BTC Dom ─────────────────────────────────────────────────────
    btc_dom = fetch_btc_dominance()
    if btc_dom is None:
        print("  ⚠️  CoinGecko unavailable. Keeping existing CSV.")
        # 如果 CSV 存在就繼續用舊數據算 snapshot，否則 graceful exit
        if not OUT_HISTORY.exists():
            print("  ❌  No existing history. Exiting.")
            sys.exit(0)
    else:
        # ── 追加到歷史 CSV ────────────────────────────────────────────────────
        new_row = pd.DataFrame([{
            "date":           today_str,
            "btc_dominance":  round(btc_dom, 4),
        }])

        if OUT_HISTORY.exists():
            hist_df = pd.read_csv(OUT_HISTORY)
            # 去重（同一天只保留最新）
            hist_df = hist_df[hist_df["date"] != today_str]
            hist_df = pd.concat([hist_df, new_row], ignore_index=True)
        else:
            hist_df = new_row

        hist_df = hist_df.sort_values("date").reset_index(drop=True)
        hist_df.to_csv(OUT_HISTORY, index=False)
        print(f"  ✅  btc_dominance_history: {len(hist_df)} rows → {OUT_HISTORY}")

    # ── 讀取歷史，計算 7d 差值 ────────────────────────────────────────────────
    hist_df = pd.read_csv(OUT_HISTORY, parse_dates=["date"])
    hist_df = hist_df.sort_values("date").reset_index(drop=True)

    if len(hist_df) < 2:
        print("  ⚠️  Not enough history for 7d diff. Need at least 2 rows.")
        sys.exit(0)

    latest_dom = float(hist_df["btc_dominance"].iloc[-1])

    # 7d 差值：找 7 天前最近的數據點
    latest_date = hist_df["date"].iloc[-1]
    target_date = latest_date - pd.Timedelta(days=7)
    past_7d = hist_df[hist_df["date"] <= target_date]

    if len(past_7d) > 0:
        dom_7d_ago   = float(past_7d["btc_dominance"].iloc[-1])
        dom_change_7d = latest_dom - dom_7d_ago
    else:
        dom_change_7d = 0.0
        dom_7d_ago    = latest_dom

    print(f"  BTC Dom: {latest_dom:.4f}% (7d ago: {dom_7d_ago:.4f}%, change: {dom_change_7d:+.4f}pp)")

    # ── 為每個幣種計算 f15 ────────────────────────────────────────────────────
    snapshot_rows = []
    for symbol in SYMBOLS:
        f15_cont = compute_f15(dom_change_7d, symbol)

        direction = "↑ rising" if dom_change_7d > 0.5 else ("↓ falling" if dom_change_7d < -0.5 else "→ stable")
        if symbol == "BTCUSDT":
            interp = "BTC inflow signal" if dom_change_7d > 0.5 else ("Altcoin season signal" if dom_change_7d < -0.5 else "neutral")
        else:
            interp = "Altcoin season signal" if dom_change_7d < -0.5 else ("BTC dominance rising (cautious)" if dom_change_7d > 0.5 else "neutral")

        snapshot_rows.append({
            "symbol":         symbol,
            "date":           today_str,
            "btc_dominance":  round(latest_dom, 4),
            "dom_7d_ago":     round(dom_7d_ago, 4),
            "dom_change_7d":  round(dom_change_7d, 4),
            "direction":      direction,
            "f15_cont":       round(f15_cont, 4),
            "interpretation": interp,
        })
        print(f"  {symbol}: dom_change_7d={dom_change_7d:+.4f}pp → f15_cont={f15_cont:.4f} ({interp})")

    snap_df = pd.DataFrame(snapshot_rows)
    snap_df.to_csv(OUT_SNAPSHOT, index=False)
    print(f"  ✅  btc_dominance_results: {len(snap_df)} rows → {OUT_SNAPSHOT}")


if __name__ == "__main__":
    main()
