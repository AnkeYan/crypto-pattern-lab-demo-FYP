"""
analyze_rl_backtest.py
RL Strategy Backtester — Factor-Driven Portfolio Agent
=======================================================
Uses the 15-factor daily history from multifactor_calibration.csv as RL state.
Trains a simple policy-gradient agent (REINFORCE with baseline) entirely in numpy —
no FinRL / stable-baselines3 / gym dependency required.

Compares four strategies on the same test window:
  1. RL Agent       — factor-driven dynamic allocation
  2. Equal Weight   — 1/3 BTC + 1/3 ETH + 1/3 SOL, rebalanced daily
  3. Buy & Hold BTC — 100% BTC, no trading
  4. MVO (static)   — weights from portfolio_optimization.csv (max-Sharpe)

Output (data/rl_backtest.csv):
  row_type  label   value   extra
  equity    date    rl_value  ew_value  bhbtc_value  mvo_value
  metrics   ...
  weights   ...
"""

import numpy as np
import pandas as pd
from pathlib import Path

# ── paths ──────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"
WEB_DATA = ROOT / "web" / "public" / "data"

# ── hyperparameters ─────────────────────────────────────────────────────────
TRAIN_YEARS  = 3        # rolling walk-forward train window (years)
TEST_YEARS   = 1        # test window (years)
LEARNING_RATE= 0.005
EPOCHS       = 120      # training epochs per walk-forward fold
GAMMA        = 0.99     # reward discount
TC_BPS       = 10       # transaction cost (basis points per side)
INITIAL_CASH = 10_000.0
SEED         = 42

np.random.seed(SEED)

# ── factor columns used as state ────────────────────────────────────────────
FACTOR_COLS = [
    "f1_cont", "f2_cont", "f5_cont", "f6_cont",
    "f7_cont", "f8_cont", "f9_cont", "f12_cont",
    "f13_cont", "f14_cont",
]
# f11_cont (Active Addresses) is BTC-only; f15_cont has < 1% coverage — both excluded
# to keep state dimension identical across all 3 coins

N_ASSETS = 3   # BTC, ETH, SOL
N_FACTORS= len(FACTOR_COLS)
STATE_DIM= N_ASSETS * N_FACTORS   # 30-dim state vector


# ═══════════════════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ═══════════════════════════════════════════════════════════════════════════

def load_data():
    """Return merged DataFrame with columns:
       date, btc_close, eth_close, sol_close,
       btc_f1..f10, eth_f1..f10, sol_f1..f10
    """
    cal = pd.read_csv(DATA_DIR / "multifactor_calibration.csv", parse_dates=["date"])

    prices = {}
    for sym, fname in [("btc","BTCUSDT.csv"),("eth","ETHUSDT.csv"),("sol","SOLUSDT.csv")]:
        p = pd.read_csv(DATA_DIR / fname)
        p["date"] = pd.to_datetime(p["open_time"], unit="ms").dt.normalize()
        prices[sym] = p[["date","close"]].rename(columns={"close": f"{sym}_close"})

    # factor pivot per coin
    def pivot_factors(symbol, prefix):
        sub = cal[cal["symbol"] == symbol][["date"] + FACTOR_COLS].copy()
        sub = sub.rename(columns={c: f"{prefix}_{c}" for c in FACTOR_COLS})
        return sub

    btc_f = pivot_factors("BTCUSDT", "btc")
    eth_f = pivot_factors("ETHUSDT", "eth")
    sol_f = pivot_factors("SOLUSDT", "sol")

    df = btc_f.merge(eth_f, on="date").merge(sol_f, on="date")
    df = df.merge(prices["btc"], on="date")
    df = df.merge(prices["eth"], on="date")
    df = df.merge(prices["sol"], on="date")
    df = df.dropna().sort_values("date").reset_index(drop=True)
    return df


# ═══════════════════════════════════════════════════════════════════════════
# 2. ENVIRONMENT
# ═══════════════════════════════════════════════════════════════════════════

