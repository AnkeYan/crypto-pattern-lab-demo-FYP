"""
analyze_bollinger.py
Bollinger Band 突破下軌後的 1d/3d/7d 統計分析。

信號定義：收盤價 < (SMA_N - k * std_N)  →  視為入場信號
輸出：data/bollinger_results.csv
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT   = DATA_DIR / "bollinger_results.csv"

SYMBOLS  = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
WINDOWS  = [10, 20]           # 布林帶計算窗口（天）
KS       = [2.0, 2.5]         # 標準差倍數
HOLDINGS = [1, 3, 7]          # 持有天數


def compute_stats(returns: pd.Series) -> dict:
    """給一組回報序列，計算 11 個統計指標。"""
    n = len(returns)
    if n == 0:
        return {k: np.nan for k in [
            "sample_size","mean_return","median_return","win_rate",
            "sharpe_ratio","sortino_ratio","skewness","kurtosis",
            "max_drawdown","avg_drawdown",
        ]}

    mean   = returns.mean()
    median = returns.median()
    win_rate = (returns > 0).mean()
    std    = returns.std()

    # Sharpe（無風險利率設 0）
    sharpe = (mean / std) * np.sqrt(252) if std > 0 else np.nan

    # Sortino（只用下行標準差）
    downside = returns[returns < 0]
    down_std = downside.std() if len(downside) > 1 else np.nan
    sortino  = (mean / down_std) * np.sqrt(252) if (down_std and down_std > 0) else np.nan

    skewness = returns.skew()
    kurt     = returns.kurtosis()

    # Drawdown：每筆交易從入場到出場的單次回撤
    drawdowns = returns[returns < 0]
    max_dd  = drawdowns.min() if len(drawdowns) > 0 else 0.0
    avg_dd  = drawdowns.mean() if len(drawdowns) > 0 else 0.0

    return {
        "sample_size":    n,
        "mean_return":    mean,
        "median_return":  median,
        "win_rate":       win_rate,
        "sharpe_ratio":   sharpe,
        "sortino_ratio":  sortino,
        "skewness":       skewness,
        "kurtosis":       kurt,
        "max_drawdown":   max_dd,
        "avg_drawdown":   avg_dd,
    }


def analyze_symbol(symbol: str) -> list[dict]:
    path = DATA_DIR / f"{symbol}.csv"
    df   = pd.read_csv(path)

    # open_time 是毫秒 Unix timestamp → 轉成 date
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms")
    df          = df.sort_values("date").reset_index(drop=True)
    close       = df["close"].astype(float)

    rows = []
    for window in WINDOWS:
        sma = close.rolling(window).mean()
        std = close.rolling(window).std()

        for k in KS:
            lower_band = sma - k * std
            signal     = close < lower_band   # True = 突破下軌

            for holding in HOLDINGS:
                # 計算每個信號日的持有期回報
                future_returns = (close.shift(-holding) - close) / close
                triggered      = future_returns[signal & future_returns.notna()]

                stats = compute_stats(triggered)
                rows.append({
                    "symbol":       symbol,
                    "window":       window,
                    "k":            k,
                    "holding_days": holding,
                    **stats,
                })

    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  Analyzing {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df = pd.DataFrame(all_rows)
    # 欄位排序
    col_order = [
        "symbol", "window", "k", "holding_days",
        "sample_size", "mean_return", "median_return", "win_rate",
        "sharpe_ratio", "sortino_ratio", "skewness", "kurtosis",
        "max_drawdown", "avg_drawdown",
    ]
    df = df[col_order]
    df.to_csv(OUTPUT, index=False)
    print(f"\n✅  Saved {len(df)} rows → {OUTPUT}")


if __name__ == "__main__":
    main()
