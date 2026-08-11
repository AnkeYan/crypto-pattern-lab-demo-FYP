"""
analyze_portfolio_optimization.py
Portfolio Optimization（投資組合優化）

使用 PyPortfolioOpt（Markowitz MVO）計算 BTC/ETH/SOL 的最優配比。
回答用戶問題：「我持有這三個幣，各買多少比例最好？」

輸出 data/portfolio_optimization.csv
Schema（多種 row_type）：
  row_type=weights   : symbol, weight（最優配比）
  row_type=metrics   : metric, value（Sharpe, Return, Volatility）
  row_type=history   : date, equal_weight, mvo_weight（歷史組合價值對比）
  row_type=frontier  : risk, return（Efficient Frontier 上的點）
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone, timedelta

DATA_DIR = Path(__file__).parent.parent / "data"
OUT_PATH = DATA_DIR / "portfolio_optimization.csv"
SYMBOLS  = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
TICKERS  = ["BTC", "ETH", "SOL"]

# 訓練期：用 2020-09-09（SOL 上市）到前一年年底
# 展示期：最近兩年（用來畫歷史曲線）
TRAIN_END   = "2024-12-31"
DISPLAY_START = "2023-01-01"


def load_prices() -> pd.DataFrame:
    dfs = {}
    for sym, ticker in zip(SYMBOLS, TICKERS):
        df = pd.read_csv(DATA_DIR / f"{sym}.csv")
        df["date"] = pd.to_datetime(df["open_time"], unit="ms").dt.strftime("%Y-%m-%d")
        df = df[["date", "close"]].drop_duplicates("date").sort_values("date")
        df["close"] = df["close"].astype(float)
        dfs[ticker] = df.set_index("date")["close"]
    price_df = pd.DataFrame(dfs).dropna()
    return price_df


def main() -> None:
    try:
        from pypfopt import EfficientFrontier, risk_models, expected_returns
    except ImportError:
        print("❌  pypfopt not installed. Run: pip install pyportfolioopt")
        return

    print("Loading prices...")
    price_df = load_prices()
    print(f"  {len(price_df)} days ({price_df.index[0]} to {price_df.index[-1]})")

    # 訓練集：SOL 上市後到 TRAIN_END
    train_df = price_df[price_df.index <= TRAIN_END]
    print(f"  Training period: {train_df.index[0]} to {train_df.index[-1]} ({len(train_df)} days)")

    rows = []

    # ── 1. MVO 最優配比（最大化 Sharpe Ratio）────────────────────────────
    mu = expected_returns.mean_historical_return(train_df, frequency=365)
    S  = risk_models.sample_cov(train_df, frequency=365)

    ef = EfficientFrontier(mu, S, weight_bounds=(0, 1))
    ef.max_sharpe()
    weights = ef.clean_weights()
    perf    = ef.portfolio_performance(verbose=False)
    # perf = (expected_return, volatility, sharpe_ratio)

    print(f"\nMVO Max Sharpe weights: {dict(weights)}")
    print(f"  Expected Return: {perf[0]:.1%}")
    print(f"  Volatility:      {perf[1]:.1%}")
    print(f"  Sharpe Ratio:    {perf[2]:.2f}")

    for ticker, w in weights.items():
        rows.append({"row_type": "weights", "label": ticker, "value": round(w, 4), "extra": ""})

    # ── 2. Min Volatility 配比（最小風險）────────────────────────────────
    ef2 = EfficientFrontier(mu, S, weight_bounds=(0, 1))
    ef2.min_volatility()
    w_minvol = ef2.clean_weights()
    perf2    = ef2.portfolio_performance(verbose=False)
    print(f"\nMin Volatility weights: {dict(w_minvol)}")
    for ticker, w in w_minvol.items():
        rows.append({"row_type": "minvol_weights", "label": ticker, "value": round(w, 4), "extra": ""})

    # ── 3. 各幣種個別統計（訓練期）────────────────────────────────────────
    daily_ret = train_df.pct_change().dropna()
    for ticker in TICKERS:
        ann_ret = daily_ret[ticker].mean() * 365
        ann_vol = daily_ret[ticker].std()  * (365 ** 0.5)
        sharpe  = ann_ret / ann_vol if ann_vol > 0 else 0
        rows.append({"row_type": "asset_stats", "label": ticker,
                     "value": round(ann_ret, 4),
                     "extra": f"vol={ann_vol:.4f},sharpe={sharpe:.4f}"})

    # ── 4. 投資組合歷史表現對比（展示期）────────────────────────────────
    display_df = price_df[price_df.index >= DISPLAY_START].copy()
    if len(display_df) > 0:
        init_prices = display_df.iloc[0]

        # 等權重組合（各 1/3）
        eq_w = {t: 1/3 for t in TICKERS}
        eq_val = sum(eq_w[t] / init_prices[t] for t in TICKERS)
        equal_portfolio = sum(
            (eq_w[t] / init_prices[t]) * display_df[t] for t in TICKERS
        ) / eq_val

        # MVO 最優配比組合
        mvo_val = sum(weights[t] / init_prices[t] for t in TICKERS if weights[t] > 0)
        if mvo_val > 0:
            mvo_portfolio = sum(
                (weights[t] / init_prices[t]) * display_df[t]
                for t in TICKERS if weights[t] > 0
            ) / mvo_val
        else:
            mvo_portfolio = equal_portfolio.copy()

        # 標準化到 100（方便前端比較）
        equal_norm = (equal_portfolio / equal_portfolio.iloc[0] * 100).round(2)
        mvo_norm   = (mvo_portfolio   / mvo_portfolio.iloc[0]   * 100).round(2)

        for date, eq, mvo in zip(display_df.index, equal_norm, mvo_norm):
            rows.append({
                "row_type": "history",
                "label":    date,
                "value":    eq,
                "extra":    str(round(mvo, 2)),
            })

    # ── 5. Efficient Frontier（20個點）────────────────────────────────────
    try:
        target_returns = np.linspace(float(mu.min()), float(mu.max()), 20)
        for tr in target_returns:
            try:
                ef_f = EfficientFrontier(mu, S, weight_bounds=(0, 1))
                ef_f.efficient_return(tr)
                p = ef_f.portfolio_performance(verbose=False)
                rows.append({
                    "row_type": "frontier",
                    "label":    str(round(p[1], 4)),   # risk (volatility)
                    "value":    round(p[0], 4),         # return
                    "extra":    str(round(p[2], 4)),    # sharpe
                })
            except Exception:
                pass
    except Exception as e:
        print(f"  Frontier skipped: {e}")

    # ── 6. Portfolio metrics ──────────────────────────────────────────────
    rows.append({"row_type": "metrics", "label": "mvo_sharpe",  "value": round(perf[2], 4),  "extra": ""})
    rows.append({"row_type": "metrics", "label": "mvo_return",  "value": round(perf[0], 4),  "extra": ""})
    rows.append({"row_type": "metrics", "label": "mvo_vol",     "value": round(perf[1], 4),  "extra": ""})
    rows.append({"row_type": "metrics", "label": "minvol_sharpe","value": round(perf2[2], 4), "extra": ""})
    rows.append({"row_type": "metrics", "label": "minvol_return","value": round(perf2[0], 4), "extra": ""})
    rows.append({"row_type": "metrics", "label": "minvol_vol",   "value": round(perf2[1], 4), "extra": ""})
    rows.append({"row_type": "metrics", "label": "train_start",  "value": 0, "extra": train_df.index[0]})
    rows.append({"row_type": "metrics", "label": "train_end",    "value": 0, "extra": TRAIN_END})

    result = pd.DataFrame(rows)
    result.to_csv(OUT_PATH, index=False)
    print(f"\n✅  Saved {len(result)} rows → {OUT_PATH}")


if __name__ == "__main__":
    main()
