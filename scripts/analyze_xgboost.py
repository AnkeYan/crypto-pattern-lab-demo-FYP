"""
analyze_xgboost.py  v4
XGBoost 因子重要性 + Purged Walk-Forward 驗證 + Rolling Window
分類（勝率）+ 回歸（預期回報率）雙模型並行

從 multifactor_calibration.csv 讀取逐日因子數據，
同時訓練：
  - XGBClassifier：預測 7 天後漲跌概率（win=1/0）
  - XGBRegressor：預測 7 天後實際回報率（outcome_7d）

輸出：
  1. xgb_results.csv    — 每個 fold 的 AUC / RMSE + 因子重要性排名
  2. xgb_predictions.csv — 最終模型預測（勝率 + 預期回報率）

改進（v4）：
  - 新增 XGBRegressor 回歸模型，預測 outcome_7d
  - 回歸比分類更有決策價值：「預期 +3%」比「勝率 51%」更有意義
  - 兩個模型並行，互相驗證

改進（v3）：
  - 移除零重要性因子：f3/f4/f6/f10
  - 加入 F13 MVRV Valuation
  - 保留 9 個有效因子

改進（v2）：
  A. Purged Cross-Validation（embargo=7d）
  B. Rolling Window 重訓（ROLLING_YEARS=3）
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta
import warnings
warnings.filterwarnings("ignore")

from xgboost import XGBClassifier, XGBRegressor
from sklearn.metrics import roc_auc_score, accuracy_score, mean_squared_error

DATA_DIR        = Path(__file__).parent.parent / "data"
OUT_RESULTS     = DATA_DIR / "xgb_results.csv"
OUT_PREDICTIONS = DATA_DIR / "xgb_predictions.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

# 連續版特徵（XGBoost 用）+ Lag Features
# _cont 後綴 = 全域連續值（0–1），比觸發式稀疏版信息更豐富
# _lag7 / _lag14 = 7/14天前的值，讓模型學趨勢而不只是當前水平
FEATURES = [
    # 即時連續特徵
    "f1_cont", "f2_cont",
    "f5_cont", "f6_cont", "f7_cont", "f8_cont",
    "f9_cont", "f11_cont", "f12_cont", "f13_cont",
    "f14_cont",
    # Lag Features：7天前
    "f8_lag7", "f12_lag7", "f13_lag7", "f14_lag7",
    # Lag Features：14天前
    "f8_lag14", "f13_lag14",
]

FEATURE_NAMES = {
    "f1_cont":   "RSI (continuous)",
    "f2_cont":   "Bollinger Position",
    "f5_cont":   "Month Seasonality",
    "f6_cont":   "HMM Regime (Bull prob)",
    "f7_cont":   "Volume Direction",
    "f8_cont":   "Price Momentum",
    "f9_cont":   "Funding Rate",
    "f11_cont":  "Active Addresses",
    "f12_cont":  "Turbulence Calm",
    "f13_cont":  "MVRV Valuation",
    "f14_cont":  "FR Trend (7d diff)",
    "f8_lag7":   "Momentum 7d ago",
    "f12_lag7":  "Turbulence Calm 7d ago",
    "f13_lag7":  "MVRV 7d ago",
    "f14_lag7":  "FR Trend 7d ago",
    "f8_lag14":  "Momentum 14d ago",
    "f13_lag14": "MVRV 14d ago",
}

# Purged CV：train/test 邊界的禁區天數（= outcome 窗口長度）
EMBARGO_DAYS = 7

# Rolling Window：最終預測模型只用最近 N 年
ROLLING_YEARS = 3

# 訓練起點限制：對齊 ETH 起始時間（2017-11-29），剔除 BTC 早期散戶主導的雜訊數據
# None = 不限制（用全部歷史）
TRAIN_START = "2017-11-01"

# XGBoost 分類參數（防 overfitting）
XGB_PARAMS = dict(
    n_estimators=200,
    max_depth=3,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=10,
    reg_alpha=0.1,
    reg_lambda=1.0,
    eval_metric="auc",
    random_state=42,
    use_label_encoder=False,
    verbosity=0,
)

# XGBoost 回歸參數（與分類版相同結構）
XGB_REG_PARAMS = dict(
    n_estimators=200,
    max_depth=3,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=10,
    reg_alpha=0.1,
    reg_lambda=1.0,
    eval_metric="rmse",
    random_state=42,
    verbosity=0,
)


def purged_walk_forward_cv(df: pd.DataFrame, symbol: str) -> tuple[list[dict], object, object, pd.DataFrame]:
    """
    Purged Walk-Forward Cross-Validation（expanding window + embargo）
    同時訓練分類（AUC）和回歸（RMSE + 方向準確率）兩個模型。
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    years          = sorted(df["date"].dt.year.unique())
    min_train_days = 365
    fold_results   = []

    print(f"\n  {symbol} — Purged Walk-Forward CV (embargo={EMBARGO_DAYS}d)")
    print(f"  {'Fold':<6} {'Train (purged)':<26} {'Test':<10} {'n_train':>8} {'n_test':>7} {'AUC':>7} {'RMSE':>7} {'DirAcc':>8}")
    print(f"  {'-'*83}")

    for test_year in years:
        raw_train = df[df["date"].dt.year < test_year]
        test_df   = df[df["date"].dt.year == test_year]

        if len(raw_train) < min_train_days or len(test_df) < 30:
            continue

        # ── Purge：移除 train 末尾 EMBARGO_DAYS 天 ──────────────────────
        test_start    = test_df["date"].min()
        embargo_end   = test_start - timedelta(days=1)
        embargo_start = embargo_end - timedelta(days=EMBARGO_DAYS - 1)
        train_df = raw_train[raw_train["date"] < embargo_start]

        if len(train_df) < min_train_days:
            continue

        X_train   = train_df[FEATURES].values
        y_cls_trn = train_df["win"].values
        y_reg_trn = train_df["outcome_7d"].values
        X_test    = test_df[FEATURES].values
        y_cls_tst = test_df["win"].values
        y_reg_tst = test_df["outcome_7d"].values

        if len(np.unique(y_cls_trn)) < 2 or len(np.unique(y_cls_tst)) < 2:
            continue

        # 分類
        cls_model = XGBClassifier(**XGB_PARAMS)
        cls_model.fit(X_train, y_cls_trn)
        y_prob = cls_model.predict_proba(X_test)[:, 1]
        auc    = roc_auc_score(y_cls_tst, y_prob)

        # 回歸
        reg_model   = XGBRegressor(**XGB_REG_PARAMS)
        reg_model.fit(X_train, y_reg_trn)
        y_ret_pred  = reg_model.predict(X_test)
        rmse        = float(np.sqrt(mean_squared_error(y_reg_tst, y_ret_pred)))
        dir_acc     = float(np.mean(np.sign(y_ret_pred) == np.sign(y_reg_tst)))

        train_start = train_df["date"].min().strftime("%Y-%m-%d")
        train_end   = train_df["date"].max().strftime("%Y-%m-%d")

        print(f"  {test_year:<6} {train_start}–{train_end}  {test_year}   "
              f"{len(train_df):>8} {len(test_df):>7} {auc:>7.3f} {rmse:>7.3f} {dir_acc:>8.1%}")

        fold_results.append({
            "symbol":      symbol,
            "test_year":   test_year,
            "n_train":     len(train_df),
            "n_test":      len(test_df),
            "auc":         round(auc, 4),
            "rmse":        round(rmse, 4),
            "dir_acc":     round(dir_acc, 4),
            "train_start": train_start,
            "train_end":   train_end,
            "cv_method":   f"purged_expanding (embargo={EMBARGO_DAYS}d)",
        })

    # ── Final models（Rolling Window）────────────────────────────────────
    cutoff  = df["date"].max() - pd.DateOffset(years=ROLLING_YEARS)
    roll_df = df[df["date"] >= cutoff]
    if len(roll_df) < 365:
        roll_df = df

    X_roll    = roll_df[FEATURES].values
    final_cls = XGBClassifier(**XGB_PARAMS)
    final_cls.fit(X_roll, roll_df["win"].values)
    final_reg = XGBRegressor(**XGB_REG_PARAMS)
    final_reg.fit(X_roll, roll_df["outcome_7d"].values)

    print(f"\n  Final models: Rolling {ROLLING_YEARS}y "
          f"({roll_df['date'].min().strftime('%Y-%m-%d')} → {roll_df['date'].max().strftime('%Y-%m-%d')}, "
          f"n={len(roll_df)})")

    # ── Feature importance（全歷史分類模型）──────────────────────────────
    X_all      = df[FEATURES].values
    full_model = XGBClassifier(**XGB_PARAMS)
    full_model.fit(X_all, df["win"].values)

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

    return fold_results, final_cls, final_reg, fi_df