class CryptoEnv:
    """Simple crypto portfolio environment.
    Action: softmax weights over [BTC, ETH, SOL] — continuous allocation.
    Reward: daily log return of portfolio minus transaction cost penalty.
    """
    def __init__(self, df: pd.DataFrame):
        self.df = df.reset_index(drop=True)
        self.n  = len(df)
        self.close_cols  = ["btc_close","eth_close","sol_close"]
        self.factor_cols = (
            [f"btc_{c}" for c in FACTOR_COLS] +
            [f"eth_{c}" for c in FACTOR_COLS] +
            [f"sol_{c}" for c in FACTOR_COLS]
        )
        self.reset()

    def reset(self):
        self.t      = 1          # start at 1 so we can look back one day
        self.weights= np.array([1/3, 1/3, 1/3])  # equal start
        self.value  = INITIAL_CASH
        self.history= []
        return self._state()

    def _state(self):
        row = self.df.iloc[self.t]
        s = np.array([row[c] for c in self.factor_cols], dtype=np.float32)
        # normalise to [-1, 1] (values are already [0,1] cont scores)
        return s * 2 - 1

    def step(self, new_weights: np.ndarray):
        """new_weights: shape (3,), already softmax-normalised."""
        t = self.t
        closes_prev = self.df.iloc[t-1][self.close_cols].values.astype(float)
        closes_curr = self.df.iloc[t  ][self.close_cols].values.astype(float)

        asset_returns = closes_curr / closes_prev - 1   # shape (3,)
        port_return   = np.dot(self.weights, asset_returns)

        # transaction cost proportional to portfolio turnover
        turnover = np.sum(np.abs(new_weights - self.weights))
        tc_drag  = turnover * TC_BPS / 10_000

        net_return    = port_return - tc_drag
        self.value   *= (1 + net_return)
        self.weights  = new_weights

        reward = np.log1p(net_return)   # log return as reward signal
        self.history.append({
            "date": self.df.iloc[t]["date"],
            "value": self.value,
            "weights": new_weights.copy(),
            "port_return": port_return,
            "net_return": net_return,
        })

        self.t += 1
        done = (self.t >= self.n)
        state = self._state() if not done else np.zeros(STATE_DIM)
        return state, reward, done


# ═══════════════════════════════════════════════════════════════════════════
# 3. POLICY NETWORK (linear softmax — interpretable, fast)
# ═══════════════════════════════════════════════════════════════════════════

class LinearSoftmaxPolicy:
    """W: (N_ASSETS, STATE_DIM)  b: (N_ASSETS,)"""
    def __init__(self):
        self.W = np.random.randn(N_ASSETS, STATE_DIM).astype(np.float32) * 0.01
        self.b = np.zeros(N_ASSETS, dtype=np.float32)

    def forward(self, state: np.ndarray) -> np.ndarray:
        logits = self.W @ state + self.b
        logits -= logits.max()
        e = np.exp(logits)
        return e / e.sum()

    def log_prob(self, state: np.ndarray, weights: np.ndarray) -> float:
        probs = self.forward(state)
        # approximate log-prob with entropy-like term (continuous action)
        return float(np.dot(weights, np.log(probs + 1e-8)))

    def update(self, grads_W, grads_b, lr: float):
        self.W += lr * grads_W
        self.b += lr * grads_b

    def copy(self):
        p = LinearSoftmaxPolicy()
        p.W = self.W.copy()
        p.b = self.b.copy()
        return p


# ═══════════════════════════════════════════════════════════════════════════
# 4. TRAINING (REINFORCE with baseline)
# ═══════════════════════════════════════════════════════════════════════════

