"""
analyze_walk_forward.py
Walk-forward validation：3 年 training 窗口，每年滾動一次，測試下一年表現。
目的：比固定 split 更嚴格地檢驗 pattern 在不同市場週期的穩定性。

窗口定義（以年末為界）：
  BTC/ETH (from 2018): [2018-2020→2021], [2019-2021→2022],
                        [2020-2022→2023], [2021-2023→2024], [2022-2024→2025]
  SOL     (from 2021): [2021-2022→2023], [2022-2023→2024], [2023-2024→2025]
  （SOL 只有 2 年訓練窗口，避免樣本過少）

輸出：data/walk_forward_results.csv
欄位：symbol, threshold, holding_days, fold, train_start, train_end,
       test_start, test_end, train_n, test_n,
       train_win_rate, test_win_rate,
       train_mean_return, test_mean_return,
       train_sharpe, test_sharpe,
       pass_flag   (consistent / weakened / failed / low_sample)
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT   = DATA_DIR / "walk_forward_results.csv"

SYMBOLS    = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
THRESHOLDS = [-0.03, -0.05, -0.07]
HOLDINGS   = [1, 3, 7]

# 每個幣種的 fold 定義：(train_start_year, train_end_year, test_year)
FOLDS_BTC_ETH = [
    (2018, 2020, 2021),
    (2019, 2021, 2022),
    (2020, 2022, 2023),
    (2021, 2023, 2024),
    (2022, 2024, 2025),
]
FOLDS_SOL = [
    (2021, 2022, 2023),
    (2022, 2023, 2024),
    (2023, 2024, 2025),
]
LOW_SAMPLE = 15   # test 期樣本少於此值標為 low_sample


def load_prices(symbol: str) -> pd.DataFrame:
    path = DATA_DIR / f"{symbol}.csv"
    df   = pd.read_csv(path)
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms")
    df          = df.sort_values("date").reset_index(drop=True)
    df["close"] = df["close"].astype(float)
    return df


def compute_fold_stats(prices: pd.DataFrame, threshold: float, holding: int) -> dict:
    """計算一段時間內，pattern 觸發後持有 holding 天的統計指標。"""
    close = prices["close"]
    daily_ret  = close.pct_change()
    signal     = daily_ret <= threshold
    future_ret = (close.shift(-holding) - close) / close
    triggered  = future_ret[signal & future_ret.notna()]

    n = len(triggered)
    if n == 0:
        return {"n": 0, "win_rate": np.nan, "mean_return": np.nan, "sharpe": np.nan}

    mean    = triggered.mean()
    win_rate = (triggered > 0).mean()
    std     = triggered.std()
    sharpe  = (mean / std) * np.sqrt(252) if std > 0 else np.nan

    return {"n": n, "win_rate": win_rate, "mean_return": mean, "sharpe": sharpe}


def pass_flag(train: dict, test: dict) -> str:
    if test["n"] < LOW_SAMPLE:
        return "low_sample"
    if np.isnan(test["win_rate"]) or np.isnan(test["mean_return"]):
        return "low_sample"
    if test["mean_return"] < 0 and test["win_rate"] < 0.45:
        return "failed"
    # weakened：mean return 縮水超過 50% 或 win_rate 跌破 50%
    if not np.isnan(train["mean_return"]) and train["mean_return"] > 0:
        if test["mean_return"] < train["mean_return"] * 0.5 or test["win_rate"] < 0.50:
            return "weakened"
    return "consistent"


def analyze_symbol(symbol: str) -> list[dict]:
    df = load_prices(symbol)
    folds = FOLDS_SOL if symbol == "SOLUSDT" else FOLDS_BTC_ETH

    rows = []
    for fold_idx, (train_y0, train_y1, test_y) in enumerate(folds, start=1):
        train_start = pd.Timestamp(f"{train_y0}-01-01")
        train_end   = pd.Timestamp(f"{train_y1}-12-31")
        test_start  = pd.Timestamp(f"{test_y}-01-01")
        test_end    = pd.Timestamp(f"{test_y}-12-31")

        train_prices = df[(df["date"] >= train_start) & (df["date"] <= train_end)]
        test_prices  = df[(df["date"] >= test_start)  & (df["date"] <= test_end)]

        if len(train_prices) < 100 or len(test_prices) < 50:
            continue  # 跳過數據不足的窗口

        for threshold in THRESHOLDS:
            for holding in HOLDINGS:
                train_stats = compute_fold_stats(train_prices, threshold, holding)
                test_stats  = compute_fold_stats(test_prices,  threshold, holding)
                flag        = pass_flag(train_stats, test_stats)

                rows.append({
                    "symbol":           symbol,
                    "threshold":        threshold,
                    "holding_days":     holding,
                    "fold":             fold_idx,
                    "train_start":      train_start.date(),
                    "train_end":        train_end.date(),
                    "test_start":       test_start.date(),
                    "test_end":         test_end.date(),
                    "train_n":          train_stats["n"],
                    "test_n":           test_stats["n"],
                    "train_win_rate":   round(train_stats["win_rate"],  4) if not np.isnan(train_stats["win_rate"]) else None,
                    "test_win_rate":    round(test_stats["win_rate"],   4) if not np.isnan(test_stats["win_rate"])  else None,
                    "train_mean_return":round(train_stats["mean_return"],6) if not np.isnan(train_stats["mean_return"]) else None,
                    "test_mean_return": round(test_stats["mean_return"], 6) if not np.isnan(test_stats["mean_return"])  else None,
                    "train_sharpe":     round(train_stats["sharpe"],    4) if not np.isnan(train_stats["sharpe"])  else None,
                    "test_sharpe":      round(test_stats["sharpe"],     4) if not np.isnan(test_stats["sharpe"])   else None,
                    "pass_flag":        flag,
                })

    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  Analyzing {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df = pd.DataFrame(all_rows)
    df.to_csv(OUTPUT, index=False)
    print(f"\n✅  Saved {len(df)} rows → {OUTPUT}")

    # 簡易摘要
    print("\n=== Pass rate by symbol ===")
    for sym in SYMBOLS:
        sub  = df[df["symbol"] == sym]
        pct  = (sub["pass_flag"] == "consistent").mean() * 100
        print(f"  {sym}: {pct:.0f}% consistent")


if __name__ == "__main__":
    main()
