"""
analyze_signals.py
Signal Intelligence：市場狀態分類 + 信號匯聚評分 + 條件概率統計

輸出：
  data/regime_results.csv        — 每天的 regime 標籤（用於歷史分佈圖）
  data/signal_summary.csv        — 當前狀態快照（每個幣種一行）
  data/confluence_results.csv    — 不同信號組合的條件概率統計

Regime 規則（規則版，不依賴 HMM）：
  Bull    : close > SMA50 > SMA200 且 30d 回報 > +5%
  Bear    : close < SMA50 < SMA200 且 30d 回報 < -5%
  Sideways: 其他
"""

import pandas as pd
import numpy as np
from pathlib import Path
from itertools import combinations

DATA_DIR   = Path(__file__).parent.parent / "data"
REGIME_OUT     = DATA_DIR / "regime_results.csv"
SUMMARY_OUT    = DATA_DIR / "signal_summary.csv"
CONFLUENCE_OUT = DATA_DIR / "confluence_results.csv"

SYMBOLS  = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
HOLDINGS = [1, 3, 7]


def compute_rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta    = close.diff()
    gain     = delta.clip(lower=0).ewm(alpha=1/window, adjust=False).mean()
    loss     = (-delta.clip(upper=0)).ewm(alpha=1/window, adjust=False).mean()
    rs       = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def classify_regime(close: pd.Series) -> pd.Series:
    sma50  = close.rolling(50).mean()
    sma200 = close.rolling(200).mean()
    ret30  = close.pct_change(30)

    regimes = []
    for i in range(len(close)):
        if pd.isna(sma200.iloc[i]):
            regimes.append("unknown")
            continue
        above200 = close.iloc[i] > sma200.iloc[i]
        above50  = close.iloc[i] > sma50.iloc[i]
        r30 = ret30.iloc[i] if not pd.isna(ret30.iloc[i]) else 0
        if above200 and above50 and r30 > 0.05:
            regimes.append("bull")
        elif (not above200) and (not above50) and r30 < -0.05:
            regimes.append("bear")
        else:
            regimes.append("sideways")
    return pd.Series(regimes, index=close.index)


def compute_stats(returns: pd.Series) -> dict:
    n = len(returns)
    if n == 0:
        return dict(n=0, win_rate=None, mean_return=None)
    return dict(
        n          = n,
        win_rate   = round(float((returns > 0).mean()), 4),
        mean_return= round(float(returns.mean()), 6),
    )


