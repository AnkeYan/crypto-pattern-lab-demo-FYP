"""
analyze_regime_transition.py
Markov Chain regime transition analysis

輸出 data/regime_transition_results.csv
Schema:
  symbol, from_regime, to_regime, count, probability
  symbol, from_regime, avg_duration_days   (duration rows, to_regime="__duration__")
  symbol, current_regime, current_duration_days, streak_pct_bull, streak_pct_bear, streak_pct_sideways  (snapshot rows, from_regime="__snapshot__")
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "regime_transition_results.csv"

SYMBOLS   = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
REGIMES   = ["bull", "bear", "sideways"]


def analyze_transitions(symbol: str) -> list[dict]:
    df = pd.read_csv(DATA_DIR / "regime_results.csv")
    df = df[df["symbol"] == symbol].copy()
    df = df[df["regime"].isin(REGIMES)].reset_index(drop=True)

    if len(df) < 10:
        return []

    rows = []

    # ── 1. Transition matrix ──────────────────────────────────────────────────
    # 每次 regime 發生變化時才算一次 transition（排除同 regime 連續天）
    changes = df[df["regime"] != df["regime"].shift(1)].copy()
    changes["next_regime"] = changes["regime"].shift(-1)
    changes = changes.dropna(subset=["next_regime"])

    for from_r in REGIMES:
        subset = changes[changes["regime"] == from_r]
        total = len(subset)
        for to_r in REGIMES:
            count = int((subset["next_regime"] == to_r).sum())
            prob  = round(count / total, 4) if total > 0 else None
            rows.append({
                "symbol":      symbol,
                "from_regime": from_r,
                "to_regime":   to_r,
                "count":       count,
                "probability": prob,
                "extra":       None,
            })

    # ── 2. Average duration per regime (consecutive days) ────────────────────
    durations: dict[str, list[int]] = {r: [] for r in REGIMES}
    current = df["regime"].iloc[0]
    run_len = 1
    for i in range(1, len(df)):
        if df["regime"].iloc[i] == current:
            run_len += 1
        else:
            if current in REGIMES:
                durations[current].append(run_len)
            current = df["regime"].iloc[i]
            run_len = 1
    if current in REGIMES:
        durations[current].append(run_len)

    for r in REGIMES:
        vals = durations[r]
        avg  = round(float(np.mean(vals)), 1) if vals else None
        p25  = round(float(np.percentile(vals, 25)), 1) if vals else None
        p75  = round(float(np.percentile(vals, 75)), 1) if vals else None
        rows.append({
            "symbol":      symbol,
            "from_regime": r,
            "to_regime":   "__duration__",
            "count":       len(vals),
            "probability": avg,   # avg duration stored in probability col
            "extra":       f"{p25}|{p75}",  # P25|P75 packed
        })

    # ── 3. Current streak snapshot ───────────────────────────────────────────
    last_regime = df["regime"].iloc[-1]
    streak = 1
    for i in range(len(df) - 2, -1, -1):
        if df["regime"].iloc[i] == last_regime:
            streak += 1
        else:
            break

    # What % of past streaks of this length eventually transitioned to each regime?
    # Simpler: given current regime has lasted `streak` days,
    # what is the historical avg remaining duration?
    regime_durs = durations.get(last_regime, [])
    longer_runs = [d for d in regime_durs if d >= streak]
    avg_remaining = round(float(np.mean([d - streak for d in longer_runs])), 1) if longer_runs else 0.0

    # next-regime probability from transition matrix (reuse counts above)
    change_rows = changes[changes["regime"] == last_regime]
    total_changes = len(change_rows)
    def next_prob(to_r: str):
        c = int((change_rows["next_regime"] == to_r).sum())
        return round(c / total_changes, 4) if total_changes > 0 else None

    rows.append({
        "symbol":      symbol,
        "from_regime": "__snapshot__",
        "to_regime":   last_regime,
        "count":       int(streak),
        "probability": avg_remaining,
        "extra":       f"{next_prob('bull')}|{next_prob('bear')}|{next_prob('sideways')}",
    })

    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  {symbol}...")
        all_rows.extend(analyze_transitions(symbol))

    df_out = pd.DataFrame(all_rows)
    df_out.to_csv(OUT_PATH, index=False)
    print(f"\n✅  regime_transition_results: {len(df_out)} rows → {OUT_PATH}")


if __name__ == "__main__":
    main()
