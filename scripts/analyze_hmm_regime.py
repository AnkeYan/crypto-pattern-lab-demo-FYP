"""
analyze_hmm_regime.py  v2
HMM（隱馬爾可夫模型）市場 Regime 識別 + 後驗概率輸出

取代 analyze_signals.py 的規則版 SMA Regime。

模型設計：
  - 輸入特徵：7日滾動回報率、21日滾動波動率、7日回報率絕對值
  - 狀態數：3（Bull / Sideways / Bear）
  - 模型：GaussianHMM，10次隨機初始化取最佳
  - 狀態標籤：按回報率均值自動排序

輸出：
  data/regime_results.csv   ← 逐日 regime 標籤（格式與規則版相同）
  data/hmm_posterior.csv    ← 逐日後驗概率（bull_prob / side_prob / bear_prob）
                               供 XGBoost 用作連續特徵 f6_cont
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

DATA_DIR      = Path(__file__).parent.parent / "data"
REGIME_OUT    = DATA_DIR / "regime_results.csv"
POSTERIOR_OUT = DATA_DIR / "hmm_posterior.csv"

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

    # ── 解碼：最可能狀態 + 後驗概率 ──────────────────────────────────────────
    raw_states = model.predict(X)
    posteriors = model.predict_proba(X)   # shape: (n_days, N_STATES)

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

    # 後驗概率：對應到 bull/sideways/bear 標籤
    # label_map = {raw_state_id: "bull"/"sideways"/"bear"}
    # 需要反查：bull 對應哪個 raw_state_id
    bull_state = sorted_states[0]
    side_state = sorted_states[1]
    bear_state = sorted_states[2]

    feat_df["bull_prob"] = posteriors[:, bull_state].round(4)
    feat_df["side_prob"] = posteriors[:, side_state].round(4)
    feat_df["bear_prob"] = posteriors[:, bear_state].round(4)

    # f6_cont：Bull 概率直接作為連續特徵（Bull 越高 = 市場環境越好）
    feat_df["f6_cont"] = feat_df["bull_prob"]

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

    # ── 輸出：regime 標籤（格式與規則版相同）─────────────────────────────────
    regime_df = feat_df[["date", "regime"]].copy()
    regime_df.insert(0, "symbol", symbol)
    regime_df["date"] = regime_df["date"].dt.strftime("%Y-%m-%d")

    # ── 輸出：後驗概率（XGBoost 用）──────────────────────────────────────────
    posterior_df = feat_df[["date", "bull_prob", "side_prob", "bear_prob", "f6_cont"]].copy()
    posterior_df.insert(0, "symbol", symbol)
    posterior_df["date"] = posterior_df["date"].dt.strftime("%Y-%m-%d")

    return regime_df, posterior_df


def main():
    print("Fitting HMM Regime models...")
    all_regime_frames    = []
    all_posterior_frames = []

    for symbol in SYMBOLS:
        print(f"\n  {symbol}...")
        try:
            regime_df, posterior_df = fit_hmm(symbol)
            all_regime_frames.append(regime_df)
            all_posterior_frames.append(posterior_df)
            bull_pct = (regime_df["regime"] == "bull").mean()
            bear_pct = (regime_df["regime"] == "bear").mean()
            side_pct = (regime_df["regime"] == "sideways").mean()
            latest   = regime_df.iloc[-1]
            print(f"    → {len(regime_df)} days | Bull={bull_pct:.0%} Bear={bear_pct:.0%} Sideways={side_pct:.0%}")
            print(f"    → Current regime: {latest['regime']} (as of {latest['date']})")
            # 印出當前後驗概率
            last_post = posterior_df.iloc[-1]
            print(f"    → Posteriors: bull={last_post['bull_prob']:.2f} "
                  f"side={last_post['side_prob']:.2f} bear={last_post['bear_prob']:.2f} "
                  f"(f6_cont={last_post['f6_cont']:.2f})")
        except Exception as e:
            print(f"    ⚠️  {symbol} failed: {e}")

    if not all_regime_frames:
        print("❌  No data processed")
        return

    # ── 儲存 regime_results.csv（與規則版格式相同）────────────────────────────
    existing_path = DATA_DIR / "regime_results.csv"
    hmm_combined  = pd.concat(all_regime_frames, ignore_index=True)
    if existing_path.exists():
        existing        = pd.read_csv(existing_path)
        non_regime_cols = [c for c in existing.columns if c not in ["regime"]]
        existing_base   = existing[non_regime_cols].copy()
        merged = existing_base.merge(
            hmm_combined[["symbol", "date", "regime"]],
            on=["symbol", "date"], how="left",
        )
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
        hmm_combined.to_csv(REGIME_OUT, index=False)
        print(f"\n✅  regime_results (HMM): {len(hmm_combined)} rows → {REGIME_OUT}")

    # ── 儲存 hmm_posterior.csv（XGBoost 用）──────────────────────────────────
    posterior_combined = pd.concat(all_posterior_frames, ignore_index=True)
    posterior_combined.to_csv(POSTERIOR_OUT, index=False)
    print(f"✅  hmm_posterior: {len(posterior_combined)} rows → {POSTERIOR_OUT}")

    # ── 分布統計 ──────────────────────────────────────────────────────────────
    print("\n── Regime Distribution ──────────────────────────────────────────")
    for sym in SYMBOLS:
        sym_df = hmm_combined[hmm_combined["symbol"] == sym]
        if len(sym_df) == 0:
            continue
        print(f"  {sym}: Bull={(sym_df['regime']=='bull').mean():.0%}  "
              f"Bear={(sym_df['regime']=='bear').mean():.0%}  "
              f"Sideways={(sym_df['regime']=='sideways').mean():.0%}  "
              f"(n={len(sym_df)})")


if __name__ == "__main__":
    main()
