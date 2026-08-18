"""
analyze_lstm.py  v1
Bi-LSTM (Bidirectional LSTM) 序列預測模型

原理：
  把過去 LOOKBACK 天的因子序列餵進 Bi-LSTM，
  讓模型自動學習跨時間步的依賴關係（例如：費率連續上升趨勢）。
  比 XGBoost 的手工 lag 特徵更能捕捉序列 pattern。

架構：
  Input: (LOOKBACK days × n_features)
  → Bidirectional LSTM(64) → Dropout(0.3)
  → Bidirectional LSTM(32) → Dropout(0.2)
  → Dense(16, relu)
  → Dense(1, sigmoid)  ← 7日後漲跌概率

訓練策略：
  - Purged Walk-Forward（embargo=7d，同 XGBoost）
  - Early stopping（patience=10）
  - 每個 fold 重新初始化模型（防洩漏）

輸出：
  1. lstm_results.csv    — 每個 fold 的 AUC / DirAcc（對比 XGBoost）
  2. lstm_predictions.csv — 最新預測（lstm_win_prob）
"""

import os
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import timedelta
import warnings
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # 靜音 TF 啟動訊息

import tensorflow as tf
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Bidirectional, LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.metrics import roc_auc_score

DATA_DIR        = Path(__file__).parent.parent / "data"
OUT_RESULTS     = DATA_DIR / "lstm_results.csv"
OUT_PREDICTIONS = DATA_DIR / "lstm_predictions.csv"

SYMBOLS    = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
LOOKBACK   = 30        # 序列窗口：過去 30 天
EMBARGO    = 7         # Purged CV embargo（同 XGBoost）
ROLLING_Y  = 3         # 最終預測模型的 rolling window（年）
TRAIN_START = "2017-11-01"

# 特徵集（與 XGBoost 相同，但 LSTM 直接用原始連續值，不需要手工 lag）
FEATURES_COMMON = [
    "f1_cont", "f2_cont",
    "f5_cont", "f6_cont", "f7_cont", "f8_cont",
    "f9_cont", "f12_cont", "f13_cont", "f14_cont",
]
FEATURES_BTC = FEATURES_COMMON + ["f11_cont"]

def get_features(symbol: str) -> list:
    return FEATURES_BTC if symbol == "BTCUSDT" else FEATURES_COMMON


def build_model(n_features: int, seed: int = 42) -> tf.keras.Model:
    """Bi-LSTM 架構。每個 fold 重新初始化，防止跨 fold 洩漏。"""
    tf.random.set_seed(seed)
    model = Sequential([
        Bidirectional(LSTM(64, return_sequences=True),
                      input_shape=(LOOKBACK, n_features)),
        Dropout(0.3),
        Bidirectional(LSTM(32)),
        Dropout(0.2),
        Dense(16, activation="relu"),
        Dense(1, activation="sigmoid"),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=["AUC"],
    )
    return model


def make_sequences(df: pd.DataFrame, features: list):
    """
    把逐日 DataFrame 轉成 (N, LOOKBACK, n_features) 序列張量。
    對應的 label 是第 LOOKBACK 天的 win。
    """
    X, y = [], []
    vals = df[features].values
    labels = df["win"].values
    for i in range(LOOKBACK, len(df)):
        X.append(vals[i - LOOKBACK:i])
        y.append(labels[i])
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)