def train(policy: LinearSoftmaxPolicy, train_df: pd.DataFrame, epochs: int) -> LinearSoftmaxPolicy:
    best_policy = policy.copy()
    best_sharpe = -np.inf

    for epoch in range(epochs):
        env = CryptoEnv(train_df)
        state = env.reset()
        episode_states, episode_actions, episode_rewards = [], [], []

        done = False
        while not done:
            weights = policy.forward(state)
            # add small noise for exploration
            noise = np.random.dirichlet(np.ones(N_ASSETS) * 3) * 0.05
            weights = (1 - 0.05) * weights + noise
            weights /= weights.sum()

            next_state, reward, done = env.step(weights)
            episode_states.append(state)
            episode_actions.append(weights)
            episode_rewards.append(reward)
            state = next_state

        # discounted returns
        T = len(episode_rewards)
        returns = np.zeros(T)
        G = 0.0
        for t in reversed(range(T)):
            G = episode_rewards[t] + GAMMA * G
            returns[t] = G

        # baseline (mean)
        baseline = returns.mean()
        advantages = returns - baseline

        # policy gradient update
        grad_W = np.zeros_like(policy.W)
        grad_b = np.zeros_like(policy.b)
        lr_decay = LEARNING_RATE * (1 / (1 + 0.01 * epoch))

        for t in range(T):
            s = episode_states[t]
            a = episode_actions[t]
            probs = policy.forward(s)
            adv   = advantages[t]

            # gradient of log π(a|s) w.r.t. logits (softmax jacobian)
            jac = np.diag(probs) - np.outer(probs, probs)
            d_log_pi = jac @ (a / (probs + 1e-8))   # shape (N_ASSETS,)
            grad_W += adv * np.outer(d_log_pi, s)
            grad_b += adv * d_log_pi

        policy.update(grad_W / T, grad_b / T, lr_decay)

        # track best Sharpe
        rets_arr = np.array(episode_rewards)
        if rets_arr.std() > 1e-8:
            sharpe = (rets_arr.mean() / rets_arr.std()) * np.sqrt(252)
            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_policy = policy.copy()

    return best_policy


# ═══════════════════════════════════════════════════════════════════════════
# 5. WALK-FORWARD BACKTEST
# ═══════════════════════════════════════════════════════════════════════════

def run_backtest(df: pd.DataFrame):
    """Walk-forward: train on TRAIN_YEARS rolling window, test on TEST_YEARS."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])

    train_days = TRAIN_YEARS * 365
    test_days  = TEST_YEARS  * 365

    # collect out-of-sample episodes
    all_history = []
    fold = 0

    i = train_days
    while i + test_days <= len(df):
        train_df = df.iloc[i - train_days : i].reset_index(drop=True)
        test_df  = df.iloc[i            : i + test_days].reset_index(drop=True)

        print(f"  Fold {fold+1}: train {train_df['date'].iloc[0].date()} "
              f"→ {train_df['date'].iloc[-1].date()} | "
              f"test {test_df['date'].iloc[0].date()} "
              f"→ {test_df['date'].iloc[-1].date()}")

        policy = LinearSoftmaxPolicy()
        policy = train(policy, train_df, epochs=EPOCHS)

        # run policy on test set
        env = CryptoEnv(test_df)
        state = env.reset()
        done = False
        while not done:
            weights = policy.forward(state)
            state, _, done = env.step(weights)

        for h in env.history:
            h["fold"] = fold
        all_history.extend(env.history)

        i += test_days
        fold += 1

    return all_history


# ═══════════════════════════════════════════════════════════════════════════
# 6. BASELINES
# ═══════════════════════════════════════════════════════════════════════════

def compute_baselines(df: pd.DataFrame, test_dates):
    """Compute equal-weight and buy-and-hold BTC equity curves for the same dates."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df[df["date"].isin(test_dates)].reset_index(drop=True)

    ew_value   = INITIAL_CASH
    bhbtc_value= INITIAL_CASH
    ew_hist, bhbtc_hist = [], []

    for i in range(1, len(df)):
        btc_r = df.iloc[i]["btc_close"] / df.iloc[i-1]["btc_close"] - 1
        eth_r = df.iloc[i]["eth_close"] / df.iloc[i-1]["eth_close"] - 1
        sol_r = df.iloc[i]["sol_close"] / df.iloc[i-1]["sol_close"] - 1

        ew_r    = (btc_r + eth_r + sol_r) / 3
        ew_value   *= (1 + ew_r)
        bhbtc_value*= (1 + btc_r)

        d = df.iloc[i]["date"]
        ew_hist.append({"date": d, "value": ew_value})
        bhbtc_hist.append({"date": d, "value": bhbtc_value})

    return (
        pd.DataFrame(ew_hist).set_index("date"),
        pd.DataFrame(bhbtc_hist).set_index("date"),
    )


