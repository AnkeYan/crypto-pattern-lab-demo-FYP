"""
analyze_multifactor_calibration.py
Multi-Factor Score 歷史校準（觸發式評分版）

對每個歷史交易日計算「當天的 Multi-Factor Score」，
然後記錄 7 天後的實際漲跌結果，
用於校準分數區間（score bucket）vs 歷史勝率的關係。

【校準版 vs Dashboard 版的差異】
  Dashboard 版（analyze_multifactor.py）：
    - 有 neutral zone 基礎分（正常市場也給 0.35–0.40 分）
    - 每天都輸出一個有意義的「現況分數」，適合即時展示

  校準版（此腳本）：
    - 觸發式評分：只有真正出現異常條件才計分，否則因子得 0
    - 目的：讓分數分布從 0 到 100 自然拉開，使 bucket 校準有統計意義
    - 高分 = 多個超賣/異常因子同時觸發（罕見），是否真的有更高勝率？
    - 後續 XGBoost 會自動學出最優權重，人工權重只是暫時的

觸發條件設計：
  F1 RSI：RSI < 50 才計分（愈低愈強），≥ 50 給 0
  F2 Bollinger：收盤在 BB 下方（dev < 0）才計分，≥ 0 給 0
  F3 GARCH：固定 0（無歷史記錄，不納入校準）
  F4 Fear & Greed：固定 0（靜態代理，不納入校準）
  F5 Month Seasonality：靜態月份查詢，負向月份給 0
  F6 Regime Favorability：逐日 regime 查詢，unfavorable regime 給 0
  F7 Volume Surge：放量下跌才計分，否則給 0
  F8 Price Momentum：負動量（短期比長期弱）才計分，否則給 0
  F9 Funding Rate：從 funding_rate_history.csv 逐日查詢（BTC/ETH/SOL）
  F10 Long/Short Ratio：固定 0（歷史太短）
  F11 Active Addresses：從 active_addresses_history.csv 逐日查詢（BTC only，ETH/SOL 固定 0.5）
    觸發式：只有 f11 > 0.5（地址萎縮）才計分，否則給 0

輸出 data/multifactor_calibration.csv
Schema:
  symbol, date, score, score_bucket,
  f1_norm..f12_norm, outcome_7d, win
"""

import pandas as pd
import numpy as np
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "multifactor_calibration.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

WEIGHTS = {
    "rsi_intensity":       0.16,
    "bollinger_deviation": 0.12,
    "garch_vol_regime":    0.09,
    "fear_greed_zone":     0.10,
    "month_seasonality":   0.10,
    "regime_favorability": 0.10,
    "volume_surge":        0.06,
    "price_momentum":      0.06,
    "funding_rate":        0.07,  # F9（逐日歷史）
    "ls_ratio":            0.06,  # F10（固定 0，歷史太短）
    "active_addresses":    0.06,  # F11（BTC only，ETH/SOL 固定 0.5）
    "turbulence_calm":     0.07,  # F12（逐日歷史，低 turbulence = 高分）
}

FACTOR_LIST = [
    "rsi_intensity", "bollinger_deviation", "garch_vol_regime",
    "fear_greed_zone", "month_seasonality", "regime_favorability",
    "volume_surge", "price_momentum", "funding_rate", "ls_ratio",
    "active_addresses", "turbulence_calm",
]


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def score_bucket(score: float) -> str:
    if score < 20:
        return "0–20"
    elif score < 40:
        return "20–40"
    elif score < 60:
        return "40–60"
    elif score < 80:
        return "60–80"
    else:
        return "80–100"


