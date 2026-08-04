#!/bin/bash
# 每天自動執行：抓取最新價格 + 重新計算分析結果
# log 輸出到 /tmp/crypto-pattern-lab-update.log

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==== $(date '+%Y-%m-%d %H:%M:%S') Update started ====" >> /tmp/crypto-pattern-lab-update.log

cd "$PROJECT_DIR" || exit 1

python3 scripts/API調取-fetch_prices.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_patterns.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_fear_greed.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_rolling_correlation.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_garch.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_pattern_validation.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_bollinger.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_acf.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_walk_forward.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_rsi.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_month_seasonality.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_consecutive_drop.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_drawdown_recovery.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_halving.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_signals.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_regime_transition.py >> /tmp/crypto-pattern-lab-update.log 2>&1
python3 scripts/analyze_multifactor.py >> /tmp/crypto-pattern-lab-update.log 2>&1

echo "==== $(date '+%Y-%m-%d %H:%M:%S') Update finished ====" >> /tmp/crypto-pattern-lab-update.log