def compute_mvo_curve(df: pd.DataFrame, test_dates):
    """Compute MVO portfolio equity curve using weights from portfolio_optimization.csv."""
    try:
        po = pd.read_csv(DATA_DIR / "portfolio_optimization.csv")
        w_rows = po[po["row_type"] == "weights"]
        btc_w = float(w_rows[w_rows["label"]=="BTC"]["value"].iloc[0])
        eth_w = float(w_rows[w_rows["label"]=="ETH"]["value"].iloc[0])
        sol_w = float(w_rows[w_rows["label"]=="SOL"]["value"].iloc[0])
    except Exception:
        btc_w, eth_w, sol_w = 1/3, 1/3, 1/3

    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df[df["date"].isin(test_dates)].reset_index(drop=True)

    mvo_value = INITIAL_CASH
    mvo_hist  = []
    for i in range(1, len(df)):
        btc_r = df.iloc[i]["btc_close"] / df.iloc[i-1]["btc_close"] - 1
        eth_r = df.iloc[i]["eth_close"] / df.iloc[i-1]["eth_close"] - 1
        sol_r = df.iloc[i]["sol_close"] / df.iloc[i-1]["sol_close"] - 1
        mvo_r = btc_w * btc_r + eth_w * eth_r + sol_w * sol_r
        mvo_value *= (1 + mvo_r)
        mvo_hist.append({"date": df.iloc[i]["date"], "value": mvo_value})

    return pd.DataFrame(mvo_hist).set_index("date")


# ═══════════════════════════════════════════════════════════════════════════
# 7. METRICS
# ═══════════════════════════════════════════════════════════════════════════

