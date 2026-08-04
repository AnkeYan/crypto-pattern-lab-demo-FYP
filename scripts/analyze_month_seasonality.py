"""
analyze_month_seasonality.py
月份季節性（Month Seasonality）分析。

定義：
  monthly_return = 當月最後一個交易日收盤 / 當月第一個交易日收盤 - 1

規則：
  - 使用完整自然月份的月報酬做統計
  - 務實做法：排除每個幣種資料的第一個月與最後一個月

輸出：data/month_seasonality_results.csv
欄位：symbol, month, sample_size, mean_return, median_return,
      win_rate, best_return, worst_return, std_return
"""

import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT = DATA_DIR / "month_seasonality_results.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]


def analyze_symbol(symbol: str) -> list[dict]:
    path = DATA_DIR / f"{symbol}.csv"
    df = pd.read_csv(path)
    df["date"] = pd.to_datetime(df["open_time"], unit="ms")
    df["close"] = df["close"].astype(float)
    df = df.sort_values("date").reset_index(drop=True)
    df["year_month"] = df["date"].dt.to_period("M")

    monthly = (
        df.groupby("year_month")
        .agg(
            month_open_close=("close", "first"),
            month_close=("close", "last"),
        )
        .reset_index()
    )

    if len(monthly) <= 2:
        return []

    monthly = monthly.iloc[1:-1].copy()
    monthly["month"] = monthly["year_month"].dt.month
    monthly["monthly_return"] = monthly["month_close"] / monthly["month_open_close"] - 1

    seasonality = (
        monthly.groupby("month")["monthly_return"]
        .agg(
            sample_size="count",
            mean_return="mean",
            median_return="median",
            win_rate=lambda s: (s > 0).mean(),
            best_return="max",
            worst_return="min",
            std_return="std",
        )
        .reset_index()
    )

    rows = []
    for _, row in seasonality.iterrows():
        rows.append(
            {
                "symbol": symbol,
                "month": int(row["month"]),
                "sample_size": int(row["sample_size"]),
                "mean_return": row["mean_return"],
                "median_return": row["median_return"],
                "win_rate": row["win_rate"],
                "best_return": row["best_return"],
                "worst_return": row["worst_return"],
                "std_return": row["std_return"],
            }
        )
    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  Analyzing {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df = pd.DataFrame(all_rows)
    col_order = [
        "symbol", "month", "sample_size", "mean_return", "median_return",
        "win_rate", "best_return", "worst_return", "std_return",
    ]
    df = df.sort_values(["symbol", "month"]).reset_index(drop=True)
    df[col_order].to_csv(OUTPUT, index=False)
    print(f"\n✅ Saved {len(df)} rows → {OUTPUT}")


if __name__ == "__main__":
    main()
