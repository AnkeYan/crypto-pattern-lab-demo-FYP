print("analyze_fear_greed started")

import pandas as pd
import requests
from scipy import stats
import os

# ── 設定 ──────────────────────────────────────────────────────────────────────
SYMBOLS      = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
THRESHOLDS   = [-0.03, -0.05, -0.07]
HOLDING_DAYS = [1, 3, 7]

# Fear & Greed 分層門檻（Alternative.me 官方定義）
FG_BANDS = [
    (0,  24, "Extreme Fear"),
    (25, 44, "Fear"),
    (45, 55, "Neutral"),
    (56, 75, "Greed"),
    (76, 100, "Extreme Greed"),
]

# 前置分析：用觸發日「前幾天」的平均情緒
FG_LOOKBACK_DAYS = 7

# ── 步驟 1：抓取 Fear & Greed 數據 ───────────────────────────────────────────
# Alternative.me 免費 API，無需 key，最多回傳 3000 天
print("Downloading Fear & Greed data from alternative.me...")
url = "https://api.alternative.me/fng/?limit=3000&format=json"
resp = requests.get(url, timeout=15)
resp.raise_for_status()
raw = resp.json()["data"]  # list of {value, value_classification, timestamp}

fg_df = pd.DataFrame(raw)
fg_df["date"] = pd.to_datetime(fg_df["timestamp"].astype(int), unit="s").dt.normalize()
fg_df["fg"]   = fg_df["value"].astype(int)
fg_df = fg_df[["date", "fg"]].sort_values("date").reset_index(drop=True)
print(f"Fear & Greed data loaded: {len(fg_df)} days "
      f"({fg_df['date'].min().date()} → {fg_df['date'].max().date()})")

results = []

# ── 步驟 2：逐幣種分析 ────────────────────────────────────────────────────────
for symbol in SYMBOLS:
    print(f"\n================ {symbol} ================")

    csv_path = os.path.join("data", f"{symbol}.csv")
    df = pd.read_csv(csv_path)
    df["close"] = df["close"].astype(float)

    # open_time 是 Binance Unix 毫秒 timestamp → 轉成日期
    df["date"] = pd.to_datetime(df["open_time"], unit="ms").dt.normalize()
    df["daily_return"] = df["close"].pct_change()

    # 合併 Fear & Greed（按日期 left join）
    # F&G 每天都有（包括週末），不需要 ffill
    df = df.merge(fg_df, on="date", how="left")

    # 前7天平均 F&G：shift(1) 代表「不包括觸發日當天」，只看前面7天
    df["fg_pre7_avg"] = df["fg"].shift(1).rolling(window=FG_LOOKBACK_DAYS).mean()

    for threshold in THRESHOLDS:
        print(f"  threshold: {threshold:.0%}")

        drop_mask = df["daily_return"] <= threshold
        drop_idx  = df.index[drop_mask]

        if len(drop_idx) < 5:
            print(f"    Too few events ({len(drop_idx)}), skipping")
            continue

        for hold in HOLDING_DAYS:
            future_return = df["close"].shift(-hold) / df["close"] - 1
            df[f"future_{hold}d"] = future_return

            events = df.loc[drop_idx, ["date", "fg", "fg_pre7_avg", f"future_{hold}d"]].dropna()

            if len(events) < 5:
                print(f"    {hold}d: too few valid events after dropna, skipping")
                continue

            ret    = events[f"future_{hold}d"]
            fg_t   = events["fg"]           # 觸發日當天 F&G 值
            fg_pre = events["fg_pre7_avg"]  # 觸發日前7天平均 F&G

            # ── 分析 A：觸發日當天 F&G 與後續回報的 Pearson 相關係數 ─────────
            corr_same, p_same = stats.pearsonr(fg_t, ret)

            # ── 分析 B：前7天平均 F&G 與後續回報的 Pearson 相關係數 ──────────
            corr_pre, p_pre = stats.pearsonr(fg_pre, ret)

            # ── 分析 C：F&G 五層分層統計 ─────────────────────────────────────
            def band_stats(label):
                """取某個情緒分層的事件，計算 n / mean_return / win_rate"""
                band = next(b for b in FG_BANDS if b[2] == label)
                mask = (fg_t >= band[0]) & (fg_t <= band[1])
                sub  = ret[mask]
                if len(sub) < 3:
                    return {"n": int(len(sub)), "mean": None, "win_rate": None}
                return {
                    "n":        int(len(sub)),
                    "mean":     round(float(sub.mean()), 4),
                    "win_rate": round(float((sub > 0).mean()), 4),
                }

            ef = band_stats("Extreme Fear")
            fe = band_stats("Fear")
            ne = band_stats("Neutral")
            gr = band_stats("Greed")
            eg = band_stats("Extreme Greed")

            print(f"    {hold}d | corr_same={corr_same:.3f}(p={p_same:.3f}) "
                  f"corr_pre={corr_pre:.3f}(p={p_pre:.3f}) | "
                  f"EF={ef['n']} F={fe['n']} N={ne['n']} G={gr['n']} EG={eg['n']}")

            results.append({
                # 基本維度
                "symbol":       symbol,
                "threshold":    threshold,
                "holding_days": hold,
                "sample_size":  len(events),

                # 分析 A：觸發日當天情緒相關
                "corr_fg_same_day": round(float(corr_same), 4),
                "p_fg_same_day":    round(float(p_same), 4),

                # 分析 B：前7天平均情緒相關（前置預警）
                "corr_fg_pre7":     round(float(corr_pre), 4),
                "p_fg_pre7":        round(float(p_pre), 4),

                # 分析 C：五層分層
                "ef_n":        ef["n"],
                "ef_mean":     ef["mean"],
                "ef_win_rate": ef["win_rate"],

                "fe_n":        fe["n"],
                "fe_mean":     fe["mean"],
                "fe_win_rate": fe["win_rate"],

                "ne_n":        ne["n"],
                "ne_mean":     ne["mean"],
                "ne_win_rate": ne["win_rate"],

                "gr_n":        gr["n"],
                "gr_mean":     gr["mean"],
                "gr_win_rate": gr["win_rate"],

                "eg_n":        eg["n"],
                "eg_mean":     eg["mean"],
                "eg_win_rate": eg["win_rate"],
            })

# ── 步驟 3：輸出 CSV ──────────────────────────────────────────────────────────
out_df   = pd.DataFrame(results)
out_path = "data/fear_greed_results.csv"
out_df.to_csv(out_path, index=False)
print(f"\nSaved {len(results)} rows to {out_path}")
print(out_df[["symbol","threshold","holding_days","sample_size",
              "corr_fg_same_day","p_fg_same_day",
              "corr_fg_pre7","p_fg_pre7",
              "ef_n","fe_n","ne_n","gr_n","eg_n"]].to_string(index=False))