def analyze_symbol(symbol: str):
    path  = DATA_DIR / f"{symbol}.csv"
    df    = pd.read_csv(path)
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms")
    df          = df.sort_values("date").reset_index(drop=True)
    close = df["close"].astype(float)
    vol   = df["volume"].astype(float)

    # ── 技術指標 ──────────────────────────────────────────────────────────────
    rsi14      = compute_rsi(close, 14)
    sma20      = close.rolling(20).mean()
    std20      = close.rolling(20).std()
    bb_lower   = sma20 - 2 * std20        # Bollinger 下軌
    daily_ret  = close.pct_change()
    vol_zscore = (vol - vol.rolling(20).mean()) / vol.rolling(20).std()
    regime     = classify_regime(close)

    # ── 信號定義（布林值 Series）──────────────────────────────────────────────
    sig_rsi      = rsi14 < 30                            # RSI-14 超賣
    sig_bollinger= close < bb_lower                       # Bollinger 下軌突破
    sig_drop3    = daily_ret <= -0.03                     # 單日跌幅 ≥ 3%
    sig_vol_spike= vol_zscore > 2                         # 成交量異常放大

    # ── regime_results.csv：每天的 regime 標籤 ───────────────────────────────
    regime_rows = []
    for i in range(len(df)):
        regime_rows.append({
            "symbol": symbol,
            "date":   df["date"].iloc[i].strftime("%Y-%m-%d"),
            "regime": regime.iloc[i],
            "close":  round(float(close.iloc[i]), 2),
            "rsi14":  round(float(rsi14.iloc[i]), 2) if not pd.isna(rsi14.iloc[i]) else None,
        })

    # ── signal_summary.csv：當前狀態快照 ──────────────────────────────────────
    last = -1
    summary = {
        "symbol":         symbol,
        "last_price":     round(float(close.iloc[last]), 2),
        "current_regime": regime.iloc[last],
        "rsi14":          round(float(rsi14.iloc[last]), 2) if not pd.isna(rsi14.iloc[last]) else None,
        "bb_lower":       round(float(bb_lower.iloc[last]), 2) if not pd.isna(bb_lower.iloc[last]) else None,
        "daily_ret":      round(float(daily_ret.iloc[last]), 6) if not pd.isna(daily_ret.iloc[last]) else None,
        "vol_zscore":     round(float(vol_zscore.iloc[last]), 3) if not pd.isna(vol_zscore.iloc[last]) else None,
        "sig_rsi":        bool(sig_rsi.iloc[last]),
        "sig_bollinger":  bool(sig_bollinger.iloc[last]),
        "sig_drop3":      bool(sig_drop3.iloc[last]),
        "sig_vol_spike":  bool(sig_vol_spike.iloc[last]),
        # confluence score：觸發信號數 / 4，轉成 0-100
        "confluence_score": int(sum([
            bool(sig_rsi.iloc[last]),
            bool(sig_bollinger.iloc[last]),
            bool(sig_drop3.iloc[last]),
            bool(sig_vol_spike.iloc[last]),
        ])) * 25,
    }

    # ── confluence_results.csv：信號組合的條件概率 ───────────────────────────
    signals = {
        "rsi":       sig_rsi,
        "bollinger": sig_bollinger,
        "drop3":     sig_drop3,
        "vol_spike": sig_vol_spike,
    }

    conf_rows = []
    signal_keys = list(signals.keys())

    # 單個信號 + 兩個信號組合
    combos = [(k,) for k in signal_keys]
    for r in range(2, len(signal_keys) + 1):
        combos += list(combinations(signal_keys, r))

    for combo in combos:
        # 組合 mask：所有信號同時觸發
        mask = pd.Series([True] * len(df), index=df.index)
        for k in combo:
            mask = mask & signals[k]

        for holding in HOLDINGS:
            future_ret = (close.shift(-holding) - close) / close
            triggered  = future_ret[mask & future_ret.notna()]
            stats      = compute_stats(triggered)

            # Regime breakdown
            for reg in ["bull", "bear", "sideways", "all"]:
                if reg == "all":
                    sub = triggered
                else:
                    reg_mask = mask & (regime == reg) & future_ret.notna()
                    sub = future_ret[reg_mask]
                s = compute_stats(sub)
                conf_rows.append({
                    "symbol":       symbol,
                    "signals":      "+".join(combo),
                    "n_signals":    len(combo),
                    "holding_days": holding,
                    "regime":       reg,
                    "n":            s["n"],
                    "win_rate":     s["win_rate"],
                    "mean_return":  s["mean_return"],
                })

    # Regime × 無信號條件（baseline）
    for reg in ["bull", "bear", "sideways", "all"]:
        for holding in HOLDINGS:
            future_ret = (close.shift(-holding) - close) / close
            if reg == "all":
                sub = future_ret.dropna()
            else:
                sub = future_ret[(regime == reg) & future_ret.notna()]
            s = compute_stats(sub)
            conf_rows.append({
                "symbol":       symbol,
                "signals":      "baseline",
                "n_signals":    0,
                "holding_days": holding,
                "regime":       reg,
                "n":            s["n"],
                "win_rate":     s["win_rate"],
                "mean_return":  s["mean_return"],
            })

    return regime_rows, summary, conf_rows


def main():
    all_regime   = []
    all_summary  = []
    all_conf     = []

    for symbol in SYMBOLS:
        print(f"  Analyzing {symbol}...")
        r, s, c = analyze_symbol(symbol)
        all_regime.extend(r)
        all_summary.append(s)
        all_conf.extend(c)

    pd.DataFrame(all_regime).to_csv(REGIME_OUT,     index=False)
    pd.DataFrame(all_summary).to_csv(SUMMARY_OUT,   index=False)
    pd.DataFrame(all_conf).to_csv(CONFLUENCE_OUT,   index=False)

    print(f"\n✅  regime_results:    {len(all_regime)} rows")
    print(f"✅  signal_summary:    {len(all_summary)} rows")
    print(f"✅  confluence_results:{len(all_conf)} rows")

    # 當前快照
    print("\n=== 當前狀態 ===")
    for s in all_summary:
        active = [k for k in ["sig_rsi","sig_bollinger","sig_drop3","sig_vol_spike"] if s[k]]
        print(f"  {s['symbol']}: regime={s['current_regime']}, RSI={s['rsi14']}, score={s['confluence_score']}, active={active or ['none']}")


if __name__ == "__main__":
    main()
