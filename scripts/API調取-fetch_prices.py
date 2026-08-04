import csv
import yfinance as yf
from datetime import datetime, timezone, timedelta

print("fetch_prices started")

# yfinance ticker 對應（Yahoo Finance 格式）
# BTC：Yahoo Finance 從 2014-09-17 起有數據（比 Binance 早 3 年）
# ETH：Yahoo Finance 從 2017-11 起有數據，維持原起點
# SOL：2020-09-09 上市，不變
SYMBOLS = {
    "BTCUSDT": ("BTC-USD", "2014-09-17"),
    "ETHUSDT": ("ETH-USD", "2017-08-17"),
    "SOLUSDT": ("SOL-USD", "2020-09-09"),
}

# 只保留「昨天及更早」的完整收盤數據
# 原因：crypto 市場 24h 不停，yfinance 在盤中會返回當天未完整的日線
# 例如今天是 2026-07-31，就只保留到 2026-07-30（含）
import pandas as pd
today_utc = datetime.now(timezone.utc).date()
cutoff = today_utc - timedelta(days=1)  # 昨天（含）以前的才算完整

print(f"Today UTC: {today_utc}, cutoff (last complete day): {cutoff}")

for symbol, (ticker, start_date) in SYMBOLS.items():
    print(f"\n=== Fetching {symbol} ({ticker}) ===")

    df = yf.download(ticker, start=start_date, interval="1d", auto_adjust=True, progress=False)

    if df.empty:
        raise RuntimeError(f"No data returned for {ticker}")

    # 新版 yfinance 單 ticker 下載會產生 MultiIndex columns (Ticker, OHLCV)
    # 需要移除多餘的 Ticker 層，才能用 row["Open"] 等欄位名
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.droplevel("Ticker")

    print(f"Total rows fetched (before cutoff filter): {len(df)}")

    # 過濾掉今天（UTC）的未完整日線
    df = df[df.index.date <= cutoff]

    print(f"Rows after cutoff filter (≤ {cutoff}): {len(df)}")

    if df.empty:
        raise RuntimeError(f"No complete data for {ticker} after cutoff filter")

    filename = f"data/{symbol}.csv"
    with open(filename, "w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["open_time", "open", "high", "low", "close", "volume"])
        for ts, row in df.iterrows():
            # open_time 轉成 Unix 毫秒，與原本 Binance 格式一致
            open_time_ms = int(ts.timestamp() * 1000)
            writer.writerow([
                open_time_ms,
                row["Open"],
                row["High"],
                row["Low"],
                row["Close"],
                row["Volume"],
            ])

    print(f"Saved {filename} (latest date: {df.index[-1].date()})")
