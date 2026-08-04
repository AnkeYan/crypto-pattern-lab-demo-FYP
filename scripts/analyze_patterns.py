print("analyze script started")
import pandas as pd

symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
thresholds = [-0.03, -0.05, -0.07]
holding_periods = [1, 3, 7]

results = []

for symbol in symbols:
    print(f"\n================ {symbol} ================\n")

    df = pd.read_csv(f"data/{symbol}.csv")
    df["close"] = df["close"].astype(float)
    df["daily_return"] = df["close"].pct_change()

    for threshold in thresholds:
        print(f"=== Drop threshold: {threshold:.0%} ===")

        drop_days = df[df["daily_return"] <= threshold].copy()
        print("Total drop events:", len(drop_days))

        summary = ""

        for days in holding_periods:
            future_return = df["close"].shift(-days) / df["close"] - 1
            drop_days[f"future_return_{days}d"] = future_return

            series = drop_days[f"future_return_{days}d"].dropna()

            mean_return = series.mean()
            median_return = series.median()
            win_rate = (series > 0).mean()
            sharpe_ratio = mean_return / series.std() if series.std() > 0 else 0
            skewness = series.skew()
            kurtosis = series.kurtosis()  # excess kurtosis（超額峰度），正常分佈 = 0

            # Maximum Drawdown：這批交易裡最大的單筆虧損
            losses = series[series < 0]
            max_drawdown = losses.min() if len(losses) > 0 else 0
            # Avg Drawdown：虧損交易的平均虧損幅度
            avg_drawdown = losses.mean() if len(losses) > 0 else 0
            # Sortino Ratio：只用下行標準差（虧損波動）來懲罰，比 Sharpe 更精準
            downside_std = losses.std() if len(losses) > 1 else 0
            sortino_ratio = mean_return / downside_std if downside_std > 0 else 0

            print(f"{days}d mean return: {mean_return:.2%}")
            print(f"{days}d median return: {median_return:.2%}")
            print(f"{days}d win rate: {win_rate:.2%}")
            print(f"{days}d sharpe ratio: {sharpe_ratio:.4f}")
            print(f"{days}d sortino ratio: {sortino_ratio:.4f}")
            print(f"{days}d skewness: {skewness:.4f}")
            print(f"{days}d kurtosis: {kurtosis:.4f}")
            print(f"{days}d max drawdown: {max_drawdown:.2%}")
            print(f"{days}d avg drawdown: {avg_drawdown:.2%}")

            results.append({
                "symbol": symbol,
                "threshold": threshold,
                "holding_days": days,
                "sample_size": len(drop_days),
                "mean_return": mean_return,
                "median_return": median_return,
                "win_rate": win_rate,
                "sharpe_ratio": sharpe_ratio,
                "sortino_ratio": sortino_ratio,
                "skewness": skewness,
                "kurtosis": kurtosis,
                "max_drawdown": max_drawdown,
                "avg_drawdown": avg_drawdown,
            })

        if len(drop_days) < 10:
            summary = "Sample size is too small, conclusion is weak."
        elif drop_days["future_return_3d"].dropna().mean() > 0 and drop_days["future_return_7d"].dropna().mean() > 0:
            summary = "This pattern shows a possible rebound tendency."
        else:
            summary = "This pattern does not show a stable rebound signal."

        print("Summary:", summary)
        print()

results_df = pd.DataFrame(results)
results_df.to_csv("data/pattern_results.csv", index=False)
print("Saved analysis results to data/pattern_results.csv")
