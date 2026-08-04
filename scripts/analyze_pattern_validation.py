print("pattern validation script started")

import pandas as pd

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
THRESHOLDS = [-0.03, -0.05, -0.07]
HOLDING_PERIODS = [1, 3, 7]
DISCOVERY_END = "2022-12-31"
VALIDATION_START = "2023-01-01"


def compute_stats(df: pd.DataFrame, threshold: float, holding_days: int) -> dict:
    drop_days = df[df["daily_return"] <= threshold].copy()
    future_return = df["close"].shift(-holding_days) / df["close"] - 1
    drop_days[f"future_return_{holding_days}d"] = future_return
    series = drop_days[f"future_return_{holding_days}d"].dropna()

    if len(series) == 0:
        return {
            "sample_size": 0,
            "mean_return": None,
            "median_return": None,
            "win_rate": None,
            "sharpe_ratio": None,
            "sortino_ratio": None,
            "max_drawdown": None,
        }

    mean_return = series.mean()
    median_return = series.median()
    win_rate = (series > 0).mean()
    std = series.std()
    sharpe_ratio = mean_return / std if std and std > 0 else 0

    losses = series[series < 0]
    downside_std = losses.std() if len(losses) > 1 else 0
    sortino_ratio = mean_return / downside_std if downside_std and downside_std > 0 else 0
    max_drawdown = losses.min() if len(losses) > 0 else 0

    return {
        "sample_size": int(len(series)),
        "mean_return": mean_return,
        "median_return": median_return,
        "win_rate": win_rate,
        "sharpe_ratio": sharpe_ratio,
        "sortino_ratio": sortino_ratio,
        "max_drawdown": max_drawdown,
    }


def build_consistency_label(discovery: dict, validation: dict) -> str:
    discovery_mean = discovery["mean_return"] or 0
    validation_mean = validation["mean_return"] or 0

    if validation["sample_size"] < 5:
        return "insufficient_validation_sample"
    if discovery_mean > 0 and validation_mean > 0:
        if discovery_mean > 0 and validation_mean < discovery_mean * 0.5:
            return "positive_but_weakened"
        return "consistent_positive"
    if discovery_mean > 0 and validation_mean <= 0:
        return "failed_validation"
    if discovery_mean <= 0 and validation_mean > 0:
        return "improved_in_validation"
    return "consistent_but_weak"


def build_confidence_assessment(discovery: dict, validation: dict, consistency_flag: str) -> tuple[str, int, str]:
    score = 0
    reasons = []
    total_samples = discovery["sample_size"] + validation["sample_size"]
    validation_mean = validation["mean_return"] or 0
    validation_median = validation["median_return"] or 0
    validation_win_rate = validation["win_rate"] or 0
    discovery_mean = discovery["mean_return"] or 0
    validation_max_drawdown = validation["max_drawdown"]

    if validation["sample_size"] >= 30:
        score += 2
        reasons.append("validation sample is reasonably deep")
    elif validation["sample_size"] >= 10:
        score += 1
        reasons.append("validation sample exists but is still limited")
    else:
        reasons.append("validation sample is small")

    if total_samples >= 120:
        score += 1
        reasons.append("combined sample depth is strong")
    elif total_samples >= 50:
        reasons.append("combined sample depth is acceptable")
    else:
        reasons.append("combined sample depth is still thin")

    if validation_mean > 0:
        score += 1
        reasons.append("validation mean return stayed positive")
    else:
        reasons.append("validation mean return is not positive")

    if validation_median > 0:
        score += 1
        reasons.append("validation median return stayed positive")
    else:
        reasons.append("validation median return is weak or negative")

    if validation_win_rate >= 0.5:
        score += 1
        reasons.append("validation win rate is at least 50%")
    else:
        reasons.append("validation win rate is below 50%")

    if discovery_mean > 0 and validation_mean >= discovery_mean * 0.5:
        score += 1
        reasons.append("validation retained at least half of the discovery edge")
    elif consistency_flag == "positive_but_weakened":
        reasons.append("validation stayed positive but weakened materially")

    if validation_max_drawdown is not None and validation_max_drawdown > -0.15:
        score += 1
        reasons.append("worst validation event loss is not excessively deep")
    elif validation_max_drawdown is not None:
        reasons.append("worst validation event loss remains deep")

    if consistency_flag == "failed_validation" or validation["sample_size"] < 5:
        label = "Low confidence"
    elif validation["sample_size"] < 30:
        label = "Moderate confidence" if score >= 3 else "Low confidence"
    elif score >= 6 and consistency_flag == "consistent_positive":
        label = "Higher confidence"
    elif score >= 3:
        label = "Moderate confidence"
    else:
        label = "Low confidence"

    return label, score, "; ".join(reasons)


