"""
analyze_consecutive_drop.py
連跌分析：連續 N 天收盤下跌後，第 1/3/7 天的歷史條件統計

定義：
  consecutive_drop_n = 收盤價連續 N 天低於前一天（每天都下跌）
  不要求每天跌幅達到某個 threshold，只需要方向連跌

輸出 data/consecutive_drop_results.csv
Schema:
  symbol, n_days, holding_days, sample_size, mean_return, median_return,
  win_rate, sharpe_ratio, max_drawdown, avg_drawdown,
  best_return, worst_return, std_return
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "consecutive_drop_results.csv"

SYMBOLS  = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
N_DAYS   = [2, 3, 4, 5]   # 連跌天數（1 天就是單日跌，跟 pattern_results 重疊，略去）
HOLDINGS = [1, 3, 7]
MIN_SAMPLE = 5  # 少於此則仍輸出但前端顯示警告


def compute_stats(returns: pd.Series) -> dict:
    n = len(returns)
    if n == 0:
        return dict(
            sample_size=0, mean_return=None, median_return=None,
            win_rate=None, sharpe_ratio=None, max_drawdown=None,
            avg_drawdown=None, best_return=None, worst_return=None, std_return=None,
        )
    mean   = float(returns.mean())
    median = float(returns.median())
    std    = float(returns.std()) if n > 1 else 0.0
    wr     = float((returns > 0).mean())

    # Sharpe (annualised rough, sqrt(252) scale on daily returns ÷ std)
    sharpe = (mean / std * np.sqrt(252)) if std > 0 else 0.0

    # Drawdown: simple per-trade drawdown not applicable to forward returns.
    # Use worst loss as max_drawdown proxy; avg of negative returns as avg_drawdown.
    losses = returns[returns < 0]
    max_dd  = float(losses.min()) if len(losses) > 0 else 0.0
    avg_dd  = float(losses.mean()) if len(losses) > 0 else 0.0

    return dict(
        sample_size  = n,
        mean_return  = round(mean, 6),
        median_return= round(median, 6),
        win_rate     = round(wr, 4),
        sharpe_ratio = round(sharpe, 4),
        max_drawdown = round(max_dd, 6),
        avg_drawdown = round(avg_dd, 6),
        best_return  = round(float(returns.max()), 6),
        worst_return = round(float(returns.min()), 6),
        std_return   = round(std, 6),
    )


def analyze_symbol(symbol: str) -> list[dict]:
    df = pd.read_csv(DATA_DIR / f"{symbol}.csv")
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms")
    df = df.sort_values("date").reset_index(drop=True)
    close = df["close"].astype(float)

    daily_ret = close.pct_change()  # day-over-day return

    rows = []

    for n in N_DAYS:
        # Build mask: last n consecutive days all negative (close < prev close)
        # day i qualifies if daily_ret[i], daily_ret[i-1], ..., daily_ret[i-n+1] all < 0
        consec = pd.Series(False, index=close.index)
        for i in range(n - 1, len(close)):
            window = daily_ret.iloc[i - n + 1 : i + 1]
            if len(window) == n and (window < 0).all():
                consec.iloc[i] = True

        for h in HOLDINGS:
            future_ret = (close.shift(-h) - close) / close
            triggered  = future_ret[consec & future_ret.notna()]
            stats = compute_stats(triggered)
            rows.append({
                "symbol":     symbol,
                "n_days":     n,
                "holding_days": h,
                **stats,
            })

    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df_out = pd.DataFrame(all_rows)
    df_out.to_csv(OUT_PATH, index=False)
    print(f"\n✅  consecutive_drop_results: {len(df_out)} rows → {OUT_PATH}")

    # Summary
    for sym in SYMBOLS:
        subset = df_out[(df_out["symbol"] == sym) & (df_out["holding_days"] == 7)]
        print(f"\n  {sym} — 7d win rate after N consecutive down days:")
        for _, row in subset.iterrows():
            wr  = row["win_rate"]
            n   = int(row["n_days"])
            ss  = int(row["sample_size"])
            mr  = row["mean_return"]
            wr_str  = f"{wr*100:.1f}%" if wr is not None and not (isinstance(wr, float) and np.isnan(wr)) else "—"
            mr_str  = f"{mr*100:+.2f}%" if mr is not None and not (isinstance(mr, float) and np.isnan(mr)) else "—"
            print(f"    {n}d drop: n={ss}, wr={wr_str}, mean={mr_str}")


if __name__ == "__main__":
    main()