def purged_walk_forward(df: pd.DataFrame, symbol: str, features: list) -> list:
    """
    Purged Walk-Forward CV — 每個 test_year 訓練一個獨立的 Bi-LSTM。
    回傳 fold_results list。
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    years = sorted(df["date"].dt.year.unique())
    min_train_days = LOOKBACK + 365
    fold_results = []

    print(f"\n  {symbol} — Bi-LSTM Purged Walk-Forward (lookback={LOOKBACK}d, embargo={EMBARGO}d)")
    print(f"  {'Fold':<6} {'Train':<24} {'Test':<6} {'n_trn':>7} {'n_tst':>6} {'AUC':>7} {'DirAcc':>8}")
    print(f"  {'-'*72}")

    for test_year in years:
        raw_train = df[df["date"].dt.year < test_year]
        test_df   = df[df["date"].dt.year == test_year]

        if len(raw_train) < min_train_days or len(test_df) < 30:
            continue

        # Purge embargo
        test_start    = test_df["date"].min()
        embargo_end   = test_start - timedelta(days=1)
        embargo_start = embargo_end - timedelta(days=EMBARGO - 1)
        train_df = raw_train[raw_train["date"] < embargo_start].reset_index(drop=True)
        test_df  = test_df.reset_index(drop=True)

        if len(train_df) < min_train_days:
            continue

        X_train, y_train = make_sequences(train_df, features)
        X_test,  y_test  = make_sequences(test_df,  features)

        if len(X_test) < 10 or len(np.unique(y_test)) < 2:
            continue

        # 每個 fold 建新模型
        model = build_model(len(features), seed=42)
        es = EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True, verbose=0)
        model.fit(
            X_train, y_train,
            validation_split=0.15,
            epochs=100,
            batch_size=32,
            callbacks=[es],
            verbose=0,
        )

        y_prob   = model.predict(X_test, verbose=0).flatten()
        y_binary = (y_prob >= 0.5).astype(int)
        auc      = roc_auc_score(y_test, y_prob)
        dir_acc  = float(np.mean(y_binary == y_test))

        train_start_str = train_df["date"].min().strftime("%Y-%m-%d")
        train_end_str   = train_df["date"].max().strftime("%Y-%m-%d")

        print(f"  {test_year:<6} {train_start_str}–{train_end_str[:4]}  {test_year}   "
              f"{len(train_df):>7} {len(test_df):>6} {auc:>7.3f} {dir_acc:>8.1%}")

        fold_results.append({
            "symbol":      symbol,
            "test_year":   test_year,
            "n_train":     len(train_df),
            "n_test":      len(test_df),
            "auc":         round(auc, 4),
            "dir_acc":     round(dir_acc, 4),
            "train_start": train_start_str,
            "train_end":   train_end_str,
        })

        # 釋放記憶體
        del model
        tf.keras.backend.clear_session()

    return fold_results


def train_final_model(df: pd.DataFrame, features: list) -> tf.keras.Model:
    """最終模型：用最近 ROLLING_Y 年數據訓練，用於當前預測。"""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    cutoff = df["date"].max() - pd.DateOffset(years=ROLLING_Y)
    roll_df = df[df["date"] >= cutoff].reset_index(drop=True)
    if len(roll_df) < LOOKBACK + 100:
        roll_df = df.reset_index(drop=True)

    X, y = make_sequences(roll_df, features)
    model = build_model(len(features), seed=42)
    es = EarlyStopping(monitor="val_loss", patience=10, restore_best_weights=True, verbose=0)
    model.fit(
        X, y,
        validation_split=0.15,
        epochs=100,
        batch_size=32,
        callbacks=[es],
        verbose=0,
    )
    print(f"  Final model trained on {len(roll_df)} rows "
          f"({roll_df['date'].min().strftime('%Y-%m-%d')} → {roll_df['date'].max().strftime('%Y-%m-%d')})")
    return model


def predict_current(model: tf.keras.Model, df: pd.DataFrame, features: list, symbol: str) -> dict:
    """用最終模型預測最新時間點的 win probability。"""
    df = df.sort_values("date").reset_index(drop=True)
    if len(df) < LOOKBACK:
        return {}
    seq = df[features].values[-LOOKBACK:].reshape(1, LOOKBACK, len(features)).astype(np.float32)
    prob = float(model.predict(seq, verbose=0)[0, 0])
    latest_date = df["date"].iloc[-1]
    if hasattr(latest_date, "strftime"):
        date_str = latest_date.strftime("%Y-%m-%d")
    else:
        date_str = str(latest_date)
    return {
        "symbol":       symbol,
        "date":         date_str,
        "lstm_win_prob": round(prob, 4),
    }


def main():
    calib_path = DATA_DIR / "multifactor_calibration.csv"
    if not calib_path.exists():
        print("❌  multifactor_calibration.csv not found.")
        return

    calib_df = pd.read_csv(calib_path)
    print(f"Loaded: {len(calib_df)} rows")

    # TRAIN_START 過濾
    calib_df["date"] = pd.to_datetime(calib_df["date"])
    calib_df = calib_df[calib_df["date"] >= TRAIN_START].reset_index(drop=True)
    print(f"After TRAIN_START filter: {len(calib_df)} rows")

    all_folds = []
    all_preds = []

    for symbol in SYMBOLS:
        sym_df   = calib_df[calib_df["symbol"] == symbol].copy().sort_values("date").reset_index(drop=True)
        features = get_features(symbol)

        if len(sym_df) < LOOKBACK + 400:
            print(f"  ⚠️  {symbol}: not enough data ({len(sym_df)} rows), skipping")
            continue

        # Fill missing features with 0.5 (neutral)
        for f in features:
            if f not in sym_df.columns:
                sym_df[f] = 0.5
            sym_df[f] = sym_df[f].fillna(0.5)

        fold_results = purged_walk_forward(sym_df, symbol, features)
        all_folds.extend(fold_results)

        # Final model + current prediction
        print(f"\n  Training final model for {symbol}...")
        final_model = train_final_model(sym_df, features)
        pred = predict_current(final_model, sym_df, features, symbol)
        if pred:
            all_preds.append(pred)

        del final_model
        tf.keras.backend.clear_session()

    # ── Save ────────────────────────────────────────────────────────────────
    results_df = pd.DataFrame(all_folds)
    results_df.to_csv(OUT_RESULTS, index=False)
    print(f"\n✅  lstm_results: {len(results_df)} rows → {OUT_RESULTS}")

    pred_df = pd.DataFrame(all_preds)
    pred_df.to_csv(OUT_PREDICTIONS, index=False)
    print(f"✅  lstm_predictions: {len(pred_df)} rows → {OUT_PREDICTIONS}")

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n── Bi-LSTM Walk-Forward Summary ─────────────────────────────────────")
    for sym in SYMBOLS:
        sym_folds = results_df[results_df["symbol"] == sym] if len(results_df) > 0 else pd.DataFrame()
        if len(sym_folds) == 0:
            continue
        avg_auc    = sym_folds["auc"].mean()
        avg_dir    = sym_folds["dir_acc"].mean()
        n_folds    = len(sym_folds)
        consistent = (sym_folds["auc"] > 0.52).sum()
        print(f"  {sym}: {n_folds} folds | avg AUC={avg_auc:.3f} | avg DirAcc={avg_dir:.1%} | AUC>0.52 in {consistent}/{n_folds} folds")

    print(f"\n── Current Prediction (Rolling {ROLLING_Y}y model) ──────────────────────")
    for p in all_preds:
        print(f"  {p['symbol']}: lstm_win_prob={p['lstm_win_prob']:.1%}  (as of {p['date']})")


if __name__ == "__main__":
    main()
