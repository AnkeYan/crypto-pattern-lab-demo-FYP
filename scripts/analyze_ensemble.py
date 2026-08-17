"""
analyze_ensemble.py  v1
Ensemble: XGBoost + LightGBM Soft Voting
分類（勝率）+ 回歸（預期回報率）雙模型 Ensemble

原理：
  兩個不同基礎算法（XGBoost / LightGBM）各自訓練，
  對同一組特徵產生不同的預測偏差（bias）。
  Soft Voting = 取平均概率，抵消單模型的過擬合部分。
  預期 DirAcc 提升 1–4%，AUC 提升 0.005–0.015。

從 multifactor_calibration.csv 讀取，特徵集與 analyze_xgboost.py 完全相同。

輸出：
  1. ensemble_results.csv  — 每個 fold 的 AUC / RMSE / DirAcc（對比 XGB 單模型）
  2. ensemble_predictions.csv — 最新預測（ensemble_win_prob / ensemble_expected_ret）
"""

import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta
import warnings
warnings.filterwarnings("ignore")

from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.metrics import roc_auc_score, mean_squared_error

DATA_DIR        = Path(__file__).parent.parent / "data"
OUT_RESULTS     = DATA_DIR / "ensemble_results.csv"
OUT_PREDICTIONS = DATA_DIR / "ensemble_predictions.csv"

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]

FEATURES_COMMON = [
    "f1_cont", "f2_cont",
    "f5_cont", "f6_cont", "f7_cont", "f8_cont",
    "f9_cont", "f12_cont", "f13_cont",
    "f14_cont",
    "f8_lag7", "f12_lag7", "f13_lag7", "f14_lag7",
    "f8_lag14", "f13_lag14",
]

FEATURES_BTC = FEATURES_COMMON + ["f11_cont"]

def get_features(symbol: str) -> list:
    return FEATURES_BTC if symbol == "BTCUSDT" else FEATURES_COMMON

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

EMBARGO_DAYS  = 7
ROLLING_YEARS = 3
TRAIN_START   = "2017-11-01"

# XGBoost 參數（與 analyze_xgboost.py 一致）
XGB_CLS_PARAMS = dict(n_estimators=200, max_depth=3, learning_rate=0.05,
                      subsample=0.8, colsample_bytree=0.8, min_child_weight=10,
                      reg_alpha=0.1, reg_lambda=1.0, eval_metric="auc",
                      random_state=42, use_label_encoder=False, verbosity=0)
XGB_REG_PARAMS = dict(n_estimators=200, max_depth=3, learning_rate=0.05,
                      subsample=0.8, colsample_bytree=0.8, min_child_weight=10,
                      reg_alpha=0.1, reg_lambda=1.0, eval_metric="rmse",
                      random_state=42, verbosity=0)

# LightGBM 參數（類似防過擬合設定）
LGB_CLS_PARAMS = dict(n_estimators=200, max_depth=3, learning_rate=0.05,
                      subsample=0.8, colsample_bytree=0.8, min_child_samples=20,
                      reg_alpha=0.1, reg_lambda=1.0, random_state=42, verbose=-1)
LGB_REG_PARAMS = dict(n_estimators=200, max_depth=3, learning_rate=0.05,
                      subsample=0.8, colsample_bytree=0.8, min_child_samples=20,
                      reg_alpha=0.1, reg_lambda=1.0, random_state=42, verbose=-1)


