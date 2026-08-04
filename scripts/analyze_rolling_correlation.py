print("analyze_rolling_correlation started")

import pandas as pd
import os

# ── 設定 ──────────────────────────────────────────────────────────────────────
SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
WINDOW  = 60   # 滾動窗口：60天

# ── 步驟 1：載入三個幣種的收盤價 ──────────────────────────────────────────────
dfs = {}
for sym in SYMBOLS:
    path = os.path.join("data", f"{sym}.csv")
    df   = pd.read_csv(path)
    df["close"] = df["close"].astype(float)
    df["date"]  = pd.to_datetime(df["open_time"], unit="ms").dt.normalize()
    dfs[sym]    = df[["date", "close"]].set_index("date").rename(columns={"close": sym})

# ── 步驟 2：BTC + ETH 合併（從 2017年8月）────────────────────────────────────
# 兩者上市時間相同，直接 inner join
btc_eth_df = dfs["BTCUSDT"].join(dfs["ETHUSDT"], how="inner").sort_index()
print(f"BTC+ETH price data: {len(btc_eth_df)} days "
      f"({btc_eth_df.index.min().date()} → {btc_eth_df.index.max().date()})")

# ── 步驟 3：BTC + SOL 合併（從 2020年9月）────────────────────────────────────
# SOL 上市較晚，inner join 自動只保留兩者都有數據的日期
btc_sol_df = dfs["BTCUSDT"].join(dfs["SOLUSDT"], how="inner").sort_index()
print(f"BTC+SOL price data: {len(btc_sol_df)} days "
      f"({btc_sol_df.index.min().date()} → {btc_sol_df.index.max().date()})")

# ── 步驟 4：各自計算日回報率 ──────────────────────────────────────────────────
# 用日回報率而非收盤價，消除長期趨勢造成的虛高相關
ret_btc_eth = btc_eth_df.pct_change()
ret_btc_sol = btc_sol_df.pct_change()

# ── 步驟 5：計算滾動相關係數 ──────────────────────────────────────────────────
# 每個點 = 該日期往前60天的 Pearson 相關係數
eth_btc_corr = ret_btc_eth["ETHUSDT"].rolling(WINDOW).corr(ret_btc_eth["BTCUSDT"])
sol_btc_corr = ret_btc_sol["SOLUSDT"].rolling(WINDOW).corr(ret_btc_sol["BTCUSDT"])

# ── 步驟 6：ETH/BTC 相對強度比率 ──────────────────────────────────────────────
# ETH收盤價 ÷ BTC收盤價，以第一個有效點標準化為 100
# 上升 = ETH 跑贏 BTC；下降 = BTC 主導
eth_btc_ratio_raw = btc_eth_df["ETHUSDT"] / btc_eth_df["BTCUSDT"]
base              = eth_btc_ratio_raw.iloc[0]
eth_btc_ratio     = (eth_btc_ratio_raw / base * 100).round(2)

# ── 步驟 7：以 BTC+ETH 的日期為主軸，合併 SOL 數據 ──────────────────────────
# BTC/ETH 相關係數從 2017年起都有
# SOL/BTC 相關係數只從 2020年起才有，之前的日期填 NaN
result_df = pd.DataFrame({
    "date":          eth_btc_corr.index,
    "eth_btc_corr":  eth_btc_corr.values.round(4),
    "eth_btc_ratio": eth_btc_ratio.values,
})

# 把 sol_btc_corr（index = 2020年後）merge 進來
sol_series = sol_btc_corr.round(4).rename("sol_btc_corr").reset_index()
sol_series.columns = ["date", "sol_btc_corr"]

result_df = result_df.merge(sol_series, on="date", how="left")
# 2020年前 sol_btc_corr 為 NaN，這是預期行為

# ── 步驟 8：去掉 rolling 窗口預熱期（eth_btc_corr 為 NaN 的前 60 行）────────
result_df = result_df.dropna(subset=["eth_btc_corr"]).reset_index(drop=True)
result_df["date"] = pd.to_datetime(result_df["date"]).dt.strftime("%Y-%m-%d")

# ── 步驟 9：輸出 CSV ──────────────────────────────────────────────────────────
out_path = "data/rolling_correlation.csv"
result_df.to_csv(out_path, index=False)

# 統計
total        = len(result_df)
sol_valid    = result_df["sol_btc_corr"].notna().sum()
sol_nan      = result_df["sol_btc_corr"].isna().sum()

print(f"\nSaved {total} rows to {out_path}")
print(f"  eth_btc_corr: {total} rows (from {result_df['date'].iloc[0]})")
print(f"  sol_btc_corr: {sol_valid} rows with data, {sol_nan} rows NaN (pre-SOL period)")
print(result_df.tail(3).to_string(index=False))