def predict_current(cls_model: object, reg_model: object, symbol: str, calib_df: pd.DataFrame) -> dict:
    """用 Rolling Window 最終模型預測最新一天：勝率 + 預期回報率"""
    sym_df = calib_df[calib_df["symbol"] == symbol].sort_values("date")
    if len(sym_df) == 0:
        return {}
    latest = sym_df.iloc[-1]
    X      = np.array([[latest[f] for f in FEATURES]])
    prob   = float(cls_model.predict_proba(X)[0, 1])
    ret    = float(reg_model.predict(X)[0])
    return {
        "symbol":            symbol,
        "date":              latest["date"],
        "xgb_win_prob":      round(prob, 4),
        "xgb_expected_ret":  round(ret, 4),   # 預期 7 天回報率
        "calib_score":       round(float(latest["score"]), 1),
        "model":             f"rolling_{ROLLING_YEARS}y_purged",
    }


def main():
    calib_path = DATA_DIR / "multifactor_calibration.csv"
    if not calib_path.exists():
        print("❌  multifactor_calibration.csv not found. Run analyze_multifactor_calibration.py first.")
        return

    calib_df = pd.read_csv(calib_path)
    print(f"Loaded calibration data: {len(calib_df)} rows")

    # ── 計算 Lag Features ────────────────────────────────────────────────────
    # 按幣種分組計算，避免跨幣種污染
    lag_frames = []
    for sym in SYMBOLS:
        s = calib_df[calib_df["symbol"] == sym].copy().sort_values("date").reset_index(drop=True)
        s["f8_lag7"]   = s["f8_cont"].shift(7)
        s["f12_lag7"]  = s["f12_cont"].shift(7)
        s["f13_lag7"]  = s["f13_cont"].shift(7)
        s["f14_lag7"]  = s["f14_cont"].shift(7)
        s["f8_lag14"]  = s["f8_cont"].shift(14)
        s["f13_lag14"] = s["f13_cont"].shift(14)
        lag_frames.append(s)
    calib_df = pd.concat(lag_frames, ignore_index=True)

    # 填補 lag 的 NaN（最前面幾行沒有足夠歷史）→ 用中性值 0.5
    for col in ["f8_lag7", "f12_lag7", "f13_lag7", "f14_lag7", "f8_lag14", "f13_lag14"]:
        calib_df[col] = calib_df[col].fillna(0.5)

    print(f"Lag features computed. Sample: f8_lag7 non-null={calib_df['f8_lag7'].notna().sum()}")

    # ── 訓練起點過濾（剔除雜訊歷史數據）────────────────────────────────────────
    if TRAIN_START:
        before = len(calib_df)
        calib_df = calib_df[calib_df["date"] >= TRAIN_START].reset_index(drop=True)
        print(f"TRAIN_START={TRAIN_START}: filtered {before - len(calib_df)} rows "
              f"({before} → {len(calib_df)})")
        for sym in SYMBOLS:
            n = (calib_df["symbol"] == sym).sum()
            print(f"  {sym}: {n} rows after filter")

    all_fold_results = []
    all_fi_rows      = []
    all_predictions  = []

    for symbol in SYMBOLS:
        sym_df = calib_df[calib_df["symbol"] == symbol].copy()
        if len(sym_df) < 400:
            print(f"  ⚠️  {symbol}: not enough data ({len(sym_df)} rows), skipping")
            continue

        fold_results, final_cls, final_reg, fi_df = purged_walk_forward_cv(sym_df, symbol)
        all_fold_results.extend(fold_results)
        all_fi_rows.append(fi_df)

        pred = predict_current(final_cls, final_reg, symbol, calib_df)
        if pred:
            all_predictions.append(pred)

    # ── Save ─────────────────────────────────────────────────────────────
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

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n── Walk-Forward Summary (Purged + Rolling {ROLLING_YEARS}y) ─────────────────")
    for sym in SYMBOLS:
        sym_folds = fold_df[fold_df["symbol"] == sym] if len(fold_df) > 0 else pd.DataFrame()
        if len(sym_folds) == 0:
            continue
        avg_auc     = sym_folds["auc"].mean()
        avg_rmse    = sym_folds["rmse"].mean()
        avg_dir_acc = sym_folds["dir_acc"].mean()
        n_folds     = len(sym_folds)
        consistent  = (sym_folds["auc"] > 0.52).sum()
        print(f"  {sym}: {n_folds} folds | avg AUC={avg_auc:.3f} | avg RMSE={avg_rmse:.3f} | avg DirAcc={avg_dir_acc:.1%} | AUC>0.52 in {consistent}/{n_folds} folds")

    print(f"\n── Current Prediction (Rolling {ROLLING_YEARS}y model) ──────────────────────")
    for p in all_predictions:
        ret_str = f"{p['xgb_expected_ret']:+.1%}"
        print(f"  {p['symbol']}: win_prob={p['xgb_win_prob']:.1%}  expected_ret={ret_str}  (score={p['calib_score']}, as of {p['date']})")


if __name__ == "__main__":
    main()