def purged_walk_forward(df: pd.DataFrame, symbol: str):
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    years = sorted(df["date"].dt.year.unique())
    fold_results = []

    print(f"\n  {symbol} — Ensemble Walk-Forward CV")
    print(f"  {'Fold':<6} {'n_test':>7} {'XGB AUC':>9} {'LGB AUC':>9} {'Ens AUC':>9} {'DirAcc':>8} {'RMSE':>7}")
    print(f"  {'-'*60}")

    for test_year in years:
        raw_train = df[df["date"].dt.year < test_year]
        test_df   = df[df["date"].dt.year == test_year]
        if len(raw_train) < 365 or len(test_df) < 30:
            continue

        test_start    = test_df["date"].min()
        embargo_start = test_start - timedelta(days=EMBARGO_DAYS)
        train_df = raw_train[raw_train["date"] < embargo_start]
        if len(train_df) < 365:
            continue

        features = get_features(symbol)
        X_tr = train_df[features].values
        y_cls_tr = train_df["win"].values
        y_reg_tr = train_df["outcome_7d"].values
        X_te = test_df[features].values
        y_cls_te = test_df["win"].values
        y_reg_te = test_df["outcome_7d"].values

        if len(np.unique(y_cls_tr)) < 2 or len(np.unique(y_cls_te)) < 2:
            continue

        # XGBoost
        xgb_cls = XGBClassifier(**XGB_CLS_PARAMS)
        xgb_cls.fit(X_tr, y_cls_tr)
        xgb_reg = XGBRegressor(**XGB_REG_PARAMS)
        xgb_reg.fit(X_tr, y_reg_tr)

        # LightGBM
        lgb_cls = LGBMClassifier(**LGB_CLS_PARAMS)
        lgb_cls.fit(X_tr, y_cls_tr)
        lgb_reg = LGBMRegressor(**LGB_REG_PARAMS)
        lgb_reg.fit(X_tr, y_reg_tr)

        # 單模型預測
        xgb_prob = xgb_cls.predict_proba(X_te)[:, 1]
        lgb_prob = lgb_cls.predict_proba(X_te)[:, 1]
        xgb_ret  = xgb_reg.predict(X_te)
        lgb_ret  = lgb_reg.predict(X_te)

        xgb_auc = roc_auc_score(y_cls_te, xgb_prob)
        lgb_auc = roc_auc_score(y_cls_te, lgb_prob)

        # Ensemble（soft voting = 平均）
        ens_prob = (xgb_prob + lgb_prob) / 2
        ens_ret  = (xgb_ret  + lgb_ret)  / 2

        ens_auc = roc_auc_score(y_cls_te, ens_prob)
        rmse    = float(np.sqrt(mean_squared_error(y_reg_te, ens_ret)))
        dir_acc = float(np.mean(np.sign(ens_ret) == np.sign(y_reg_te)))

        print(f"  {test_year:<6} {len(test_df):>7} {xgb_auc:>9.3f} {lgb_auc:>9.3f} {ens_auc:>9.3f} {dir_acc:>8.1%} {rmse:>7.3f}")

        fold_results.append({
            "symbol":    symbol,
            "test_year": test_year,
            "n_test":    len(test_df),
            "xgb_auc":   round(xgb_auc, 4),
            "lgb_auc":   round(lgb_auc, 4),
            "ens_auc":   round(ens_auc, 4),
            "dir_acc":   round(dir_acc, 4),
            "rmse":      round(rmse, 4),
        })

    # Final models（Rolling Window）
    cutoff  = df["date"].max() - pd.DateOffset(years=ROLLING_YEARS)
    roll_df = df[df["date"] >= cutoff]
    if len(roll_df) < 365:
        roll_df = df

    features = get_features(symbol)
    X_roll = roll_df[features].values
    final_xgb_cls = XGBClassifier(**XGB_CLS_PARAMS);  final_xgb_cls.fit(X_roll, roll_df["win"].values)
    final_lgb_cls = LGBMClassifier(**LGB_CLS_PARAMS);  final_lgb_cls.fit(X_roll, roll_df["win"].values)
    final_xgb_reg = XGBRegressor(**XGB_REG_PARAMS);    final_xgb_reg.fit(X_roll, roll_df["outcome_7d"].values)
    final_lgb_reg = LGBMRegressor(**LGB_REG_PARAMS);   final_lgb_reg.fit(X_roll, roll_df["outcome_7d"].values)

    return fold_results, final_xgb_cls, final_lgb_cls, final_xgb_reg, final_lgb_reg


