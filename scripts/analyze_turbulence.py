"""
analyze_turbulence.py
Turbulence Index（市場異常指數）— F12

原理（Kritzman & Li, 2010）：
  turbulence(t) = (r_t - μ)ᵀ × Σ⁻¹ × (r_t - μ)
  數值越高 = 市場行為越偏離歷史正常狀態
  橋水、Two Sigma 等量化基金實際使用此指標

輸出 data/turbulence_history.csv
Schema: date, turbulence_raw, turbulence_norm, turbulence_level
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "turbulence_history.csv"
SYMBOLS  = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
LOOKBACK = 252

def load_prices() -> pd.DataFrame:
    dfs = {}
    for sym in SYMBOLS:
        df = pd.read_csv(DATA_DIR / f"{sym}.csv")
        df["date"] = pd.to_datetime(df["open_time"], unit="ms").dt.date.astype(str)
        df = df[["date", "close"]].drop_duplicates("date").sort_values("date")
        df["close"] = df["close"].astype(float)
        dfs[sym] = df.set_index("date")["close"]
    return pd.DataFrame(dfs).dropna()

def compute_turbulence(price_df: pd.DataFrame) -> pd.DataFrame:
    returns = price_df.pct_change().dropna()
    n = len(returns)
    turb_values, turb_dates = [], []
    for i in range(LOOKBACK, n):
        hist   = returns.iloc[i - LOOKBACK : i]
        mu     = hist.mean().values
        cov    = hist.cov().values
        r_t    = returns.iloc[i].values
        try:
            diff = r_t - mu
            turb = float(diff @ np.linalg.pinv(cov) @ diff)
        except Exception:
            turb = np.nan
        turb_values.append(turb)
        turb_dates.append(returns.index[i])
    result = pd.DataFrame({"date": turb_dates, "turbulence_raw": turb_values})
    cap = result["turbulence_raw"].quantile(0.99)
    clipped = result["turbulence_raw"].clip(upper=cap)
    t_min, t_max = clipped.min(), clipped.max()
    result["turbulence_norm"] = (clipped - t_min) / (t_max - t_min + 1e-10)
    result["turbulence_level"] = result["turbulence_norm"].apply(
        lambda v: "low" if v < 0.25 else "moderate" if v < 0.50 else "elevated" if v < 0.75 else "extreme"
    )
    return result

def main():
    print("Loading prices...")
    price_df = load_prices()
    print(f"  {len(price_df)} days, {price_df.index[0]} to {price_df.index[-1]}")
    print("Computing Turbulence Index...")
    result = compute_turbulence(price_df)
    print(f"  {len(result)} rows")
    print(f"  Level distribution: {result['turbulence_level'].value_counts().to_dict()}")
    print(f"  Latest: {result['turbulence_level'].iloc[-1]} (norm={result['turbulence_norm'].iloc[-1]:.3f})")
    result.to_csv(OUT_PATH, index=False)
    print(f"\n✅  Saved to {OUT_PATH}")

if __name__ == "__main__":
    main()
