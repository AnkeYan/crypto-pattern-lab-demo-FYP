"""
analyze_drawdown_recovery.py
回撤恢復分析：價格從高點下跌 X% 後，歷史上需要幾天回到前高

定義：
  drawdown_event: 從滾動 N 天最高點下跌超過 threshold%
  recovery_days: 從觸及 drawdown threshold 當天起，回到前高所需天數
  dnr (did not recover): 在 max_horizon 天內未回到前高

閾值：-5%, -10%, -15%, -20%
max_horizon: 90 天

輸出 data/drawdown_recovery_results.csv
Schema:
  symbol, threshold, n_events, recovered_count, dnr_count,
  recovery_rate, median_days, mean_days, p25_days, p75_days, max_days
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR   = Path(__file__).parent.parent / "data"
OUT_PATH   = DATA_DIR / "drawdown_recovery_results.csv"

SYMBOLS    = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
THRESHOLDS = [-0.05, -0.10, -0.15, -0.20]
PEAK_WINDOW = 60    # look-back window for defining the local peak (days)
MAX_HORIZON = 90    # max days to look for recovery
MIN_GAP     = 14    # min days between events to avoid double-counting


def find_drawdown_events(close: pd.Series, threshold: float) -> list[dict]:
    """
    Returns list of events where price fell >= |threshold| from rolling peak.
    Each event: { idx: first day threshold was breached, peak_price, trough_price, peak_idx }
    """
    events = []
    last_event_idx = -MIN_GAP  # ensure first event can be captured

    for i in range(PEAK_WINDOW, len(close)):
        peak_price = float(close.iloc[i - PEAK_WINDOW : i].max())
        current    = float(close.iloc[i])
        drawdown   = (current - peak_price) / peak_price

        if drawdown <= threshold:
            # Check minimum gap from last event
            if i - last_event_idx >= MIN_GAP:
                events.append({
                    "idx":         i,
                    "peak_price":  peak_price,
                    "trough_price": current,
                    "drawdown":    drawdown,
                })
                last_event_idx = i

    return events


def analyze_symbol(symbol: str) -> list[dict]:
    df    = pd.read_csv(DATA_DIR / f"{symbol}.csv")
    df["date"] = pd.to_datetime(df["open_time"], unit="ms")
    df    = df.sort_values("date").reset_index(drop=True)
    close = df["close"].astype(float)

    rows = []

    for thr in THRESHOLDS:
        events = find_drawdown_events(close, thr)
        if not events:
            rows.append({
                "symbol": symbol, "threshold": thr,
                "n_events": 0, "recovered_count": 0, "dnr_count": 0,
                "recovery_rate": None, "median_days": None, "mean_days": None,
                "p25_days": None, "p75_days": None, "max_days": None,
            })
            continue

        recovery_days_list = []
        dnr_count = 0

        for ev in events:
            i          = ev["idx"]
            peak_price = ev["peak_price"]

            # Look forward up to MAX_HORIZON days for recovery
            recovered = False
            for j in range(i + 1, min(i + MAX_HORIZON + 1, len(close))):
                if float(close.iloc[j]) >= peak_price:
                    recovery_days_list.append(j - i)
                    recovered = True
                    break
            if not recovered:
                dnr_count += 1

        n_events       = len(events)
        recovered_count = len(recovery_days_list)

        if recovery_days_list:
            arr = np.array(recovery_days_list)
            rows.append({
                "symbol":          symbol,
                "threshold":       thr,
                "n_events":        n_events,
                "recovered_count": recovered_count,
                "dnr_count":       dnr_count,
                "recovery_rate":   round(recovered_count / n_events, 4),
                "median_days":     round(float(np.median(arr)), 1),
                "mean_days":       round(float(np.mean(arr)), 1),
                "p25_days":        round(float(np.percentile(arr, 25)), 1),
                "p75_days":        round(float(np.percentile(arr, 75)), 1),
                "max_days":        int(np.max(arr)),
            })
        else:
            rows.append({
                "symbol":          symbol,
                "threshold":       thr,
                "n_events":        n_events,
                "recovered_count": 0,
                "dnr_count":       dnr_count,
                "recovery_rate":   0.0,
                "median_days":     None,
                "mean_days":       None,
                "p25_days":        None,
                "p75_days":        None,
                "max_days":        None,
            })

    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df_out = pd.DataFrame(all_rows)
    df_out.to_csv(OUT_PATH, index=False)
    print(f"\n✅  drawdown_recovery_results: {len(df_out)} rows → {OUT_PATH}")

    for sym in SYMBOLS:
        print(f"\n  {sym}:")
        for _, row in df_out[df_out["symbol"] == sym].iterrows():
            thr  = row["threshold"]
            n    = int(row["n_events"])
            rr   = row["recovery_rate"]
            med  = row["median_days"]
            rr_str  = f"{rr*100:.0f}%" if rr is not None and not np.isnan(rr) else "—"
            med_str = f"{med:.0f}d"    if med is not None and not np.isnan(med) else "DNR"
            print(f"    {thr*100:.0f}%: n={n}, recovery_rate={rr_str}, median={med_str}")


if __name__ == "__main__":
    main()
