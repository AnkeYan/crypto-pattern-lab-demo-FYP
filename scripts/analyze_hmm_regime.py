"""
analyze_hmm_regime.py  v1
HMM（隱馬爾可夫模型）市場 Regime 識別

取代 analyze_signals.py 的規則版 SMA Regime，
輸出相同格式的 regime_results.csv，讓後續腳本無縫使用 HMM 結果。

模型設計：
  - 輸入特徵：7日滾動回報率、21日滾動波動率（兩個觀測值）
  - 狀態數：3（對應 Bull / Bear / Sideways）
  - 模型：GaussianHMM（每個隱藏狀態有自己的回報率均值和波動率均值）
  - 狀態標籤：訓練完後按「回報率均值」自動排序
    最高回報率均值 → Bull
    最低回報率均值 → Bear
    中間 → Sideways

設計原則：
  - 每個幣種獨立訓練模型（BTC/ETH/SOL 市場結構不同）
  - 用完整歷史數據訓練（不做 rolling，regime 是長期結構）
  - 輸出與規則版格式完全相同，downstream 腳本零改動

輸出：
  data/regime_results.csv  ← 覆蓋原有規則版輸出，格式相同
"""

from __future__ import annotations

import warnings
warnings.filterwarnings("ignore")
import logging
logging.getLogger("hmmlearn").setLevel(logging.ERROR)

import pandas as pd
import numpy as np
from pathlib import Path
from hmmlearn.hmm import GaussianHMM

DATA_DIR   = Path(__file__).parent.parent / "data"
REGIME_OUT = DATA_DIR / "regime_results.csv"

SYMBOLS    = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
N_STATES    = 3       # Bull / Bear / Sideways
N_ITER      = 500     # EM 迭代次數
N_RESTARTS  = 10      # 多次隨機初始化，取 log-likelihood 最高的結果
RANDOM_SEED = 42

# 滾動窗口
RETURN_WINDOW = 7    # 7日回報率
VOL_WINDOW    = 21   # 21日波動率


def fit_hmm(symbol: str) -> pd.DataFrame:
    """
    對單一幣種訓練 GaussianHMM，輸出逐日 regime 標籤。
    """
    price_df = pd.read_csv(DATA_DIR / f"{symbol}.csv")
    price_df["date"] = pd.to_datetime(price_df["open_time"], unit="ms")
    price_df = price_df.sort_values("date").reset_index(drop=True)
    close = price_df["close"].astype(float)
    dates = price_df["date"]

    # ── 計算觀測特徵 ──────────────────────────────────────────────────────────
    daily_ret = close.pct_change()
    ret7      = close.pct_change(RETURN_WINDOW)           # 7日回報率
    vol21     = daily_ret.rolling(VOL_WINDOW).std()        # 21日波動率
    ret7_abs  = ret7.abs()                                 # 7日回報率絕對值（區分 Sideways vs Bear）

    # 組合特徵矩陣，去除 NaN 行
    feat_df = pd.DataFrame({
        "date":    dates,
        "ret7":    ret7,
        "vol21":   vol21,
        "ret7_abs": ret7_abs,
    }).dropna().reset_index(drop=True)

    X = feat_df[["ret7", "vol21", "ret7_abs"]].values

    # ── 訓練 HMM（多次隨機初始化，取最佳）────────────────────────────────────
    best_model  = None
    best_score  = -np.inf
    for restart in range(N_RESTARTS):
        m = GaussianHMM(
            n_components=N_STATES,
            covariance_type="full",
            n_iter=N_ITER,
            random_state=RANDOM_SEED + restart,
            verbose=False,
        )
        try:
            m.fit(X)
            score = m.score(X)
            if score > best_score:
                best_score  = score
                best_model  = m
        except Exception:
            continue

    if best_model is None:
        raise RuntimeError(f"HMM failed to converge for {symbol}")

    model = best_model

    # ── 解碼：取每天最可能的隱藏狀態 ─────────────────────────────────────────
    raw_states = model.predict(X)

    # ── 狀態標籤：按「7日回報率均值」排序 ─────────────────────────────────
    # 計算每個狀態的平均 7 日回報率和波動率
    state_ret  = {}
    state_vol  = {}
    for s in range(N_STATES):
        mask = raw_states == s
        state_ret[s] = float(feat_df["ret7"][mask].mean())  if mask.any() else 0.0
        state_vol[s] = float(feat_df["vol21"][mask].mean()) if mask.any() else 0.0

    # 排序：回報率最高 → Bull，最低 → Bear，中間 → Sideways
    sorted_states = sorted(state_ret.keys(), key=lambda s: state_ret[s], reverse=True)
    label_map = {
        sorted_states[0]: "bull",
        sorted_states[1]: "sideways",
        sorted_states[2]: "bear",
    }
    regime_labels = [label_map[s] for s in raw_states]

    feat_df["regime"]    = regime_labels
    feat_df["raw_state"] = raw_states

    # ── 印出診斷信息 ──────────────────────────────────────────────────────────
    print(f"  {symbol} HMM states:")
    for s in sorted_states:
        lbl   = label_map[s]
        mask  = raw_states == s
        n     = mask.sum()
        r_avg = state_ret[s]
        v_avg = state_vol[s]
        pct   = n / len(raw_states)
        print(f"    State {s} → {lbl:<9} n={n:>4} ({pct:.0%})  "
              f"avg_ret7={r_avg:+.3f}  avg_vol21={v_avg:.4f}")

    # ── 輸出格式與規則版相同 ──────────────────────────────────────────────────
    out_rows = []
    for i, row in feat_df.iterrows():
        out_rows.append({
            "symbol": symbol,
            "date":   row["date"].strftime("%Y-%m-%d"),
            "regime": row["regime"],
        })

    return pd.DataFrame(out_rows)