def predict_current(xgb_cls, lgb_cls, xgb_reg, lgb_reg, symbol, calib_df):
    sym_df = calib_df[calib_df["symbol"] == symbol].sort_values("date")
    if len(sym_df) == 0:
        return {}
    latest = sym_df.iloc[-1]
    features = get_features(symbol)
    X = np.array([[latest[f] for f in features]])
    prob = float((xgb_cls.predict_proba(X)[0, 1] + lgb_cls.predict_proba(X)[0, 1]) / 2)
    ret  = float((xgb_reg.predict(X)[0] + lgb_reg.predict(X)[0]) / 2)
    return {
        "symbol":                  symbol,
        "date":                    latest["date"],
        "ensemble_win_prob":       round(prob, 4),
        "ensemble_expected_ret":   round(ret, 4),
        "calib_score":             round(float(latest["score"]), 1),
        "model":                   f"ensemble_xgb+lgb_rolling{ROLLING_YEARS}y",
    }


def main():
    calib_path = DATA_DIR / "multifactor_calibration.csv"
    if not calib_path.exists():
        print("❌  multifactor_calibration.csv not found. Run analyze_multifactor_calibration.py first.")
        return

    calib_df = pd.read_csv(calib_path)

    # Lag features
    lag_frames = []
    for sym in SYMBOLS:
        s = calib_df[calib_df["symbol"] == sym].copy().sort_values("date").reset_index(drop=True)
        s["f8_lag7"]   = s["f8_cont"].shift(7)
        s["f12_lag7"]  = s["f12_cont"].shift(7)
        s["f13_lag7"]  = s["f13_cont"].shift(7)
        s["f8_lag14"]  = s["f8_cont"].shift(14)
        s["f13_lag14"] = s["f13_cont"].shift(14)
        lag_frames.append(s)
    calib_df = pd.concat(lag_frames, ignore_index=True)
    for col in ["f8_lag7", "f12_lag7", "f13_lag7", "f8_lag14", "f13_lag14"]:
        calib_df[col] = calib_df[col].fillna(0.5)

    if TRAIN_START:
        calib_df = calib_df[calib_df["date"] >= TRAIN_START].reset_index(drop=True)

    all_folds = []
    all_preds = []

    for symbol in SYMBOLS:
        sym_df = calib_df[calib_df["symbol"] == symbol].copy()
        if len(sym_df) < 400:
            continue
        folds, xgb_cls, lgb_cls, xgb_reg, lgb_reg = purged_walk_forward(sym_df, symbol)
        all_folds.extend(folds)
        pred = predict_current(xgb_cls, lgb_cls, xgb_reg, lgb_reg, symbol, calib_df)
        if pred:
            all_preds.append(pred)

    fold_df = pd.DataFrame(all_folds)
    fold_df.to_csv(OUT_RESULTS, index=False)
    print(f"\n✅  ensemble_results: {len(fold_df)} rows → {OUT_RESULTS}")

    pred_df = pd.DataFrame(all_preds)
    pred_df.to_csv(OUT_PREDICTIONS, index=False)
    print(f"✅  ensemble_predictions: {len(pred_df)} rows → {OUT_PREDICTIONS}")

    print(f"\n── Ensemble Summary ─────────────────────────────────")
    for sym in SYMBOLS:
        s = fold_df[fold_df["symbol"] == sym] if len(fold_df) > 0 else pd.DataFrame()
        if len(s) == 0:
            continue
        print(f"  {sym}: {len(s)} folds | avg XGB AUC={s['xgb_auc'].mean():.3f} | "
              f"avg LGB AUC={s['lgb_auc'].mean():.3f} | "
              f"avg Ens AUC={s['ens_auc'].mean():.3f} | "
              f"avg DirAcc={s['dir_acc'].mean():.1%} | "
              f"avg RMSE={s['rmse'].mean():.3f}")

    print(f"\n── Current Ensemble Prediction ──────────────────────")
    for p in all_preds:
        print(f"  {p['symbol']}: win_prob={p['ensemble_win_prob']:.1%}  "
              f"expected_ret={p['ensemble_expected_ret']:+.1%}  (score={p['calib_score']})")


if __name__ == "__main__":
    main()