def load_static_f4(symbol: str) -> float:
    """
    F4 靜態代理：從 fear_greed_results.csv 讀取
    Extreme Fear zone win_rate vs baseline，整個回測期視為固定值。
    回傳 normalized score (0–1)。
    """
    try:
        fg_df = pd.read_csv(DATA_DIR / "fear_greed_results.csv")
        fg_row = fg_df[
            (fg_df["symbol"] == symbol) &
            (fg_df["threshold"] == -0.03) &
            (fg_df["holding_days"] == 7)
        ]
        conf_df = pd.read_csv(DATA_DIR / "confluence_results.csv")
        baseline_all = conf_df[
            (conf_df["symbol"] == symbol) &
            (conf_df["signals"] == "baseline") &
            (conf_df["holding_days"] == 7) &
            (conf_df["regime"] == "all")
        ]
        all_baseline_wr = float(baseline_all["win_rate"].iloc[0]) if len(baseline_all) > 0 else 0.5

        if len(fg_row) > 0:
            fg_row = fg_row.iloc[0]
            ef_wr = float(fg_row["ef_win_rate"]) if pd.notna(fg_row["ef_win_rate"]) else all_baseline_wr
            ef_n  = int(fg_row["ef_n"])           if pd.notna(fg_row["ef_n"])        else 0
            edge  = ef_wr - all_baseline_wr
            n_weight = clamp01(ef_n / 80.0)
            return clamp01(n_weight * (0.5 + edge * 3.0))
    except Exception:
        pass
    return 0.5


def load_static_f5(symbol: str) -> dict:
    """
    F5 靜態月份代理：讀取所有月份的 normalized score，
    回傳 dict {month(int): f5_raw_score(float)}。
    """
    result = {}
    try:
        ms_df  = pd.read_csv(DATA_DIR / "month_seasonality_results.csv")
        sym_df = ms_df[ms_df["symbol"] == symbol]
        for _, row in sym_df.iterrows():
            month    = int(row["month"])
            med_ret  = float(row["median_return"]) if pd.notna(row["median_return"]) else 0.0
            win_rate = float(row["win_rate"])       if pd.notna(row["win_rate"])      else 0.5
            n        = int(row["sample_size"])      if pd.notna(row["sample_size"])   else 0
            if n >= 9:
                n_weight = 1.0
            elif n >= 7:
                n_weight = 0.7
            elif n >= 5:
                n_weight = 0.3
            else:
                n_weight = 0.1
            result[month] = clamp01(n_weight * (0.5 + med_ret * 2.0 + (win_rate - 0.5)))
    except Exception:
        pass
    return result


def load_regime_series(symbol: str) -> pd.Series:
    """
    從 regime_results.csv 讀取該幣種的逐日 regime（Bull/Bear/Sideways）。
    回傳以 date 為 index 的 Series。
    """
    try:
        regime_df = pd.read_csv(DATA_DIR / "regime_results.csv")
        sym_df    = regime_df[regime_df["symbol"] == symbol][["date", "regime"]].copy()
        sym_df["date"] = pd.to_datetime(sym_df["date"])
        return sym_df.set_index("date")["regime"]
    except Exception:
        return pd.Series(dtype=str)


def load_static_f6_by_regime(symbol: str) -> dict:
    """
    F6 靜態代理：對每個 regime 計算 baseline + avg signal edge，
    回傳 dict {regime_str: f6_raw_score}。
    """
    result = {}
    try:
        conf_df = pd.read_csv(DATA_DIR / "confluence_results.csv")
        for regime in ["Bull", "Bear", "Sideways"]:
            base = conf_df[
                (conf_df["symbol"] == symbol) &
                (conf_df["signals"] == "baseline") &
                (conf_df["holding_days"] == 7) &
                (conf_df["regime"] == regime)
            ]
            base_wr = float(base["win_rate"].iloc[0]) if len(base) > 0 and pd.notna(base["win_rate"].iloc[0]) else 0.5

            single_sigs = conf_df[
                (conf_df["symbol"] == symbol) &
                (conf_df["n_signals"] == 1) &
                (conf_df["holding_days"] == 7) &
                (conf_df["regime"] == regime) &
                (conf_df["n"] >= 5)
            ]
            avg_sig_wr = float(single_sigs["win_rate"].mean()) if len(single_sigs) > 0 else base_wr
            edge = avg_sig_wr - base_wr
            result[regime] = clamp01(0.5 + edge * 3.0)
    except Exception:
        pass
    return result