def main():
    print("Fitting HMM Regime models...")
    all_frames = []

    for symbol in SYMBOLS:
        print(f"\n  {symbol}...")
        try:
            df = fit_hmm(symbol)
            all_frames.append(df)
            bull_pct = (df["regime"] == "bull").mean()
            bear_pct = (df["regime"] == "bear").mean()
            side_pct = (df["regime"] == "sideways").mean()
            latest   = df.iloc[-1]
            print(f"    → {len(df)} days | Bull={bull_pct:.0%} Bear={bear_pct:.0%} Sideways={side_pct:.0%}")
            print(f"    → Current regime: {latest['regime']} (as of {latest['date']})")
        except Exception as e:
            print(f"    ⚠️  {symbol} failed: {e}")

    if not all_frames:
        print("❌  No data processed")
        return

    # ── 與現有 regime_results.csv 合併（保留現有格式其他欄位）──────────────
    # 讀現有檔案，移除 HMM 會更新的欄位，保留其他欄位（如 rsi14 等）
    existing_path = DATA_DIR / "regime_results.csv"
    if existing_path.exists():
        existing = pd.read_csv(existing_path)
        # 只保留非 regime 欄位（避免衝突）
        non_regime_cols = [c for c in existing.columns if c not in ["regime"]]
        existing_base = existing[non_regime_cols].copy()

        hmm_combined = pd.concat(all_frames, ignore_index=True)

        # merge HMM regime 進現有數據
        merged = existing_base.merge(
            hmm_combined[["symbol", "date", "regime"]],
            on=["symbol", "date"],
            how="left",
        )
        # 對 HMM 覆蓋不到的早期行（如 sma200 之前），用原來的 regime 填補
        if "regime" in existing.columns:
            orig_regime = existing.set_index(["symbol", "date"])["regime"]
            for idx, row in merged.iterrows():
                if pd.isna(merged.at[idx, "regime"]):
                    key = (row["symbol"], row["date"])
                    if key in orig_regime.index:
                        merged.at[idx, "regime"] = orig_regime[key]
            merged["regime"] = merged["regime"].fillna("sideways")

        merged.to_csv(REGIME_OUT, index=False)
        print(f"\n✅  regime_results (HMM): {len(merged)} rows → {REGIME_OUT}")
    else:
        # 沒有現有檔案，直接輸出 HMM 結果
        result = pd.concat(all_frames, ignore_index=True)
        result.to_csv(REGIME_OUT, index=False)
        print(f"\n✅  regime_results (HMM): {len(result)} rows → {REGIME_OUT}")

    # ── 對比統計：HMM vs 規則版 ───────────────────────────────────────────────
    print("\n── Regime Distribution ──────────────────────────────────────────")
    result_df = pd.concat(all_frames, ignore_index=True)
    for sym in SYMBOLS:
        sym_df = result_df[result_df["symbol"] == sym]
        if len(sym_df) == 0:
            continue
        print(f"  {sym}: Bull={( sym_df['regime']=='bull').mean():.0%}  "
              f"Bear={(sym_df['regime']=='bear').mean():.0%}  "
              f"Sideways={(sym_df['regime']=='sideways').mean():.0%}  "
              f"(n={len(sym_df)})")


if __name__ == "__main__":
    main()
