print("analyze_garch started")

import os
import pandas as pd
from arch import arch_model

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
TRADING_DAYS = 365
FORECAST_HORIZON = 7

results = []

for symbol in SYMBOLS:
    path = os.path.join("data", f"{symbol}.csv")
    df = pd.read_csv(path)
    df["close"] = df["close"].astype(float)

    returns = df["close"].pct_change().dropna() * 100
    model = arch_model(
        returns,
        mean="Constant",
        vol="GARCH",
        p=1,
        q=1,
        dist="t",
        rescale=False,
    )
    fitted = model.fit(disp="off")

    forecast = fitted.forecast(horizon=FORECAST_HORIZON, reindex=False)
    variance = forecast.variance.iloc[-1]
    forecast_vols = [(variance.iloc[i] ** 0.5) / 100 for i in range(FORECAST_HORIZON)]

    forecast_vol_1d = forecast_vols[0]
    forecast_vol_7d = (sum(forecast_vols) / len(forecast_vols))
    annualized_vol = (returns.std() * (TRADING_DAYS ** 0.5)) / 100

    alpha = float(fitted.params.get("alpha[1]", 0))
    beta = float(fitted.params.get("beta[1]", 0))
    mu = float(fitted.params.get("mu", 0)) / 100
    nu = float(fitted.params.get("nu", 0))

    row = {
        "symbol": symbol,
        "last_price": df["close"].iloc[-1],
        "annualized_vol": annualized_vol,
        "forecast_vol_1d": forecast_vol_1d,
        "forecast_vol_7d": forecast_vol_7d,
        "mu": mu,
        "alpha": alpha,
        "beta": beta,
        "nu": nu,
        "persistence": alpha + beta,
    }

    for i, forecast_vol in enumerate(forecast_vols, start=1):
        row[f"forecast_vol_h{i}"] = forecast_vol

    results.append(row)

results_df = pd.DataFrame(results)
results_df.to_csv("data/garch_results.csv", index=False)
print("Saved analysis results to data/garch_results.csv")
