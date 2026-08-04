"""
analyze_acf.py
計算 BTC / ETH / SOL 日對數回報的 ACF、PACF 係數，以及 Ljung-Box 白噪聲檢定。

輸出：data/acf_results.csv
  欄位：symbol, type (acf/pacf), lag, value, ci_upper, ci_lower
        （ci = 95% 信賴區間，基於 ±1.96/sqrt(n)）

另外輸出：data/ljung_box_results.csv
  欄位：symbol, lag, lb_stat, lb_pvalue
        （lb_pvalue < 0.05 代表序列不是白噪聲）
"""

import pandas as pd
import numpy as np
from pathlib import Path
from statsmodels.stats.stattools import durbin_watson
from statsmodels.tsa.stattools import acf, pacf
from statsmodels.stats.diagnostic import acorr_ljungbox

DATA_DIR    = Path(__file__).parent.parent / "data"
ACF_OUT     = DATA_DIR / "acf_results.csv"
LB_OUT      = DATA_DIR / "ljung_box_results.csv"

SYMBOLS  = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
MAX_LAGS = 30   # 顯示最多 30 個 lag


def get_log_returns(symbol: str) -> pd.Series:
    path = DATA_DIR / f"{symbol}.csv"
    df   = pd.read_csv(path)
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms")
    df          = df.sort_values("date").reset_index(drop=True)
    close       = df["close"].astype(float)
    log_ret     = np.log(close / close.shift(1)).dropna()
    return log_ret


def analyze_symbol(symbol: str):
    log_ret = get_log_returns(symbol)
    n       = len(log_ret)

    # 95% 信賴區間：±1.96 / sqrt(n)
    ci = 1.96 / np.sqrt(n)

    # ACF（包含 lag 0，只取 lag 1-30）
    acf_vals  = acf(log_ret,  nlags=MAX_LAGS, fft=True,  alpha=None)
    pacf_vals = pacf(log_ret, nlags=MAX_LAGS, method="ywm", alpha=None)

    acf_rows  = []
    pacf_rows = []
    for lag in range(1, MAX_LAGS + 1):
        acf_rows.append({
            "symbol":   symbol,
            "type":     "acf",
            "lag":      lag,
            "value":    round(float(acf_vals[lag]),  6),
            "ci_upper": round(ci, 6),
            "ci_lower": round(-ci, 6),
        })
        pacf_rows.append({
            "symbol":   symbol,
            "type":     "pacf",
            "lag":      lag,
            "value":    round(float(pacf_vals[lag]), 6),
            "ci_upper": round(ci, 6),
            "ci_lower": round(-ci, 6),
        })

    # Ljung-Box 檢定（lag 1 到 20）
    lb = acorr_ljungbox(log_ret, lags=list(range(1, 21)), return_df=True)
    lb_rows = []
    for lag_val, row in lb.iterrows():
        lb_rows.append({
            "symbol":    symbol,
            "lag":       int(lag_val),
            "lb_stat":   round(float(row["lb_stat"]),   4),
            "lb_pvalue": round(float(row["lb_pvalue"]), 6),
        })

    # Durbin-Watson（只用於 summary，印出供參考）
    dw = durbin_watson(log_ret)
    print(f"  {symbol}: n={n}, CI=±{ci:.4f}, DW={dw:.4f}")

    return acf_rows + pacf_rows, lb_rows


def main():
    all_acf = []
    all_lb  = []

    for symbol in SYMBOLS:
        print(f"Analyzing {symbol}...")
        acf_rows, lb_rows = analyze_symbol(symbol)
        all_acf.extend(acf_rows)
        all_lb.extend(lb_rows)

    pd.DataFrame(all_acf).to_csv(ACF_OUT, index=False)
    pd.DataFrame(all_lb).to_csv(LB_OUT,  index=False)

    print(f"\n✅  Saved {len(all_acf)} ACF/PACF rows → {ACF_OUT}")
    print(f"✅  Saved {len(all_lb)} Ljung-Box rows → {LB_OUT}")


if __name__ == "__main__":
    main()