def build_summary_note(symbol: str, threshold: float, holding_days: int, discovery: dict, validation: dict, consistency_flag: str) -> str:
    symbol_label = symbol.replace("USDT", "")
    threshold_label = f"{abs(threshold) * 100:.0f}%"

    if consistency_flag == "insufficient_validation_sample":
        return (
            f"{symbol_label} dropped {threshold_label} with {holding_days}d holding has too little validation data. "
            f"Discovery looks informative, but the post-2023 sample is still too small for a strong conclusion."
        )
    if consistency_flag == "consistent_positive":
        return (
            f"{symbol_label} dropped {threshold_label} with {holding_days}d holding stayed positive in both discovery and validation periods. "
            f"This is a more robust pattern than a discovery-only result."
        )
    if consistency_flag == "positive_but_weakened":
        return (
            f"{symbol_label} dropped {threshold_label} with {holding_days}d holding remained positive in validation, "
            f"but the post-2023 edge weakened meaningfully versus discovery. Treat it as a softer, less stable signal."
        )
    if consistency_flag == "failed_validation":
        return (
            f"{symbol_label} dropped {threshold_label} with {holding_days}d holding looked positive in discovery, "
            f"but that edge did not hold in validation. Treat the original pattern as possibly overfit."
        )
    if consistency_flag == "improved_in_validation":
        return (
            f"{symbol_label} dropped {threshold_label} with {holding_days}d holding was weak in discovery but improved in validation. "
            f"This may reflect regime change rather than a stable long-run edge."
        )
    return (
        f"{symbol_label} dropped {threshold_label} with {holding_days}d holding showed mixed or weak results across the two periods. "
        f"Use this as exploratory evidence rather than a confirmed signal."
    )


results = []

for symbol in SYMBOLS:
    df = pd.read_csv(f"data/{symbol}.csv")
    df["date"] = pd.to_datetime(df["open_time"], unit="ms")
    df["close"] = df["close"].astype(float)
    df["daily_return"] = df["close"].pct_change()

    discovery_df = df[df["date"] <= DISCOVERY_END].copy()
    validation_df = df[df["date"] >= VALIDATION_START].copy()

    discovery_start = discovery_df["date"].min().strftime("%Y-%m-%d")
    discovery_end = discovery_df["date"].max().strftime("%Y-%m-%d")
    validation_start = validation_df["date"].min().strftime("%Y-%m-%d")
    validation_end = validation_df["date"].max().strftime("%Y-%m-%d")

    for threshold in THRESHOLDS:
        for holding_days in HOLDING_PERIODS:
            discovery_stats = compute_stats(discovery_df, threshold, holding_days)
            validation_stats = compute_stats(validation_df, threshold, holding_days)
            consistency_flag = build_consistency_label(discovery_stats, validation_stats)
            confidence_label, confidence_score, confidence_reasons = build_confidence_assessment(
                discovery_stats,
                validation_stats,
                consistency_flag,
            )
            summary_note = build_summary_note(
                symbol,
                threshold,
                holding_days,
                discovery_stats,
                validation_stats,
                consistency_flag,
            )

            results.append({
                "symbol": symbol,
                "threshold": threshold,
                "holding_days": holding_days,
                "discovery_start": discovery_start,
                "discovery_end": discovery_end,
                "validation_start": validation_start,
                "validation_end": validation_end,
                "discovery_sample_size": discovery_stats["sample_size"],
                "discovery_mean_return": discovery_stats["mean_return"],
                "discovery_median_return": discovery_stats["median_return"],
                "discovery_win_rate": discovery_stats["win_rate"],
                "discovery_sharpe_ratio": discovery_stats["sharpe_ratio"],
                "discovery_sortino_ratio": discovery_stats["sortino_ratio"],
                "discovery_max_drawdown": discovery_stats["max_drawdown"],
                "validation_sample_size": validation_stats["sample_size"],
                "validation_mean_return": validation_stats["mean_return"],
                "validation_median_return": validation_stats["median_return"],
                "validation_win_rate": validation_stats["win_rate"],
                "validation_sharpe_ratio": validation_stats["sharpe_ratio"],
                "validation_sortino_ratio": validation_stats["sortino_ratio"],
                "validation_max_drawdown": validation_stats["max_drawdown"],
                "consistency_flag": consistency_flag,
                "confidence_label": confidence_label,
                "confidence_score": confidence_score,
                "confidence_reasons": confidence_reasons,
                "summary_note": summary_note,
            })

results_df = pd.DataFrame(results)
results_df.to_csv("data/pattern_validation_results.csv", index=False)
print("Saved validation results to data/pattern_validation_results.csv")
