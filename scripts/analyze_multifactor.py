"""
analyze_multifactor.py
Multi-Factor Setup Score — 跨模型加權整合

整合 8 個現有模型的信號，輸出每個幣種當前的設置質量分 (0–100)，
以及每個因子的歷史邊際貢獻（用於前端顯示分解）。

因子（各 0–1 分，加權後歸一化到 100）：
  F1  RSI oversold intensity      — RSI 超賣強度（連續值，非 binary）
  F2  Bollinger deviation         — 收盤偏離 BB 下軌幅度（含 neutral zone 基礎分）
  F3  GARCH vol regime            — vol 是否收縮（compressing = 反彈更有利）
  F4  Fear & Greed zone           — 當前 F&G zone 的歷史平均回報
  F5  Month seasonality bias      — 當月的歷史月報酬偏向
  F6  Regime favorability         — 當前 regime 下信號有效性歷史加成
  F7  Volume surge                — 成交量相對 20d 均值，放量下跌後反彈概率更高
  F8  Price momentum              — 5d vs 20d 動量，負動量 = 超賣壓力釋放訊號

設計原則：
  - F1/F2 在 neutral zone (RSI≈50, BB≈0) 給予 0.35–0.40 基礎分（非超賣市場仍有基礎質量）
  - F7/F8 捕捉超賣信號以外的市場結構信息
  - 歷史校準（calibrated win rate by score bucket）列為 v2 待辦

輸出 data/multifactor_results.csv
Schema:
  symbol, factor, raw_value, normalized_score, weight, weighted_score, description
  +  one "__total__" row per symbol with final score
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "multifactor_results.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

# Factor weights (sum = 1.0)
# F12 新增，總和維持 1.0
WEIGHTS = {
    "rsi_intensity":       0.16,
    "bollinger_deviation": 0.12,
    "garch_vol_regime":    0.09,
    "fear_greed_zone":     0.10,
    "month_seasonality":   0.10,
    "regime_favorability": 0.10,
    "volume_surge":        0.06,
    "price_momentum":      0.06,
    "funding_rate":        0.07,  # F9：期貨資金費率
    "ls_ratio":            0.06,  # F10：大戶多空比
    "active_addresses":    0.06,  # F11：BTC 鏈上活躍地址
    "turbulence_calm":     0.07,  # F12：市場異常指數（低 turbulence = 高分）
}


def sigmoid_norm(x: float, center: float, scale: float) -> float:
    """Normalize to [0,1] using sigmoid centred at `center`."""
    return float(1 / (1 + np.exp(-scale * (x - center))))


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def analyze_symbol(symbol: str) -> list[dict]:
    rows = []

    # ── Load price data ───────────────────────────────────────────────────────
    price_df = pd.read_csv(DATA_DIR / f"{symbol}.csv")
    price_df["date"] = pd.to_datetime(price_df["open_time"], unit="ms")
    price_df = price_df.sort_values("date").reset_index(drop=True)
    close    = price_df["close"].astype(float)
    vol      = price_df["volume"].astype(float)

    # RSI (Wilder EWM)
    delta = close.diff()
    gain  = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()
    loss  = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()
    rsi14 = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    current_rsi = float(rsi14.iloc[-1]) if not pd.isna(rsi14.iloc[-1]) else 50.0

    # Bollinger deviation
    sma20   = close.rolling(20).mean()
    std20   = close.rolling(20).std()
    bb_low  = sma20 - 2 * std20
    bb_dev  = (close - bb_low) / (std20 + 1e-9)  # negative = below lower band
    current_bb_dev = float(bb_dev.iloc[-1]) if not pd.isna(bb_dev.iloc[-1]) else 0.0

    # ── F1: RSI Oversold Intensity ────────────────────────────────────────────
    # 設計：RSI=20 → 1.0，RSI=50 → 0.40（neutral zone 基礎分），RSI=65+ → 0
    # 中性市場不應得 0，因為它代表「沒有反向訊號」，有一定基礎質量
    f1_raw  = current_rsi
    f1_norm = clamp01((65.0 - current_rsi) / 45.0)
    f1_desc = f"RSI-14 = {current_rsi:.1f}"

    # ── F2: Bollinger Deviation ───────────────────────────────────────────────
    # 設計：dev=-2（深度超賣）→ 1.0，dev=0（中性）→ 0.40，dev=+3 → 0
    # 中性帶有基礎分，因為「不在超買區」本身就是 neutral-to-positive 條件
    f2_raw  = current_bb_dev
    f2_norm = clamp01(0.40 - current_bb_dev * 0.20)
    f2_desc = f"BB deviation = {current_bb_dev:.2f}σ"

    # ── F3: GARCH Vol Regime ──────────────────────────────────────────────────
    # Score is HIGH when vol is COMPRESSING (favours rebound setups)
    # We use: if forecast_vol_h7 < forecast_vol_h1 → compressing → score high
    try:
        garch_df = pd.read_csv(DATA_DIR / "garch_results.csv")
        g_row = garch_df[garch_df["symbol"] == symbol].iloc[0]
        h1 = float(g_row["forecast_vol_h1"])
        h7 = float(g_row["forecast_vol_h7"])
        persistence = float(g_row["persistence"])
        # vol trajectory: negative = compressing, positive = expanding
        vol_slope = (h7 - h1) / h1  # pct change
        # compressing → high score; persistence > 0.97 = very sticky vol
        f3_raw  = vol_slope
        f3_norm = clamp01(0.5 - vol_slope * 2.0)   # slope -0.25 → 1.0, slope +0.25 → 0
        f3_desc = f"Vol trend = {'↓ compressing' if vol_slope < 0 else '↑ expanding'} ({vol_slope:+.1%}), persistence={persistence:.3f}"
    except Exception:
        f3_raw, f3_norm, f3_desc = 0.0, 0.5, "GARCH data unavailable"

    # ── F4: Fear & Greed Zone ─────────────────────────────────────────────────
    # Per-symbol: compare Extreme Fear zone win_rate vs overall baseline win_rate.
    # Does NOT assume contrarian universally — each symbol tells its own story.
    # Score high if EF win_rate > baseline (fear IS a setup for this symbol).
    # Score low if EF win_rate < baseline (fear is not helpful / even harmful).
    try:
        fg_df = pd.read_csv(DATA_DIR / "fear_greed_results.csv")
        fg_row = fg_df[
            (fg_df["symbol"] == symbol) &
            (fg_df["threshold"] == -0.03) &
            (fg_df["holding_days"] == 7)
        ]
        conf_df_fg = pd.read_csv(DATA_DIR / "confluence_results.csv")
        baseline_all = conf_df_fg[
            (conf_df_fg["symbol"] == symbol) &
            (conf_df_fg["signals"] == "baseline") &
            (conf_df_fg["holding_days"] == 7) &
            (conf_df_fg["regime"] == "all")
        ]
        all_baseline_wr = float(baseline_all["win_rate"].iloc[0]) if len(baseline_all) > 0 else 0.5

        if len(fg_row) > 0:
            fg_row = fg_row.iloc[0]
            ef_wr   = float(fg_row["ef_win_rate"]) if pd.notna(fg_row["ef_win_rate"]) else all_baseline_wr
            ef_mean = float(fg_row["ef_mean"])     if pd.notna(fg_row["ef_mean"])     else 0.0
            eg_mean = float(fg_row["eg_mean"])     if pd.notna(fg_row["eg_mean"])     else 0.0
            ef_n    = int(fg_row["ef_n"])           if pd.notna(fg_row["ef_n"])        else 0

            # Edge = EF win_rate minus unconditional baseline
            edge = ef_wr - all_baseline_wr
            # Weight by sample size (ef_n) — cap at n=80 for confidence
            n_weight_fg = clamp01(ef_n / 80.0)
            f4_raw  = edge
            f4_norm = clamp01(n_weight_fg * (0.5 + edge * 3.0))
            f4_desc = f"F&G: EF wr={ef_wr:.0%} vs baseline {all_baseline_wr:.0%} (edge={edge:+.0%}), EF mean={ef_mean:+.1%}, n={ef_n}"
        else:
            f4_raw, f4_norm, f4_desc = 0.0, 0.5, "F&G data unavailable"
    except Exception as e:
        f4_raw, f4_norm, f4_desc = 0.0, 0.5, f"F&G data unavailable ({e})"

    # ── F5: Month Seasonality Bias ────────────────────────────────────────────
    current_month = datetime.now().month
    try:
        ms_df = pd.read_csv(DATA_DIR / "month_seasonality_results.csv")
        ms_row = ms_df[
            (ms_df["symbol"] == symbol) &
            (ms_df["month"] == current_month)
        ]
        if len(ms_row) > 0:
            ms_row   = ms_row.iloc[0]
            med_ret  = float(ms_row["median_return"]) if pd.notna(ms_row["median_return"]) else 0.0
            win_rate = float(ms_row["win_rate"])      if pd.notna(ms_row["win_rate"])      else 0.5
            n        = int(ms_row["sample_size"])     if pd.notna(ms_row["sample_size"])   else 0
            # n_weight: steep penalty for small samples
            # n=9 → 1.0, n=7 → 0.7, n=5 → 0.3, n<5 → 0.1
            if n >= 9:
                n_weight = 1.0
            elif n >= 7:
                n_weight = 0.7
            elif n >= 5:
                n_weight = 0.3
            else:
                n_weight = 0.1
            # score: combine median return direction + win rate advantage
            f5_raw  = med_ret
            f5_norm = clamp01(n_weight * (0.5 + med_ret * 2.0 + (win_rate - 0.5)))
            f5_desc = f"Month {current_month}: median={med_ret:+.1%}, wr={win_rate:.0%}, n={n}"
        else:
            f5_raw, f5_norm, f5_desc = 0.0, 0.5, f"No seasonality data for month {current_month}"
    except Exception:
        f5_raw, f5_norm, f5_desc = 0.0, 0.5, "Seasonality data unavailable"

    # ── F6: Regime Favorability ───────────────────────────────────────────────
    # In current regime, what is the historical win rate of ANY signal vs baseline?
    try:
        conf_df = pd.read_csv(DATA_DIR / "confluence_results.csv")
        regime_df = pd.read_csv(DATA_DIR / "regime_results.csv")
        current_regime = regime_df[regime_df["symbol"] == symbol]["regime"].iloc[-1]

        # Baseline 7d win rate in current regime
        base = conf_df[
            (conf_df["symbol"] == symbol) &
            (conf_df["signals"] == "baseline") &
            (conf_df["holding_days"] == 7) &
            (conf_df["regime"] == current_regime)
        ]
        base_wr = float(base["win_rate"].iloc[0]) if len(base) > 0 and pd.notna(base["win_rate"].iloc[0]) else 0.5

        # Any single signal win rate in current regime
        single_sigs = conf_df[
            (conf_df["symbol"] == symbol) &
            (conf_df["n_signals"] == 1) &
            (conf_df["holding_days"] == 7) &
            (conf_df["regime"] == current_regime) &
            (conf_df["n"] >= 5)
        ]
        avg_sig_wr = float(single_sigs["win_rate"].mean()) if len(single_sigs) > 0 else base_wr

        # Edge = signal win rate - baseline; regime is favorable if edge > 0
        edge   = avg_sig_wr - base_wr
        f6_raw  = edge
        f6_norm = clamp01(0.5 + edge * 3.0)
        f6_desc = f"Regime={current_regime}: baseline wr={base_wr:.0%}, avg signal edge={edge:+.1%}"
    except Exception:
        f6_raw, f6_norm, f6_desc = 0.0, 0.5, "Regime data unavailable"
        current_regime = "unknown"

    # ── F7: Volume Surge ──────────────────────────────────────────────────────
    # 成交量相對 20d 均值的比值。
    # 邏輯：放量（vol > 1.5x mean）下跌後，空頭力竭，反彈概率更高。
    # 與價格方向結合：近 3 天是下跌 + 放量 → 更高分（恐慌拋售訊號）
    vol_ma20   = vol.rolling(20).mean()
    vol_ratio  = float((vol / vol_ma20).iloc[-1]) if not pd.isna(vol_ma20.iloc[-1]) else 1.0
    price_3d   = float((close.iloc[-1] - close.iloc[-4]) / close.iloc[-4]) if len(close) >= 4 else 0.0
    # 放量下跌 → 高分；縮量橫盤 → 中性；放量上漲 → 低分
    if price_3d < -0.02 and vol_ratio > 1.3:
        f7_norm = clamp01(0.5 + (vol_ratio - 1.0) * 0.3 + abs(price_3d) * 2.0)
    elif price_3d > 0.03 and vol_ratio > 1.5:
        f7_norm = clamp01(0.5 - (vol_ratio - 1.0) * 0.2)
    else:
        f7_norm = clamp01(0.35 + (1.5 - vol_ratio) * 0.1)  # 縮量 → 略高基礎分
    f7_raw  = vol_ratio
    f7_desc = f"Vol ratio = {vol_ratio:.2f}x 20d avg, 3d price = {price_3d:+.1%}"

    # ── F8: Price Momentum ────────────────────────────────────────────────────
    # 5d vs 20d 動量對比，負動量代表短期超賣壓力累積，有均值回歸潛力。
    # 設計：-10%（強烈負動量）→ 1.0，0%（持平）→ 0.45，+10%（強勢上漲）→ 0
    mom_5d  = float((close.iloc[-1] - close.iloc[-6])  / close.iloc[-6])  if len(close) >= 6  else 0.0
    mom_20d = float((close.iloc[-1] - close.iloc[-21]) / close.iloc[-21]) if len(close) >= 21 else 0.0
    # relative momentum: 短期比長期弱 = 更多超賣壓力
    rel_mom = mom_5d - mom_20d
    f8_raw  = rel_mom
    f8_norm = clamp01(0.45 - rel_mom * 2.5)  # rel_mom=-0.10 → 0.70, rel_mom=+0.10 → 0.20
    f8_desc = f"5d mom = {mom_5d:+.1%}, 20d mom = {mom_20d:+.1%}, rel = {rel_mom:+.1%}"

    # ── F9: Funding Rate ──────────────────────────────────────────────────────
    # 讀取 futures_sentiment_results.csv（由 analyze_futures_sentiment.py 產生）
    try:
        fs_df = pd.read_csv(DATA_DIR / "futures_sentiment_results.csv")
        fs_row = fs_df[fs_df["symbol"] == symbol]
        if len(fs_row) > 0:
            fs_row  = fs_row.iloc[0]
            f9_norm = float(fs_row["f9_norm"]) if pd.notna(fs_row["f9_norm"]) else 0.5
            fr_val  = float(fs_row["funding_rate_7d_avg"]) if pd.notna(fs_row["funding_rate_7d_avg"]) else 0.0
            neg_pct = float(fs_row["funding_rate_neg_pct"]) if pd.notna(fs_row["funding_rate_neg_pct"]) else 0.0
            f9_raw  = fr_val
            f9_desc = f"7d avg funding={fr_val:.5f}, neg_pct={neg_pct:.0%}, f9={f9_norm:.3f}"
        else:
            f9_raw, f9_norm, f9_desc = 0.0, 0.5, "Futures data unavailable"
    except Exception:
        f9_raw, f9_norm, f9_desc = 0.0, 0.5, "Futures data unavailable"

    # ── F10: Long/Short Ratio ─────────────────────────────────────────────────
    try:
        fs_df = pd.read_csv(DATA_DIR / "futures_sentiment_results.csv")
        fs_row = fs_df[fs_df["symbol"] == symbol]
        if len(fs_row) > 0:
            fs_row   = fs_row.iloc[0]
            f10_norm = float(fs_row["f10_norm"]) if pd.notna(fs_row["f10_norm"]) else 0.5
            ls_ratio = float(fs_row["ls_ratio_latest"]) if pd.notna(fs_row["ls_ratio_latest"]) else 1.0
            short_pct = float(fs_row["ls_short_pct"]) if pd.notna(fs_row["ls_short_pct"]) else 0.35
            f10_raw  = ls_ratio
            f10_desc = f"L/S ratio={ls_ratio:.3f}, short_pct={short_pct:.0%}, f10={f10_norm:.3f}"
        else:
            f10_raw, f10_norm, f10_desc = 0.0, 0.5, "L/S data unavailable"
    except Exception:
        f10_raw, f10_norm, f10_desc = 0.0, 0.5, "L/S data unavailable"

    # ── F11: Active Addresses（BTC only）─────────────────────────────────────
    try:
        if symbol == "BTCUSDT":
            aa_df  = pd.read_csv(DATA_DIR / "active_addresses_history.csv", parse_dates=["date"])
            latest = aa_df.iloc[-1]
            addr   = float(latest["addr_count"])
            ma30   = float(latest["ma30"])
            ratio  = float(latest["ratio"])
            f11_norm = float(latest["f11_norm"])
            f11_raw  = addr
            f11_desc = f"addr={addr:.0f}, ma30={ma30:.0f}, ratio={ratio:.3f}, f11={f11_norm:.3f}"
        else:
            # ETH/SOL：無免費歷史鏈上數據，中性分
            f11_raw, f11_norm, f11_desc = 0.0, 0.5, "On-chain data BTC only (N/A)"
    except Exception:
        f11_raw, f11_norm, f11_desc = 0.0, 0.5, "Active address data unavailable"

    # ── F12: Turbulence Index（市場異常指數）────────────────────────────────
    try:
        turb_df = pd.read_csv(DATA_DIR / "turbulence_history.csv")
        latest_turb = turb_df.iloc[-1]
        turb_norm = float(latest_turb["turbulence_norm"])
        turb_level = str(latest_turb["turbulence_level"])
        # 低 turbulence = 市場平靜 = 信號更可靠 = 高分
        # turbulence_norm 越高越異常，所以取反
        f12_raw  = turb_norm
        f12_norm = round(1.0 - turb_norm, 4)   # calm = 1.0, extreme = 0.0
        f12_desc = f"turbulence_norm={turb_norm:.3f}, level={turb_level}, f12={f12_norm:.3f}"
    except Exception:
        f12_raw, f12_norm, f12_desc = 0.0, 0.5, "Turbulence data unavailable"

    # ── Assemble factor rows ──────────────────────────────────────────────────
    factors = [
        ("rsi_intensity",       f1_raw,  f1_norm,  f1_desc),
        ("bollinger_deviation", f2_raw,  f2_norm,  f2_desc),
        ("garch_vol_regime",    f3_raw,  f3_norm,  f3_desc),
        ("fear_greed_zone",     f4_raw,  f4_norm,  f4_desc),
        ("month_seasonality",   f5_raw,  f5_norm,  f5_desc),
        ("regime_favorability", f6_raw,  f6_norm,  f6_desc),
        ("volume_surge",        f7_raw,  f7_norm,  f7_desc),
        ("price_momentum",      f8_raw,  f8_norm,  f8_desc),
        ("funding_rate",        f9_raw,  f9_norm,  f9_desc),
        ("ls_ratio",            f10_raw, f10_norm, f10_desc),
        ("active_addresses",    f11_raw, f11_norm, f11_desc),
        ("turbulence_calm",      f12_raw, f12_norm, f12_desc),
    ]

    total_weighted = 0.0
    for factor, raw, norm, desc in factors:
        w  = WEIGHTS[factor]
        ws = norm * w
        total_weighted += ws
        rows.append({
            "symbol":           symbol,
            "factor":           factor,
            "raw_value":        round(raw, 6),
            "normalized_score": round(norm, 4),
            "weight":           w,
            "weighted_score":   round(ws, 4),
            "description":      desc,
        })

    # Total score row (0–100)
    final_score = round(total_weighted * 100, 1)
    rows.append({
        "symbol":           symbol,
        "factor":           "__total__",
        "raw_value":        final_score,
        "normalized_score": round(total_weighted, 4),
        "weight":           1.0,
        "weighted_score":   round(total_weighted, 4),
        "description":      f"regime={current_regime}",
    })

    return rows


def main():
    all_rows = []
    for symbol in SYMBOLS:
        print(f"  {symbol}...")
        all_rows.extend(analyze_symbol(symbol))

    df_out = pd.DataFrame(all_rows)
    df_out.to_csv(OUT_PATH, index=False)
    print(f"\n✅  multifactor_results: {len(df_out)} rows → {OUT_PATH}")

    # Print score summary
    for sym in SYMBOLS:
        total = df_out[(df_out["symbol"] == sym) & (df_out["factor"] == "__total__")]
        if len(total) > 0:
            print(f"  {sym}: Setup Score = {total['raw_value'].iloc[0]:.1f}/100  ({total['description'].iloc[0]})")


if __name__ == "__main__":
    main()
