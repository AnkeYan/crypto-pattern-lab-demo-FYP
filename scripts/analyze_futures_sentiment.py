"""
analyze_futures_sentiment.py
期貨市場情緒指標 — F9 Funding Rate + F10 Long/Short Ratio

數據來源：Binance 期貨公開 API（無需 key，無地理限制）
  F9 Funding Rate：每 8 小時結算一次，負值代表空頭付費多頭（空頭過多）
  F10 Long/Short Ratio：大戶帳戶多空比，反映主力資金方向

注意：
  Binance 期貨只提供最近約 500 筆 Funding Rate 歷史（~167 天）
  和約 30–90 天的 Long/Short Ratio。
  因此這兩個因子只用於 Dashboard 即時評分，
  不能參與 XGBoost walk-forward 回測（歷史太短）。

輸出 data/futures_sentiment_results.csv
Schema:
  symbol, date,
  funding_rate_latest,   — 最新一筆 8h funding rate
  funding_rate_7d_avg,   — 近 21 筆（7 天）平均 funding rate（更穩定）
  funding_rate_pct,      — 近 7d 中有多少比例為負（空頭情緒佔比）
  ls_ratio_latest,       — 最新大戶多空比（longAccount/shortAccount）
  ls_long_pct,           — 最新多頭帳戶佔比
  ls_short_pct,          — 最新空頭帳戶佔比
  f9_norm,               — F9 normalized score (0–1)，負 funding → 高分
  f10_norm               — F10 normalized score (0–1)，空頭佔比高 → 高分
"""

import requests
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timezone

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "futures_sentiment_results.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

BASE_FUTURES = "https://fapi.binance.com"


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def fetch_funding_rate(symbol: str) -> dict:
    """
    抓取最新 21 筆 Funding Rate（每 8h 一筆，共 7 天），
    計算最新值、7d 平均、負值比例。
    """
    try:
        r = requests.get(
            f"{BASE_FUTURES}/fapi/v1/fundingRate",
            params={"symbol": symbol, "limit": 21},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        rates = [float(d["fundingRate"]) for d in data]
        latest = rates[-1]
        avg_7d = float(np.mean(rates))
        neg_pct = sum(1 for r in rates if r < 0) / len(rates)

        return {
            "funding_rate_latest": round(latest, 8),
            "funding_rate_7d_avg": round(avg_7d, 8),
            "funding_rate_neg_pct": round(neg_pct, 4),
        }
    except Exception as e:
        print(f"    ⚠️  Funding Rate {symbol}: {e}")
        return {
            "funding_rate_latest": None,
            "funding_rate_7d_avg": None,
            "funding_rate_neg_pct": None,
        }


def fetch_ls_ratio(symbol: str) -> dict:
    """
    抓取大戶帳戶多空比（Top Trader Long/Short Account Ratio），最新一天。
    """
    try:
        r = requests.get(
            f"{BASE_FUTURES}/futures/data/topLongShortAccountRatio",
            params={"symbol": symbol, "period": "1d", "limit": 1},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            raise ValueError("empty response")
        d = data[-1]
        return {
            "ls_ratio_latest": round(float(d["longShortRatio"]), 4),
            "ls_long_pct":     round(float(d["longAccount"]), 4),
            "ls_short_pct":    round(float(d["shortAccount"]), 4),
        }
    except Exception as e:
        print(f"    ⚠️  Long/Short Ratio {symbol}: {e}")
        return {
            "ls_ratio_latest": None,
            "ls_long_pct":     None,
            "ls_short_pct":    None,
        }


def normalize_f9(funding_rate_7d_avg, funding_rate_neg_pct) -> float:
    """
    F9 Funding Rate → normalized score (0–1)
    邏輯：
      - 7d 平均 funding rate 極負（-0.05%）→ 高分（空頭嚴重過多，反轉潛力）
      - 7d 平均 funding rate 正常（+0.01%）→ 中性
      - 7d 平均 funding rate 極正（+0.05%）→ 低分（多頭過熱，反轉風險）
      - 結合負值比例（neg_pct）加權
    設計：avg=-0.0005 → ~0.70，avg=+0.0001 → ~0.45，avg=+0.0005 → ~0.20
    """
    if funding_rate_7d_avg is None:
        return 0.5

    # 主要分數：基於 7d 平均（scale: ±0.001 對應 ±2σ）
    rate_score = clamp01(0.5 - funding_rate_7d_avg * 500)

    # 負值比例加成：大多數期間都是負值，信號更強
    neg_bonus = (funding_rate_neg_pct or 0) * 0.2

    return clamp01(rate_score * 0.8 + neg_bonus)


def normalize_f10(ls_short_pct) -> float:
    """
    F10 Long/Short Ratio → normalized score (0–1)
    邏輯：
      - 大戶空頭佔比高（short_pct > 0.45）→ 高分（主力空倉，軋空潛力）
      - 大戶空頭佔比低（short_pct < 0.30）→ 低分（多頭壓倒，無反彈動力）
      - 中性（short_pct ≈ 0.35）→ 0.5
    設計：short=0.50→0.90, short=0.35→0.50, short=0.20→0.10
    """
    if ls_short_pct is None:
        return 0.5
    return clamp01((ls_short_pct - 0.20) / 0.35)


def main():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows  = []

    for symbol in SYMBOLS:
        print(f"  {symbol}...")

        fr = fetch_funding_rate(symbol)
        ls = fetch_ls_ratio(symbol)

        f9_norm  = normalize_f9(fr["funding_rate_7d_avg"], fr["funding_rate_neg_pct"])
        f10_norm = normalize_f10(ls["ls_short_pct"])

        row = {
            "symbol": symbol,
            "date":   today,
            **fr,
            **ls,
            "f9_norm":  round(f9_norm, 4),
            "f10_norm": round(f10_norm, 4),
        }
        rows.append(row)

        print(f"    Funding Rate: latest={fr['funding_rate_latest']}, 7d_avg={fr['funding_rate_7d_avg']}, neg_pct={fr['funding_rate_neg_pct']:.0%}")
        print(f"    Long/Short:   ratio={ls['ls_ratio_latest']}, long={ls['ls_long_pct']:.0%}, short={ls['ls_short_pct']:.0%}")
        print(f"    F9={f9_norm:.3f}, F10={f10_norm:.3f}")

    df = pd.DataFrame(rows)
    df.to_csv(OUT_PATH, index=False)
    print(f"\n✅  futures_sentiment_results: {len(df)} rows → {OUT_PATH}")


if __name__ == "__main__":
    main()
