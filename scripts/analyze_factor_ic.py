"""
analyze_factor_ic.py
Factor Information Coefficient (IC) 分析

IC = Spearman 相關係數（因子值 vs 7天後回報率）
  - IC > 0：因子值高 → 未來回報傾向正向
  - IC < 0：因子值高 → 未來回報傾向負向
  - |IC| > 0.05：有實際意義；> 0.10：強信號

IC IR = IC 均值 / IC 標準差（穩定性指標）
  - |IC IR| > 0.5：穩定；> 1.0：非常穩定

輸出：
  data/factor_ic_results.csv
  Schema: symbol, factor, factor_name, mean_ic, std_ic, ic_ir,
          n_years, n_positive, ic_by_year (JSON string)
"""

import pandas as pd
import numpy as np
from scipy import stats
import json
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "factor_ic_results.csv"

TRAIN_START = "2017-11-01"
SYMBOLS     = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

# 只分析有足夠歷史的 _cont 因子（F15 排除，數據太短）
CONT_COLS = [
    "f1_cont", "f2_cont", "f5_cont", "f6_cont",
    "f7_cont", "f8_cont", "f9_cont", "f11_cont",
    "f12_cont", "f13_cont", "f14_cont",
]

FACTOR_NAMES = {
    "f1_cont":  "F1 RSI Intensity",
    "f2_cont":  "F2 Bollinger Position",
    "f5_cont":  "F5 Month Seasonality",
    "f6_cont":  "F6 HMM Regime",
    "f7_cont":  "F7 Volume Direction",
    "f8_cont":  "F8 Price Momentum",
    "f9_cont":  "F9 Funding Rate",
    "f11_cont": "F11 Active Addresses",
    "f12_cont": "F12 Turbulence Calm",
    "f13_cont": "F13 MVRV",
    "f14_cont": "F14 FR Trend",
}


def compute_ic(series_x: pd.Series, series_y: pd.Series) -> float:
    """Spearman IC，樣本不足或常數輸入回傳 NaN。"""
    if len(series_x) < 15:
        return float("nan")
    # 過濾掉常數欄位（ETH/SOL 的 f11_cont 全是 0.5）
    if series_x.std() < 1e-6:
        return float("nan")
    ic, _ = stats.spearmanr(series_x, series_y)
    return float(ic) if not np.isnan(ic) else float("nan")


def main():
    calib_path = DATA_DIR / "multifactor_calibration.csv"
    if not calib_path.exists():
        print("❌  multifactor_calibration.csv not found.")
        return

    cal = pd.read_csv(calib_path, parse_dates=["date"])
    cal = cal[cal["date"] >= TRAIN_START].copy()
    print(f"Loaded calibration: {len(cal)} rows ({TRAIN_START} onward)")

    rows = []

    for symbol in SYMBOLS:
        sym_df = cal[cal["symbol"] == symbol].sort_values("date").copy()
        years  = sorted(sym_df["date"].dt.year.unique())
        print(f"\n  {symbol} ({len(sym_df)} rows, {years[0]}–{years[-1]})")

        for col in CONT_COLS:
            if col not in sym_df.columns:
                continue

            # 逐年 IC
            ic_by_year = {}
            for yr in years:
                yr_df = sym_df[sym_df["date"].dt.year == yr].dropna(subset=[col, "outcome_7d"])
                ic = compute_ic(yr_df[col], yr_df["outcome_7d"])
                if not np.isnan(ic):
                    ic_by_year[int(yr)] = round(ic, 4)

            if not ic_by_year:
                continue

            ic_vals    = list(ic_by_year.values())
            mean_ic    = float(np.mean(ic_vals))
            std_ic     = float(np.std(ic_vals))
            ic_ir      = mean_ic / std_ic if std_ic > 1e-6 else 0.0
            n_positive = sum(1 for v in ic_vals if v > 0)

            # 顯著性評級
            if abs(ic_ir) >= 1.0:
                rating = "Strong"
            elif abs(ic_ir) >= 0.5:
                rating = "Moderate"
            elif abs(ic_ir) >= 0.2:
                rating = "Weak"
            else:
                rating = "Noise"

            rows.append({
                "symbol":      symbol,
                "factor":      col,
                "factor_name": FACTOR_NAMES.get(col, col),
                "mean_ic":     round(mean_ic, 4),
                "std_ic":      round(std_ic, 4),
                "ic_ir":       round(ic_ir, 3),
                "n_years":     len(ic_vals),
                "n_positive":  n_positive,
                "rating":      rating,
                "ic_by_year":  json.dumps(ic_by_year),
            })

            direction = "↑ positive" if mean_ic > 0.01 else ("↓ negative" if mean_ic < -0.01 else "≈ neutral")
            print(f"    {FACTOR_NAMES[col]:<28} IC={mean_ic:+.4f}  IR={ic_ir:+.3f}  [{rating}]  {direction}")

    df_out = pd.DataFrame(rows)
    df_out.to_csv(OUT_PATH, index=False)
    print(f"\n✅  factor_ic_results: {len(df_out)} rows → {OUT_PATH}")

    # 按 |IC IR| 排名
    print("\n── Factor IC Ranking (by |IC IR|, BTC) ─────────────────────────")
    btc = df_out[df_out["symbol"] == "BTCUSDT"].copy()
    btc["abs_ic_ir"] = btc["ic_ir"].abs()
    btc = btc.sort_values("abs_ic_ir", ascending=False)
    print(f"  {'Factor':<28} {'Mean IC':>9} {'IC IR':>8} {'Rating'}")
    print(f"  {'-'*60}")
    for _, r in btc.iterrows():
        print(f"  {r['factor_name']:<28} {r['mean_ic']:>+9.4f} {r['ic_ir']:>8.3f}  {r['rating']}")


if __name__ == "__main__":
    main()