def calibrate_symbol(symbol: str) -> list[dict]:
    print(f"  {symbol}...")

    # ── Load price data ───────────────────────────────────────────────────────
    price_df        = pd.read_csv(DATA_DIR / f"{symbol}.csv")
    price_df["date"] = pd.to_datetime(price_df["open_time"], unit="ms")
    price_df        = price_df.sort_values("date").reset_index(drop=True)

    close = price_df["close"].astype(float).values
    vol   = price_df["volume"].astype(float).values
    dates = price_df["date"].values

    n_rows = len(close)
    if n_rows < 30:
        print(f"    ⚠️  Not enough data for {symbol}")
        return []

    # ── Pre-compute rolling indicators ───────────────────────────────────────
    close_s = pd.Series(close)
    vol_s   = pd.Series(vol)

    # RSI-14 (Wilder EWM)
    delta = close_s.diff()
    gain  = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    loss  = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
    rsi14 = (100 - 100 / (1 + gain / loss.replace(0, np.nan))).values

    # Bollinger deviation（相對 lower band）
    sma20  = close_s.rolling(20).mean()
    std20  = close_s.rolling(20).std()
    bb_dev = ((close_s - (sma20 - 2 * std20)) / (std20 + 1e-9)).values

    # Volume ratio (20d MA)
    vol_ma20 = vol_s.rolling(20).mean().values

    # ── Load static/semi-static factors ──────────────────────────────────────
    f4_static     = load_static_f4(symbol)
    f5_by_month   = load_static_f5(symbol)
    regime_series = load_regime_series(symbol)
    f6_by_regime  = load_static_f6_by_regime(symbol)

    # ── Load F9: Funding Rate 逐日歷史 ────────────────────────────────────────
    try:
        fr_hist = pd.read_csv(DATA_DIR / "funding_rate_history.csv")
        fr_hist["date"] = pd.to_datetime(fr_hist["date"])
        fr_sym  = fr_hist[fr_hist["symbol"] == symbol].set_index("date")["f9_norm"]
    except Exception:
        fr_sym = pd.Series(dtype=float)

    # ── Load F12: Turbulence History（逐日）────────────────────────────────
    try:
        turb_df = pd.read_csv(DATA_DIR / "turbulence_history.csv")
        turb_df["date"] = pd.to_datetime(turb_df["date"]).dt.strftime("%Y-%m-%d")
        turb_series = turb_df.set_index("date")["turbulence_norm"]
    except Exception:
        turb_series = pd.Series(dtype=float)

    # ── Load F11: Active Addresses（BTC only）────────────────────────────────
    aa_series = pd.Series(dtype=float)
    if symbol == "BTCUSDT":
        try:
            aa_df = pd.read_csv(DATA_DIR / "active_addresses_history.csv", parse_dates=["date"])
            aa_df["date"] = pd.to_datetime(aa_df["date"], utc=True).dt.tz_localize(None)
            aa_series = aa_df.set_index("date")["f11_norm"]
        except Exception:
            pass

    # ── Main loop ─────────────────────────────────────────────────────────────
    rows = []
    for i in range(20, n_rows - 7):
        date_i = pd.Timestamp(dates[i])

        # outcome_7d: (close[i+7] - close[i]) / close[i]
        outcome_7d = (close[i + 7] - close[i]) / close[i]
        win        = int(outcome_7d > 0)

        # ── F1: RSI Intensity（觸發式）───────────────────────────────────
        # RSI < 50 才計分（愈低愈強），≥ 50 無信號 → 0
        rsi_val = float(rsi14[i]) if not np.isnan(rsi14[i]) else 50.0
        if rsi_val < 50.0:
            f1_norm = clamp01((50.0 - rsi_val) / 50.0)  # RSI=0→1.0, RSI=30→0.40, RSI=49→0.02
        else:
            f1_norm = 0.0

        # ── F2: Bollinger Deviation（觸發式）─────────────────────────────
        # 收盤在 BB 下方（dev < 0）才計分；dev 是相對 lower band 偏離，< 0 = 在 band 下方
        bb_val = float(bb_dev[i]) if not np.isnan(bb_dev[i]) else 0.0
        if bb_val < 0.0:
            f2_norm = clamp01(-bb_val / 3.0)             # dev=-3→1.0, dev=-1→0.33, dev=0→0
        else:
            f2_norm = 0.0

        # ── F3: GARCH — 校準版設為 0（無歷史數據，不參與分布）────────────
        # Dashboard 版固定 0.5；校準版固定 0，避免人為抬高分數下限
        f3_norm = 0.0

        # ── F4: Fear & Greed — 校準版設為 0（靜態代理全期不變，不參與分布）
        # Dashboard 版使用 EF 邊際；校準版固定 0，避免干擾分數分布
        f4_norm = 0.0

        # ── F5: Month Seasonality（觸發式）───────────────────────────────
        # 只有正向月份（score > 0.5）才計分，負向月份 → 0
        month_i = date_i.month
        raw_f5  = f5_by_month.get(month_i, 0.5)
        f5_norm = raw_f5 if raw_f5 > 0.5 else 0.0

        # ── F6: Regime Favorability（觸發式）─────────────────────────────
        # 逐日 regime；unfavorable regime（score < 0.5）→ 0
        if len(regime_series) > 0:
            past           = regime_series[regime_series.index <= date_i]
            current_regime = past.iloc[-1] if len(past) > 0 else "Sideways"
        else:
            current_regime = "Sideways"
        raw_f6  = f6_by_regime.get(current_regime, 0.5)
        f6_norm = raw_f6 if raw_f6 > 0.5 else 0.0

        # ── F7: Volume Surge（觸發式）────────────────────────────────────
        # 只有放量下跌才計分，其他情況 → 0
        vol_ratio = float(vol[i] / vol_ma20[i]) if (not np.isnan(vol_ma20[i]) and vol_ma20[i] > 0) else 1.0
        price_3d  = (close[i] - close[i - 3]) / close[i - 3] if i >= 3 else 0.0
        if price_3d < -0.02 and vol_ratio > 1.3:
            f7_norm = clamp01((vol_ratio - 1.0) * 0.5 + abs(price_3d) * 3.0)
        else:
            f7_norm = 0.0

        # ── F8: Price Momentum（觸發式）──────────────────────────────────
        # 只有負動量（短期比長期弱）才計分，正動量 → 0
        mom_5d  = (close[i] - close[i - 5])  / close[i - 5]  if i >= 5  else 0.0
        mom_20d = (close[i] - close[i - 20]) / close[i - 20] if i >= 20 else 0.0
        rel_mom = mom_5d - mom_20d
        if rel_mom < 0:
            f8_norm = clamp01(-rel_mom * 5.0)
        else:
            f8_norm = 0.0

        # ── F9: Funding Rate（逐日動態）──────────────────────────────────
        # 從 funding_rate_history.csv 查詢當天或最近可用值
        # 無數據期間（2014–2019）→ 固定 0（觸發式：中性不計分）
        if len(fr_sym) > 0:
            past_fr = fr_sym[fr_sym.index <= date_i]
            if len(past_fr) > 0:
                raw_f9 = float(past_fr.iloc[-1])
                # 觸發式：只有 f9 > 0.5（空頭情緒明顯）才計分
                f9_norm = raw_f9 if raw_f9 > 0.5 else 0.0
            else:
                f9_norm = 0.0  # 期貨市場尚未存在
        else:
            f9_norm = 0.0

        # ── F10: Long/Short Ratio — 校準版固定 0（歷史太短）──────────────
        f10_norm = 0.0

        # ── F11: Active Addresses（BTC only，觸發式）─────────────────────
        # ETH/SOL 無歷史鏈上數據 → 固定 0（觸發式不計分）
        # BTC：地址萎縮（f11 > 0.5）才計分，否則 → 0
        if len(aa_series) > 0:
            date_naive = date_i.tz_localize(None) if date_i.tzinfo else date_i
            past_aa = aa_series[aa_series.index <= date_naive]
            if len(past_aa) > 0:
                raw_f11 = float(past_aa.iloc[-1])
                f11_norm = raw_f11 if raw_f11 > 0.5 else 0.0
            else:
                f11_norm = 0.0
        else:
            f11_norm = 0.0

        # ── Weighted Score ────────────────────────────────────────────────
        # ── F12: Turbulence Calm（取反：低 turbulence = 高分）────────────
        try:
            turb_norm_val = float(turb_series.get(str(date_i.date()), np.nan))
            if np.isnan(turb_norm_val):
                f12_norm = 0.0  # 無數據（早於 turbulence 計算起點）= 不參與校準
            else:
                # 取反：turbulence_norm 越低 = 市場越平靜 = f12 越高
                f12_norm = round(1.0 - turb_norm_val, 4)
        except Exception:
            f12_norm = 0.0

        norms = [f1_norm, f2_norm, f3_norm, f4_norm, f5_norm, f6_norm, f7_norm, f8_norm, f9_norm, f10_norm, f11_norm, f12_norm]
        total = sum(n * WEIGHTS[f] for n, f in zip(norms, FACTOR_LIST))
        score = round(total * 100, 1)

        rows.append({
            "symbol":       symbol,
            "date":         date_i.strftime("%Y-%m-%d"),
            "score":        score,
            "score_bucket": score_bucket(score),
            "f1_norm":      round(f1_norm, 4),
            "f2_norm":      round(f2_norm, 4),
            "f3_norm":      round(f3_norm, 4),
            "f4_norm":      round(f4_norm, 4),
            "f5_norm":      round(f5_norm, 4),
            "f6_norm":      round(f6_norm, 4),
            "f7_norm":      round(f7_norm, 4),
            "f8_norm":      round(f8_norm, 4),
            "f9_norm":      round(f9_norm, 4),
            "f10_norm":     round(f10_norm, 4),
            "f11_norm":     round(f11_norm, 4),
            "f12_norm":     round(f12_norm, 4),
            "outcome_7d":   round(float(outcome_7d), 6),
            "win":          win,
        })

    print(f"    → {len(rows)} rows")
    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        all_rows.extend(calibrate_symbol(symbol))

    df_out = pd.DataFrame(all_rows)

    # ── Add percentile_rank per symbol ───────────────────────────────────────
    # percentile_rank: 當天分數高於歷史上多少百分比的日子（0–100）
    # 用 rank(pct=True) × 100，相同分數取平均排名（method="average"）
    df_out["percentile_rank"] = (
        df_out.groupby("symbol")["score"]
        .rank(pct=True, method="average") * 100
    ).round(1)

    # ── Add percentile bucket（前端分組用）────────────────────────────────────
    def pct_bucket(p: float) -> str:
        if p >= 90:   return "top 10%"
        elif p >= 75: return "top 25%"
        elif p >= 50: return "top 50%"
        else:         return "bottom 50%"

    df_out["pct_bucket"] = df_out["percentile_rank"].apply(pct_bucket)

    df_out.to_csv(OUT_PATH, index=False)
    print(f"\n✅  multifactor_calibration: {len(df_out)} rows → {OUT_PATH}")

    # ── Print calibration summary by percentile bucket ───────────────────────
    print("\n── Calibration Summary (by percentile bucket) ───────────────────")
    PCT_BUCKET_ORDER = ["bottom 50%", "top 50%", "top 25%", "top 10%"]
    for sym in SYMBOLS:
        sym_df = df_out[df_out["symbol"] == sym]
        print(f"\n  {sym}  (n={len(sym_df)}, score range: {sym_df['score'].min():.1f}–{sym_df['score'].max():.1f})")
        print(f"  {'Pct Bucket':<12} {'n':>5} {'%days':>6} {'Win Rate':>9} {'Mean 7d':>9} {'pct_range':>14}")
        print(f"  {'-'*55}")
        for bucket in PCT_BUCKET_ORDER:
            b_df = sym_df[sym_df["pct_bucket"] == bucket]
            if len(b_df) == 0:
                continue
            pct_days = len(b_df) / len(sym_df)
            wr       = b_df["win"].mean()
            mean_ret = b_df["outcome_7d"].mean()
            sc_lo    = b_df["score"].min()
            sc_hi    = b_df["score"].max()
            print(f"  {bucket:<12} {len(b_df):>5} {pct_days:>6.1%} {wr:>9.1%} {mean_ret:>+9.2%}  score {sc_lo:.1f}–{sc_hi:.1f}")


if __name__ == "__main__":
    main()
