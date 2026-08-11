"""
analyze_xgboost.py  v2
XGBoost 因子重要性 + Purged Walk-Forward 驗證 + Rolling Window

從 multifactor_calibration.csv 讀取逐日因子數據，
用 XGBoost 二元分類（win=1/0）做 walk-forward 回測，
輸出：
  1. xgb_results.csv    — 每個 fold 的 AUC / accuracy + 因子重要性排名
  2. xgb_predictions.csv — 最終模型對三幣種「當前設置」的預測概率

改進（v2）：
  A. Purged Cross-Validation
     train/test 邊界加 EMBARGO_DAYS=7 天禁區，
     防止 7d outcome 重疊導致的輕微數據洩漏。

  C. Rolling Window 重訓
     最終預測模型只用最近 ROLLING_YEARS=2 年訓練，
     避免遠古數據（2016–2018）干擾對現代市場的預測。
     Walk-forward fold 仍用 expanding window（保留歷史對比）。

重要說明：
  F3（GARCH）/ F4（Fear & Greed）校準版固定 0，XGBoost 自然發現無預測力
  Walk-Forward 防止 look-ahead bias（未來數據洩漏）
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta
import warnings
warnings.filterwarnings("ignore")

from xgboost import XGBClassifier
from sklearn.metrics import roc_auc_score, accuracy_score

DATA_DIR        = Path(__file__).parent.parent / "data"
OUT_RESULTS     = DATA_DIR / "xgb_results.csv"
OUT_PREDICTIONS = DATA_DIR / "xgb_predictions.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

FEATURES = [
    "f1_norm", "f2_norm", "f3_norm", "f4_norm",
    "f5_norm", "f6_norm", "f7_norm", "f8_norm",
    "f9_norm", "f10_norm", "f11_norm", "f12_norm",
]

FEATURE_NAMES = {
    "f1_norm":  "RSI Oversold Intensity",
    "f2_norm":  "Bollinger Deviation",
    "f3_norm":  "GARCH Vol Regime",
    "f4_norm":  "Fear & Greed Zone",
    "f5_norm":  "Month Seasonality",
    "f6_norm":  "Regime Favorability",
    "f7_norm":  "Volume Surge",
    "f8_norm":  "Price Momentum",
    "f9_norm":  "Funding Rate Sentiment",
    "f10_norm": "Long/Short Ratio",
    "f11_norm": "Active Addresses (BTC)",
    "f12_norm": "Turbulence Calm",
}

# Purged CV：train/test 邊界的禁區天數（= outcome 窗口長度）
EMBARGO_DAYS = 7

# Rolling Window：最終預測模型只用最近 N 年
ROLLING_YEARS = 2

# XGBoost 參數：保守設置，防 overfitting
XGB_PARAMS = dict(
    n_estimators=200,
    max_depth=3,           # 淺樹，防 overfitting
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=10,   # 每個葉子至少 10 個樣本
    reg_alpha=0.1,         # L1 正則化
    reg_lambda=1.0,        # L2 正則化
    eval_metric="auc",
    random_state=42,
    use_label_encoder=False,
    verbosity=0,
)


def purged_walk_forward_cv(df: pd.DataFrame, symbol: str) -> tuple[list[dict], object, pd.DataFrame]:
    """
    Purged Walk-Forward Cross-Validation（expanding window + embargo）

    設計：
      - 每年為一個 test fold
      - train = 該年之前所有數據，但移除最後 EMBARGO_DAYS 天（禁區）
      - embargo 防止 7d outcome 在 train/test 邊界造成洩漏
      - 至少需要 365 天訓練數據才開始第一個 fold
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    years          = sorted(df["date"].dt.year.unique())
    min_train_days = 365
    fold_results   = []

    print(f"\n  {symbol} — Purged Walk-Forward CV (embargo={EMBARGO_DAYS}d)")
    print(f"  {'Fold':<6} {'Train (purged)':<26} {'Test':<10} {'n_train':>8} {'n_test':>7} {'AUC':>7} {'Acc':>7}")
    print(f"  {'-'*75}")

    for test_year in years:
        raw_train = df[df["date"].dt.year < test_year]
        test_df   = df[df["date"].dt.year == test_year]

        if len(raw_train) < min_train_days or len(test_df) < 30:
            continue

        # ── Purge：移除 train 末尾 EMBARGO_DAYS 天 ────────────────────────
        test_start  = test_df["date"].min()
        embargo_end = test_start - timedelta(days=1)
        embargo_start = embargo_end - timedelta(days=EMBARGO_DAYS - 1)
        train_df = raw_train[raw_train["date"] < embargo_start]

        if len(train_df) < min_train_days:
            continue

        X_train = train_df[FEATURES].values
        y_train = train_df["win"].values
        X_test  = test_df[FEATURES].values
        y_test  = test_df["win"].values

        if len(np.unique(y_train)) < 2 or len(np.unique(y_test)) < 2:
            continue

        model = XGBClassifier(**XGB_PARAMS)
        model.fit(X_train, y_train)

        y_prob = model.predict_proba(X_test)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)

        auc = roc_auc_score(y_test, y_prob)
        acc = accuracy_score(y_test, y_pred)

        train_start = train_df["date"].min().strftime("%Y-%m-%d")
        train_end   = train_df["date"].max().strftime("%Y-%m-%d")

        print(f"  {test_year:<6} {train_start}–{train_end}  {test_year}   "
              f"{len(train_df):>8} {len(test_df):>7} {auc:>7.3f} {acc:>7.1%}")

        fold_results.append({
            "symbol":      symbol,
            "test_year":   test_year,
            "n_train":     len(train_df),
            "n_test":      len(test_df),
            "auc":         round(auc, 4),
            "accuracy":    round(acc, 4),
            "train_start": train_start,
            "train_end":   train_end,
            "cv_method":   f"purged_expanding (embargo={EMBARGO_DAYS}d)",
        })

    # ── Final model（Rolling Window）：只用最近 ROLLING_YEARS 年 ──────────
    cutoff  = df["date"].max() - pd.DateOffset(years=ROLLING_YEARS)
    roll_df = df[df["date"] >= cutoff]

    # fallback：若 rolling 數據不足，用全部
    if len(roll_df) < 365:
        roll_df = df

    X_roll = roll_df[FEATURES].values
    y_roll = roll_df["win"].values
    final_model = XGBClassifier(**XGB_PARAMS)
    final_model.fit(X_roll, y_roll)

    print(f"\n  Final model: Rolling {ROLLING_YEARS}y "
          f"({roll_df['date'].min().strftime('%Y-%m-%d')} → {roll_df['date'].max().strftime('%Y-%m-%d')}, "
          f"n={len(roll_df)})")

    # ── Feature importance（全歷史模型，更穩定）────────────────────────────
    X_all = df[FEATURES].values
    y_all = df["win"].values
    full_model = XGBClassifier(**XGB_PARAMS)
    full_model.fit(X_all, y_all)

    importance = full_model.feature_importances_
    fi_df = pd.DataFrame({
        "symbol":       symbol,
        "feature":      FEATURES,
        "feature_name": [FEATURE_NAMES[f] for f in FEATURES],
        "importance":   [round(float(v), 4) for v in importance],
    }).sort_values("importance", ascending=False).reset_index(drop=True)
    fi_df["rank"] = fi_df.index + 1

    print(f"\n  Feature Importance ({symbol}, full history):")
    for _, row in fi_df.iterrows():
        bar = "█" * int(row["importance"] * 40)
        print(f"  #{int(row['rank'])} {row['feature_name']:<30} {row['importance']:.4f}  {bar}")

    return fold_results, final_model, fi_df


