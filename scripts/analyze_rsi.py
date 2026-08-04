"""
analyze_rsi.py
RSI（相對強弱指數）超賣信號後的統計分析。

信號定義：
  RSI_N < 30  →  超賣（oversold）
  RSI_N < 20  →  極端超賣（extreme oversold）

窗口 N：7（短線敏感）、14（標準）
持有期：1d / 3d / 7d

輸出：data/rsi_results.csv
欄位：symbol, rsi_window, rsi_threshold, holding_days,
       sample_size, mean_return, median_return, win_rate,
       sharpe_ratio, sortino_ratio, skewness, kurtosis,
       max_drawdown, avg_drawdown
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT   = DATA_DIR / "rsi_results.csv"

SYMBOLS        = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
RSI_WINDOWS    = [7, 14]
RSI_THRESHOLDS = [30, 20]   # < 30 = oversold, < 20 = extreme oversold
HOLDINGS       = [1, 3, 7]


def compute_rsi(close: pd.Series, window: int) -> pd.Series:
    """Wilder's smoothed RSI（和 TradingView 一致）。"""
    delta = close.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)
    # 初始均值用 simple MA，之後用 Wilder's EWM（alpha = 1/window）
    avg_gain = gain.ewm(alpha=1/window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/window, min_periods=window, adjust=False).mean()
    rs  = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - 100 / (1 + rs)
    return rsi


def compute_stats(returns: pd.Series) -> dict:
    n = len(returns)
    if n == 0:
        nan = float("nan")
        return dict(sample_size=0, mean_return=nan, median_return=nan,
                    win_rate=nan, sharpe_ratio=nan, sortino_ratio=nan,
                    skewness=nan, kurtosis=nan, max_drawdown=nan, avg_drawdown=nan)

    mean     = returns.mean()
    median   = returns.median()
    win_rate = (returns > 0).mean()
    std      = returns.std()
    sharpe   = (mean / std) * np.sqrt(252) if std > 0 else float("nan")

    downside = returns[returns < 0]
    down_std = downside.std() if len(downside) > 1 else float("nan")
    sortino  = (mean / down_std) * np.sqrt(252) if (down_std and down_std > 0) else float("nan")

    drawdowns  = returns[returns < 0]
    max_dd  = drawdowns.min()  if len(drawdowns) > 0 else 0.0
    avg_dd  = drawdowns.mean() if len(drawdowns) > 0 else 0.0

    return dict(
        sample_size   = n,
        mean_return   = mean,
        median_return = median,
        win_rate      = win_rate,
        sharpe_ratio  = sharpe,
        sortino_ratio = sortino,
        skewness      = returns.skew(),
        kurtosis      = returns.kurtosis(),
        max_drawdown  = max_dd,
        avg_drawdown  = avg_dd,
    )


def analyze_symbol(symbol: str) -> list[dict]:
    path  = DATA_DIR / f"{symbol}.csv"
    df    = pd.read_csv(path)
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms")
    df          = df.sort_values("date").reset_index(drop=True)
    close = df["close"].astype(float)

    rows = []
    for window in RSI_WINDOWS:
        rsi = compute_rsi(close, window)
        for threshold in RSI_THRESHOLDS:
            signal = rsi < threshold
            for holding in HOLDINGS:
                future_ret = (close.shift(-holding) - close) / close
                triggered  = future_ret[signal & future_ret.notna()]
                stats = compute_stats(triggered)
                rows.append({
                    "symbol":        symbol,
                    "rsi_window":    window,
                    "rsi_threshold": threshold,
                    "holding_days":  holding,
                    **stats,
                })
    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  Analyzing {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df = pd.DataFrame(all_rows)
    col_order = [
        "symbol", "rsi_window", "rsi_threshold", "holding_days",
        "sample_size", "mean_return", "median_return", "win_rate",
        "sharpe_ratio", "sortino_ratio", "skewness", "kurtosis",
        "max_drawdown", "avg_drawdown",
    ]
    df[col_order].to_csv(OUTPUT, index=False)
    print(f"\n✅  Saved {len(df)} rows → {OUTPUT}")

    # 摘要
    print("\n=== RSI-14 < 30, 7d win rate ===")
    sub = df[(df.rsi_window == 14) & (df.rsi_threshold == 30) & (df.holding_days == 7)]
    for _, r in sub.iterrows():
        print(f"  {r['symbol']}: n={r['sample_size']:.0f}, WR={r['win_rate']:.3f}, mean={r['mean_return']:.4f}")


if __name__ == "__main__":
    main()
