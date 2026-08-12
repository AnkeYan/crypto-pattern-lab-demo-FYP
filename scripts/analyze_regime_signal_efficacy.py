"""
analyze_regime_signal_efficacy.py
Regime-Conditional Signal Efficacy Analysis（FYP 實證研究）

核心問題：
  在 Bull / Sideways / Bear 不同市場 Regime 下，
  RSI / Bollinger / Drop3 等技術信號的勝率是否有統計顯著差異？

方法：
  1. 從 confluence_results.csv 讀取每個 regime 下各信號的勝率和樣本數
  2. 計算每個信號相對 baseline（無條件勝率）的 Edge
  3. 用 Wilson CI（95%）估計勝率的置信區間
  4. 用 Chi-square test 檢驗 regime 之間勝率差異是否顯著（p < 0.05）
  5. 輸出到 regime_signal_efficacy.csv

輸出 schema：
  symbol, signal, holding_days,
  bull_wr, bull_n, bull_lo, bull_hi,
  bear_wr, bear_n, bear_lo, bear_hi,
  sideways_wr, sideways_n, sideways_lo, sideways_hi,
  all_wr, all_n,
  bull_edge, bear_edge, sideways_edge,
  chi2_pvalue, significant,
  best_regime, worst_regime
"""

import pandas as pd
import numpy as np
from pathlib import Path
from scipy import stats

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "regime_signal_efficacy.csv"

SYMBOLS      = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
REGIMES      = ["bull", "bear", "sideways"]
HOLDING_DAYS = [1, 3, 7]

# 單信號（n_signals == 1）才做 regime 分析，組合信號樣本太少
SINGLE_SIGNALS = ["rsi", "bollinger", "drop3", "vol_spike"]


def wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson 95% 置信區間"""
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denom
    margin = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denom
    return (round(max(0.0, centre - margin), 4), round(min(1.0, centre + margin), 4))


def chi2_test(regime_data: dict) -> float:
    """
    Chi-square test 檢驗三個 regime 的勝率是否顯著不同。
    輸入 dict: {regime: (wins, n)}
    回傳 p-value（< 0.05 = 顯著差異）
    """
    observed = []
    for regime in REGIMES:
        if regime in regime_data and regime_data[regime][1] >= 5:
            wins, n = regime_data[regime]
            losses = n - wins
            observed.append([wins, losses])
    if len(observed) < 2:
        return 1.0
    try:
        _, p, _, _ = stats.chi2_contingency(observed)
        return round(float(p), 4)
    except Exception:
        return 1.0


def main():
    conf_df = pd.read_csv(DATA_DIR / "confluence_results.csv")
    rows = []

    for symbol in SYMBOLS:
        sym_df = conf_df[conf_df["symbol"] == symbol]

        for signal in SINGLE_SIGNALS:
            for hd in HOLDING_DAYS:
                # baseline（unconditional win rate）
                base_row = sym_df[
                    (sym_df["signals"] == "baseline") &
                    (sym_df["holding_days"] == hd) &
                    (sym_df["regime"] == "all")
                ]
                if len(base_row) == 0:
                    continue
                baseline_wr = float(base_row["win_rate"].iloc[0])
                baseline_n  = int(base_row["n"].iloc[0])

                # all-regime row for this signal
                all_row = sym_df[
                    (sym_df["signals"] == signal) &
                    (sym_df["n_signals"] == 1) &
                    (sym_df["holding_days"] == hd) &
                    (sym_df["regime"] == "all")
                ]
                if len(all_row) == 0:
                    continue
                all_wr = float(all_row["win_rate"].iloc[0])
                all_n  = int(all_row["n"].iloc[0])

                # per-regime stats
                regime_stats = {}
                regime_chi2_data = {}

                for regime in REGIMES:
                    r_row = sym_df[
                        (sym_df["signals"] == signal) &
                        (sym_df["n_signals"] == 1) &
                        (sym_df["holding_days"] == hd) &
                        (sym_df["regime"] == regime)
                    ]
                    if len(r_row) == 0 or pd.isna(r_row["win_rate"].iloc[0]):
                        regime_stats[regime] = (np.nan, 0, np.nan, np.nan, np.nan)
                        continue

                    wr = float(r_row["win_rate"].iloc[0])
                    n  = int(r_row["n"].iloc[0])
                    lo, hi = wilson_ci(round(wr * n), n)
                    edge = round(wr - baseline_wr, 4)
                    regime_stats[regime] = (wr, n, lo, hi, edge)
                    regime_chi2_data[regime] = (round(wr * n), n)

                # chi2 test across regimes
                pval = chi2_test(regime_chi2_data)
                significant = pval < 0.05

                # best / worst regime by win rate (min n=5)
                valid = {r: regime_stats[r] for r in REGIMES
                         if regime_stats[r][1] >= 5 and not np.isnan(regime_stats[r][0])}
                best_regime  = max(valid, key=lambda r: valid[r][0]) if valid else ""
                worst_regime = min(valid, key=lambda r: valid[r][0]) if valid else ""

                bull     = regime_stats.get("bull",     (np.nan, 0, np.nan, np.nan, np.nan))
                bear     = regime_stats.get("bear",     (np.nan, 0, np.nan, np.nan, np.nan))
                sideways = regime_stats.get("sideways", (np.nan, 0, np.nan, np.nan, np.nan))

                rows.append({
                    "symbol":        symbol,
                    "signal":        signal,
                    "holding_days":  hd,
                    # baseline
                    "baseline_wr":   round(baseline_wr, 4),
                    "baseline_n":    baseline_n,
                    # all-regime
                    "all_wr":        round(all_wr, 4),
                    "all_n":         all_n,
                    # bull
                    "bull_wr":       round(bull[0], 4) if not np.isnan(bull[0]) else None,
                    "bull_n":        bull[1],
                    "bull_lo":       bull[2],
                    "bull_hi":       bull[3],
                    "bull_edge":     bull[4],
                    # bear
                    "bear_wr":       round(bear[0], 4) if not np.isnan(bear[0]) else None,
                    "bear_n":        bear[1],
                    "bear_lo":       bear[2],
                    "bear_hi":       bear[3],
                    "bear_edge":     bear[4],
                    # sideways
                    "sideways_wr":   round(sideways[0], 4) if not np.isnan(sideways[0]) else None,
                    "sideways_n":    sideways[1],
                    "sideways_lo":   sideways[2],
                    "sideways_hi":   sideways[3],
                    "sideways_edge": sideways[4],
                    # stats
                    "chi2_pvalue":   pval,
                    "significant":   significant,
                    "best_regime":   best_regime,
                    "worst_regime":  worst_regime,
                })

    df_out = pd.DataFrame(rows)
    df_out.to_csv(OUT_PATH, index=False)
    print(f"✅  regime_signal_efficacy: {len(df_out)} rows → {OUT_PATH}")

    # ── Print summary ──────────────────────────────────────────────────────
    print("\n── Regime-Conditional Signal Efficacy (7d holding) ──────────────")
    print(f"  {'Symbol':<10} {'Signal':<12} {'Baseline':>9} {'Bull':>9} {'Bear':>9} {'Sideways':>10} {'p-val':>7} {'Sig?':>5} {'Best Regime':>12}")
    print(f"  {'-'*85}")
    for _, row in df_out[df_out["holding_days"] == 7].iterrows():
        sig = "✓" if row["significant"] else "—"
        bull_s = f"{row['bull_wr']:.1%}" if row["bull_wr"] is not None else "N/A"
        bear_s = f"{row['bear_wr']:.1%}" if row["bear_wr"] is not None else "N/A"
        side_s = f"{row['sideways_wr']:.1%}" if row["sideways_wr"] is not None else "N/A"
        print(f"  {row['symbol']:<10} {row['signal']:<12} {row['baseline_wr']:>9.1%} {bull_s:>9} {bear_s:>9} {side_s:>10} {row['chi2_pvalue']:>7.3f} {sig:>5}   {row['best_regime']:>12}")


if __name__ == "__main__":
    main()