def predict_current(model: object, symbol: str, calib_df: pd.DataFrame) -> dict:
    """用 Rolling Window 最終模型預測最新一天的 XGBoost 勝率"""
    sym_df = calib_df[calib_df["symbol"] == symbol].sort_values("date")
    if len(sym_df) == 0:
        return {}
    latest = sym_df.iloc[-1]
    X      = np.array([[latest[f] for f in FEATURES]])
    prob   = float(model.predict_proba(X)[0, 1])
    return {
        "symbol":       symbol,
        "date":         latest["date"],
        "xgb_win_prob": round(prob, 4),
        "calib_score":  round(float(latest["score"]), 1),
        "model":        f"rolling_{ROLLING_YEARS}y_purged",
    }


def main():
    calib_path = DATA_DIR / "multifactor_calibration.csv"
    if not calib_path.exists():
        print("❌  multifactor_calibration.csv not found. Run analyze_multifactor_calibration.py first.")
        return

    calib_df = pd.read_csv(calib_path)
    print(f"Loaded calibration data: {len(calib_df)} rows")

    all_fold_results = []
    all_fi_rows      = []
    all_predictions  = []

    for symbol in SYMBOLS:
        sym_df = calib_df[calib_df["symbol"] == symbol].copy()
        if len(sym_df) < 400:
            print(f"  ⚠️  {symbol}: not enough data ({len(sym_df)} rows), skipping")
            continue

        fold_results, final_model, fi_df = purged_walk_forward_cv(sym_df, symbol)
        all_fold_results.extend(fold_results)
        all_fi_rows.append(fi_df)

        pred = predict_current(final_model, symbol, calib_df)
        if pred:
            all_predictions.append(pred)

    # ── Save ─────────────────────────────────────────────────────────────────
    fold_df     = pd.DataFrame(all_fold_results)
    fi_combined = pd.concat(all_fi_rows, ignore_index=True) if all_fi_rows else pd.DataFrame()

    fold_df["row_type"] = "fold"
    if len(fi_combined) > 0:
        fi_combined["row_type"] = "importance"
        results_df = pd.concat([fold_df, fi_combined], ignore_index=True)
    else:
        results_df = fold_df

    results_df.to_csv(OUT_RESULTS, index=False)
    print(f"\n✅  xgb_results: {len(results_df)} rows → {OUT_RESULTS}")

    pred_df = pd.DataFrame(all_predictions)
    pred_df.to_csv(OUT_PREDICTIONS, index=False)
    print(f"✅  xgb_predictions: {len(pred_df)} rows → {OUT_PREDICTIONS}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n── Walk-Forward Summary (Purged + Rolling) ─────────────────────")
    for sym in SYMBOLS:
        sym_folds = fold_df[fold_df["symbol"] == sym] if len(fold_df) > 0 else pd.DataFrame()
        if len(sym_folds) == 0:
            continue
        avg_auc    = sym_folds["auc"].mean()
        avg_acc    = sym_folds["accuracy"].mean()
        n_folds    = len(sym_folds)
        consistent = (sym_folds["auc"] > 0.52).sum()
        print(f"  {sym}: {n_folds} folds | avg AUC={avg_auc:.3f} | avg Acc={avg_acc:.1%} | AUC>0.52 in {consistent}/{n_folds} folds")

    print("\n── Current XGBoost Win Probability (Rolling {ROLLING_YEARS}y model) ──")
    for p in all_predictions:
        print(f"  {p['symbol']}: {p['xgb_win_prob']:.1%}  (calib_score={p['calib_score']}, as of {p['date']})")


if __name__ == "__main__":
    main()