def compute_metrics(values: np.ndarray, label: str) -> dict:
    daily_rets = np.diff(values) / values[:-1]
    total_ret  = values[-1] / values[0] - 1
    ann_ret    = (1 + total_ret) ** (252 / len(daily_rets)) - 1
    ann_vol    = daily_rets.std() * np.sqrt(252)
    sharpe     = ann_ret / ann_vol if ann_vol > 1e-8 else 0.0
    # max drawdown
    peak = np.maximum.accumulate(values)
    dd   = (values - peak) / peak
    mdd  = dd.min()
    return {
        "label":    label,
        "total_ret":round(total_ret  * 100, 2),
        "ann_ret":  round(ann_ret    * 100, 2),
        "ann_vol":  round(ann_vol    * 100, 2),
        "sharpe":   round(sharpe, 3),
        "max_dd":   round(mdd * 100, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════
# 8. MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    print("Loading data...")
    df = load_data()
    print(f"  Merged dataset: {len(df)} rows, {df['date'].min().date()} → {df['date'].max().date()}")

    print("Running walk-forward RL backtest...")
    history = run_backtest(df)

    if not history:
        print("ERROR: no test history generated.")
        return

    hist_df = pd.DataFrame(history)
    hist_df["date"] = pd.to_datetime(hist_df["date"])

    # normalise RL equity curve to start at INITIAL_CASH
    rl_start = hist_df["value"].iloc[0]
    hist_df["value"] = hist_df["value"] / rl_start * INITIAL_CASH

    test_dates = set(hist_df["date"])

    print("Computing baselines...")
    ew_df, bhbtc_df = compute_baselines(df, test_dates)
    mvo_df = compute_mvo_curve(df, test_dates)

    # align all curves on RL dates (RL sets the reference)
    rl_series = hist_df.set_index("date")["value"]
    ew_series    = ew_df["value"].reindex(rl_series.index).ffill()
    bhbtc_series = bhbtc_df["value"].reindex(rl_series.index).ffill()
    mvo_series   = mvo_df["value"].reindex(rl_series.index).ffill()

    # normalise baselines to same start
    for s in [ew_series, bhbtc_series, mvo_series]:
        s.iloc[0] = INITIAL_CASH

    print("Building output CSV...")
    rows = []

    # equity curve rows
    for date in rl_series.index:
        rows.append({
            "row_type": "equity",
            "label":    date.strftime("%Y-%m-%d"),
            "value":    round(float(rl_series[date]),    4),
            "extra1":   round(float(ew_series.get(date,    np.nan)), 4),
            "extra2":   round(float(bhbtc_series.get(date, np.nan)), 4),
            "extra3":   round(float(mvo_series.get(date,   np.nan)), 4),
        })

    # weight history (monthly, for chart)
    monthly_weights = []
    prev_month = None
    for h in history:
        d = pd.Timestamp(h["date"])
        if d.month != prev_month:
            monthly_weights.append({
                "row_type": "weights",
                "label":    d.strftime("%Y-%m-%d"),
                "value":    round(float(h["weights"][0]), 4),   # BTC
                "extra1":   round(float(h["weights"][1]), 4),   # ETH
                "extra2":   round(float(h["weights"][2]), 4),   # SOL
                "extra3":   None,
            })
            prev_month = d.month

    rows.extend(monthly_weights)

    # metrics rows
    rl_vals    = rl_series.values
    ew_vals    = ew_series.ffill().values
    bhbtc_vals = bhbtc_series.ffill().values
    mvo_vals   = mvo_series.ffill().values

    for m in [
        compute_metrics(rl_vals,    "RL Agent"),
        compute_metrics(ew_vals,    "Equal Weight"),
        compute_metrics(bhbtc_vals, "Buy & Hold BTC"),
        compute_metrics(mvo_vals,   "MVO (Max Sharpe)"),
    ]:
        rows.append({
            "row_type": "metrics",
            "label":    m["label"],
            "value":    m["total_ret"],
            "extra1":   m["ann_ret"],
            "extra2":   m["sharpe"],
            "extra3":   m["max_dd"],
        })

    # metadata
    rows.append({
        "row_type": "meta",
        "label":    "train_years",
        "value":    TRAIN_YEARS,
        "extra1":   None, "extra2": None, "extra3": None,
    })
    rows.append({
        "row_type": "meta",
        "label":    "test_start",
        "value":    None,
        "extra1":   rl_series.index[0].strftime("%Y-%m-%d"),
        "extra2":   rl_series.index[-1].strftime("%Y-%m-%d"),
        "extra3":   None,
    })
    rows.append({
        "row_type": "meta",
        "label":    "factors_used",
        "value":    len(FACTOR_COLS) * N_ASSETS,
        "extra1":   ",".join(FACTOR_COLS),
        "extra2":   None, "extra3": None,
    })

    out_df = pd.DataFrame(rows)

    for path in [DATA_DIR / "rl_backtest.csv", WEB_DATA / "rl_backtest.csv"]:
        path.parent.mkdir(parents=True, exist_ok=True)
        out_df.to_csv(path, index=False)
        print(f"  Saved → {path}")

    # print summary
    print("\n=== Backtest Summary ===")
    for r in rows:
        if r["row_type"] == "metrics":
            print(f"  {r['label']:20s} | Total {r['value']:+.1f}%  Ann {r['extra1']:+.1f}%  Sharpe {r['extra2']:.3f}  MDD {r['extra3']:.1f}%")


if __name__ == "__main__":
    main()
