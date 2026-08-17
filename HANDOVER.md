# CryptoPatternLab FYP 副本 項目交接文件 v22.0

## 產品定位
AI-powered crypto pattern research assistant。
- 短期：web-based research tool / demo  
- 中期：agent-like workflow  
- 長期：AI Agent 可嵌入交易軟件

## 競爭定位
Bloomberg Terminal 的分析深度 + AI 自動翻譯成人話 + 專注 Crypto，後續可擴展到股票市場。

## 目標客戶
- 活躍交易者
- 研究型內容創作者 / newsletter 作者
- 小型 research / analyst 團隊

---

## 副本特性（⚠️ 與主文件的本質區別）

**本副本是學術 FYP 版本：**
- ✅ **技術實作完全相同**：所有分析腳本、數據 CSV、XGBoost 模型、前端組件邏輯一致
- ❌ **無 Tier 系統**：沒有收費功能、DevTierSwitcher、TierGate 等權限控制
- ❌ **無商業字眼**：無定價頁、無升級 CTA、無 Pro/Research 標籤
- ✅ **全部功能開放**：所有 panel、所有分析工具無限制使用
- **GitHub**：`https://github.com/AnkeYan/crypto-pattern-lab-demo-FYP`（**Public**）
- **本地路徑**：`/Users/nganyukkuen/Desktop/crypto-pattern-lab-export/`
- **Vercel 網址**：`https://crypto-pattern-lab-demo-fyp.vercel.app`
- **用途**：FYP 提交（Department of Systems Engineering and Engineering Management，題目：Empirical Pattern of Cryptocurrencies）

**主文件（商業版）路徑：**
- **本地**：`/Users/nganyukkuen/Bob/crypto-pattern-lab/`
- **GitHub**：`https://github.com/AnkeYan/crypto-pattern-lab`（**Private**）
- **Vercel**：`https://crypto-pattern-lab.vercel.app`

---

## UI 同步原則（後續改動時務必遵守）

- ✅ **可同步的**：純 UI 組件（Panel、Chart、Table 等的展示邏輯）
- ❌ **不能同步的**：Tier 相關邏輯（useTier、TierGate、DevTierSwitcher）
- ❌ **不能同步的**：Layout 層改動（overflow-x-hidden 等副本特有的調整）
- **同步流程**：只複製無 Tier 的功能代碼，Tier 相關的自行刪除

### ⚠️ Tier 剝除 Checklist（每次 sync 前端後必須執行）
```
副本/web/src/app/page.tsx
  → 移除 TierGate import + 所有 <TierGate> 包裝
  → 移除 Pricing section（含 href="#pricing" 和任何收費字眼）
  → 移除 DevTierSwitcher import + 組件

副本/web/src/app/signals/page.tsx
  → 移除 TierGate import + 所有 <TierGate> 包裝
  → 保留 Panel 組件，直接顯示（不包 gate）

副本/web/src/app/components/ResearchTOC.tsx
  → 移除 tier 顏色點（• Pro / • Research 紫點）
  → 移除 Tier legend 區塊

副本/web/src/app/components/RsiPanel.tsx
副本/web/src/app/components/ResultsTable.tsx
副本/web/src/app/components/BollingerPanel.tsx
  → 移除 useTier import
  → isProUnlocked = true（或直接移除條件）

副本/web/src/app/lib/useTier.ts
  → 永遠回傳 "research"（所有函數返回 true）

副本/web/src/app/components/TierGate.tsx
  → 直接顯示 children，不做 blur gate

副本/web/src/app/components/DevTierSwitcher.tsx
  → 回傳 null
```

---

## 技術架構

**本地路徑**
```
/Users/nganyukkuen/Desktop/crypto-pattern-lab-export/
├── data/           ← CSV 分析結果
├── scripts/        ← Python 腳本（與主文件完全相同）
└── web/            ← Next.js 網頁（無 Tier 邏輯）
```

**Git commit 指令**
```bash
cd /Users/nganyukkuen/Desktop/crypto-pattern-lab-export && git pull --rebase && git add -A && git commit -m "..." && git push
```
**⚠️ 重要**：副本有 GitHub Actions 每天 UTC 03:00 自動 commit CSV，push 前必須先 `git pull --rebase`。

**GitHub Actions Python 依賴（已更新）：**
```
pandas numpy requests scipy arch statsmodels yfinance xgboost scikit-learn hmmlearn PyPortfolioOpt lightgbm
```

---

## 15 因子體系（v22.0，最新）

| 因子 | 權重 | 數據源 | XGBoost 使用版本 |
|------|------|--------|----------------|
| F1 RSI Oversold Intensity | 15% | 技術指標 | f1_cont（連續值） |
| F2 Bollinger Deviation | **7%** | 技術指標 | f2_cont（連續值，降 11→7 為 F15 讓位） |
| F3 GARCH Vol Regime | **6%** | 波動率模型 | f3_norm（校準版固定 0，XGBoost 移除，降 8→6） |
| F4 Fear & Greed Zone | 9% | Alternative.me | f4_norm（校準版固定 0，XGBoost 移除） |
| F5 Month Seasonality | 9% | 統計 | f5_cont（連續值） |
| F6 Regime Favorability | 9% | HMM 後驗概率 | f6_cont（Bull 後驗概率，替代規則版） |
| F7 Volume Surge | 6% | 成交量 | f7_cont（連續值，替代觸發式） |
| F8 Price Momentum | 6% | 技術指標 | f8_cont + f8_lag7 + f8_lag14 |
| F9 Funding Rate Sentiment | **5%** | Bybit 期貨 | f9_cont（連續值，降 7→5，F14 分出） |
| F10 Long/Short Ratio | **4%** | Bybit 期貨 | f10_norm（即時快照，校準版固定 0，XGBoost 移除，降 5→4） |
| F11 Active Addresses | 6% | Blockchain.com | f11_cont（連續值，BTC only；ETH/SOL 固定 0.5 噪音，XGBoost 已排除） |
| F12 Turbulence Index | 7% | 三幣種協方差 | f12_cont（連續值）+ f12_lag7 |
| F13 MVRV Valuation | 7% | CoinMetrics | f13_cont + f13_lag7 + f13_lag14 |
| **F14 Funding Rate Trend** | **2%** | Bybit（同 F9） | f14_cont + f14_lag7（7d 差值；費率急降=高分） |
| **F15 BTC Dominance Change** | **2%** | CoinGecko API | **Dashboard only**，不進 XGBoost（數據只有 30 天）|

**重要設計決策（連續版 `_cont` 特徵）：**
- `f2_norm`（Bollinger）、`f7_norm`（Volume）、`f9_norm`（Funding）的觸發式版本非零比例只有 4–7%，XGBoost 幾乎學不到
- 改為連續版 `_cont` 後 ETH AUC 從 0.464 大幅提升到 0.532+

**Lag Features：**
- f8_lag7, f8_lag14（Price Momentum 滯後）
- f12_lag7（Turbulence 滯後）
- f13_lag7, f13_lag14（MVRV 滯後，最強因子）
- MVRV Lag7/14 在所有幣種都進入 Top-5 重要性

---

## XGBoost v4.1 架構

**雙模型：**
- `XGBClassifier`：勝率（xgb_win_prob）
- `XGBRegressor`：7 天預期回報率（xgb_expected_ret）

**訓練設計：**
- **TRAIN_START = "2017-11-01"**：三個幣種統一起點（BTC 剔除 2014–2017 散戶主導時代雜訊）
- **ROLLING_YEARS = 3**：最終預測只用最近 3 年訓練
- **EMBARGO_DAYS = 7**：Purged Walk-Forward CV（防止數據洩露）

**幣種專屬特徵集（v22，移除 f3/f4/f10 + f15 噪音）：**
```
FEATURES_COMMON (ETH/SOL，16個)：
  連續版：f1/f2/f5/f6/f7/f8/f9/f12/f13/f14 的 _cont 版
  Lag：   f8_lag7, f8_lag14, f12_lag7, f13_lag7, f13_lag14, f14_lag7

FEATURES_BTC (BTC，17個)：
  FEATURES_COMMON + f11_cont（Active Addresses，BTC only 有效）

設計原因：
  f11_cont 在 ETH/SOL 全部固定 0.5（無鏈上數據）= 常數噪音 → 幣種專屬排除
  f15_cont 只有 30 天數據，calibration 99.9% 是 0.5 = 純噪音 → 不進 XGBoost
  get_features(symbol) 函數自動選擇對應特徵列表
```

**最新 Walk-Forward 結果：**
```
BTC: avg AUC=0.529（11 folds）— 剔除早期雜訊後 0.516→0.529
ETH: avg AUC=0.541（HMM f6_cont 後從 0.532→0.541）
SOL: avg AUC=0.505（最弱，MVRV 用 BTC 代理效果有限）

Feature Importance Top-5（BTC）: f13_lag7 > f13_lag14 > f12_cont > f8_cont > f6_cont
Feature Importance Top-5（ETH）: f13_lag7 > f6_cont > f12_cont > f1_cont > f8_cont
```

**主要指標：DirAcc（方向準確率），AUC 作為輔助參考**

---

## HMM Regime v2

**腳本**：`scripts/analyze_hmm_regime.py`
- `GaussianHMM(n_components=3)`：3 狀態（Bull/Sideways/Bear）
- 10 次隨機初始化，取最優
- 輸出 `data/hmm_posterior.csv`（逐日 Bull/Side/Bear 後驗概率）
- **f6_cont = Bull 後驗概率**（替代靜態 SMA 規則版）
- 優點：每天都有連續值，不是 0/1；比靜態 Regime 規則更能反映真實市場結構

---

## F12 Turbulence Index

**腳本**：`scripts/analyze_turbulence.py`
- 原理：Kritzman & Li (2010) **Mahalanobis distance**（馬氏距離）
- 衡量「多個資產同時異常」的程度（不只看單個資產波動）
- 數據：BTC/ETH/SOL 三幣種同時有數據才計算，從 **2021-05-20** 開始
  - 為什麼不從 2014 開始：SOL 2020 才上市，三幣種協方差矩陣需要三幣種同時有數據
- 輸出 `data/turbulence_history.csv`
- **f12_norm = 1.0 - turbulence_norm**（取反：平靜=高分，高 Turbulence 時信號失效）
- XGBoost 重要性：BTC #3 (0.131)，ETH #3 (0.150)，SOL #2 (0.189)

---

## F13 MVRV Valuation

**腳本**：`scripts/analyze_mvrv.py`
- 數據源：CoinMetrics 免費 API
- MVRV = Market Value / Realized Value（市值 / 已實現市值）
  - MVRV > 3.5：市場過熱，歷史頂部區域
  - MVRV < 1：市值低於已實現成本，強烈底部信號
- 數據範圍：BTC 2014+，ETH 2015+，SOL 無 MVRV → 用 BTC 代理
- 輸出 `data/mvrv_history.csv`

---

## Portfolio Optimization Panel（MVO）

**腳本**：`scripts/analyze_portfolio_optimization.py`
- 使用 PyPortfolioOpt（Markowitz MVO）
- 訓練期：2020-09-09 到 2024-12-31
- 輸出 `data/portfolio_optimization.csv`

**最新 MVO 結果：**
```
Max Sharpe:    BTC 57% + SOL 43%（ETH = 0%）
               年化回報 103.1%，波動率 77.7%，Sharpe 1.33
Min Volatility: BTC 100%

ETH 被排除原因：
  - Sharpe 最低（0.96 vs BTC 1.07 vs SOL 1.31）
  - 與 BTC 相關性最高（0.793），持有 ETH ≈ 持有第二個 BTC，無分散效果
  - SOL 相關性較低（0.533），分散效果更好
```

**前端組件**：`PortfolioOptimizationPanel.tsx`（Research tier，在 Research workspace）
- 兩種模式：Max Sharpe / Min Volatility
- SVG Pie chart（純手寫，不依賴外部庫）
- 歷史表現對比圖（等權重 vs MVO 配比）
- 雙語說明框、動態 Key Takeaway

---

## FinRL Crypto Backtest（實驗性，不在網站內）

**位置**：`/Users/nganyukkuen/FinRL/examples/`（**不在本 repo 內**）
- 完全獨立系統，不影響 CryptoPatternLab
- 只用基礎技術指標，**未接入 F1–F13 因子體系**

**2025 全年回測結果（供參考）：**
```
A2C:          return -12.7%  MDD -69.6%
PPO:          return -35.2%  MDD -62.2%
SAC:          return -12.5%  MDD -51.6%
Buy&Hold BTC: return  -6.3%  MDD -38.9%（2025 年 ETH/SOL 跌幅遠大於 BTC）
```

---

## 數據文件清單（完整）

```
data/
├── BTCUSDT.csv / ETHUSDT.csv / SOLUSDT.csv      ← yfinance（BTC 2014+/ETH 2017+/SOL 2020+）
├── pattern_results.csv
├── fear_greed_results.csv
├── rolling_correlation.csv
├── garch_results.csv
├── pattern_validation_results.csv
├── bollinger_results.csv / rsi_results.csv
├── acf_results.csv / ljung_box_results.csv
├── walk_forward_results.csv
├── regime_results.csv             ← HMM v2（GaussianHMM 3狀態）
├── signal_summary.csv / confluence_results.csv
├── month_seasonality_results.csv
├── consecutive_drop_results.csv / drawdown_recovery_results.csv
├── halving_results.csv / halving_price_path.csv
├── regime_transition_results.csv
├── multifactor_results.csv        ← 13因子（含 F12/F13）
├── multifactor_calibration.csv    ← 逐日歷史校準，含 f*_cont 連續版欄位
├── funding_rate_history.csv       ← Bybit API（BTC/ETH/SOL 逐日）
├── active_addresses_history.csv   ← Blockchain.com（BTC from 2009）
├── mvrv_history.csv               ← CoinMetrics（BTC 2014+/ETH 2015+/SOL BTC proxy）
├── hmm_posterior.csv              ← HMM 逐日 Bull/Side/Bear 後驗概率
├── turbulence_history.csv         ← Turbulence Index（2021-05-20 起）
├── portfolio_optimization.csv     ← MVO weights/metrics/history/frontier
├── xgb_results.csv               ← Walk-Forward AUC + DirAcc + RMSE
├── xgb_predictions.csv           ← xgb_win_prob / xgb_expected_ret
├── btc_dominance_history.csv     ← CoinGecko（F15，逐日累積）
├── btc_dominance_results.csv     ← F15 即時快照（BTC/ETH/SOL）
└── factor_ic_results.csv         ← Spearman IC + IC IR（v22 新增）
```
所有 CSV 同時存在 `data/` 和 `web/public/data/`（Vercel 用）。

---

## 腳本清單（23個，run_update.sh 執行順序）

```
API調取-fetch_prices.py              ← 必須第一個
analyze_patterns.py
analyze_fear_greed.py
analyze_rolling_correlation.py
analyze_garch.py
analyze_pattern_validation.py
analyze_bollinger.py / analyze_rsi.py
analyze_acf.py / analyze_walk_forward.py
analyze_month_seasonality.py
analyze_signals.py
analyze_regime_transition.py
analyze_futures_sentiment.py         ← Bybit F9/F10，增量策略
analyze_active_addresses.py          ← Blockchain.com F11
analyze_turbulence.py                ← F12，2021-05-20 起
analyze_mvrv.py                      ← F13，CoinMetrics
analyze_btc_dominance.py             ← F15，CoinGecko API，30 天回填 + 逐日增量
analyze_hmm_regime.py                ← HMM v2
analyze_regime_signal_efficacy.py    ← v20 新增，Regime 條件信號勝率 + Chi-square
analyze_multifactor.py               ← 必須在所有因子腳本之後
analyze_multifactor_calibration.py
analyze_factor_ic.py                 ← Spearman IC + IC IR，逐年計算，Factor 預測力驗證
analyze_xgboost.py                   ← 必須在 calibration 之後
analyze_ensemble.py                  ← v20 新增，XGBoost + LightGBM Ensemble；必須在 xgboost 之後
analyze_consecutive_drop.py / analyze_drawdown_recovery.py / analyze_halving.py
analyze_portfolio_optimization.py    ← MVO，最後執行
```

---

## 前端組件清單（26個）

| 組件 | 說明 |
|------|------|
| WorkspaceHeader | sticky header，3個 workspace tab |
| ResearchTOC | sticky sidebar（xl）/ pill bar（mobile）**無 Tier 顏色點** |
| TierGate | **直接顯示 children**（副本無 gate） |
| DevTierSwitcher | **回傳 null**（副本不顯示） |
| SummaryButton | Gemini 2.5 Flash AI 摘要 |
| ResultsTable | Table/Chart toggle，Wilson CI，**useTier 已移除** |
| FearGreedPanel | 5層情緒分析 |
| RsiPanel | RSI 超賣統計，**useTier 已移除** |
| BollingerPanel | BB 突破統計，**useTier 已移除** |
| MonthSeasonalityPanel | 月份季節性 |
| ConsecutiveDropPanel | 連跌分析 |
| RollingCorrelationChart | 60d 滾動相關係數 |
| GarchPanel | GARCH 波動率預測 |
| DrawdownRecoveryPanel | 回撤恢復分析 |
| HalvingPanel | 減半週期（n=4） |
| MonteCarloPanel | 純 JS 模擬 |
| PortfolioOptimizationPanel | MVO Max Sharpe/Min Vol，SVG pie chart |
| PatternValidationPanel | Discovery vs Validation split，三層防過擬合說明（v20 更新） |
| WalkForwardPanel | 滾動驗證 |
| AcfPanel | ACF/PACF + Ljung-Box |
| RegimeEfficacyPanel | **v20 新增**：Regime 條件信號勝率，Chi-square 顯著性，直接顯示（無 TierGate） |
| SignalIntelligencePanel | Regime + Confluence + 條件回報 |
| MultiFactorPanel | **13因子** + 歷史校準 + XGBoost v4.1（DirAcc/RMSE/Expected Ret）+ **Ensemble 區塊（v20）** |
| RegimeTransitionPanel | Markov Chain 轉換矩陣 |
| FactorIcPanel | **v22 新增**：各因子 Spearman IC + IC IR 驗證，Validation workspace |

---

## API Routes（24個）

```
/api/results / /api/summary / /api/fear-greed
/api/rolling-correlation / /api/garch / /api/pattern-validation
/api/bollinger / /api/rsi / /api/acf / /api/ljung-box
/api/walk-forward / /api/monte-carlo（純 JS）
/api/month-seasonality / /api/signals / /api/regime
/api/regime-transition / /api/multifactor
/api/multifactor-calibration → summary + scatter
/api/xgboost → folds（AUC/DirAcc/RMSE）+ importance + predictions（xgb_win_prob / xgb_expected_ret）
/api/regime-signal-efficacy → regime_signal_efficacy.csv（v20 新增）
/api/ensemble → ensemble_results.csv + ensemble_predictions.csv（v20 新增）
/api/consecutive-drop / /api/drawdown-recovery / /api/halving
/api/portfolio-optimization → weights/minvol_weights/metrics/history/frontier
/api/factor-ic → factor_ic_results.csv（v22 新增）
```

---

## 關鍵數據發現

- BTC RSI-14 < 30 後 7d：win rate 58.3%（n=170）
- ETH RSI-14 < 30 後 7d：win rate 48.7%（n=154）
- SOL RSI-14 < 30 後 7d：win rate 65.5%（n=87）
- Fear & Greed 與回報相關性：r≈0.007, p≈0.896（不顯著）
- GARCH persistence = 1.000 for BTC/ETH → IGARCH（正常現象）
- Multi-Factor 校準：BTC top 25% 勝率 62.9%（n=663）

### Factor IC 核心發現（v22，BTC）

| 因子 | IC IR | 評級 | 解讀 |
|------|-------|------|------|
| F13 MVRV | **+1.76** | Strong | 最強預測因子，跨年穩定 |
| F9 Funding Rate | **+1.41** | Strong | 期貨情緒指標，BTC 效果最佳 |
| F14 FR Trend | **+1.33** | Strong | 費率趨勢，補充 F9 當前水平 |
| F5 Month Seasonality | **+1.07** | Strong | 月份效應穩定 |
| F7 Volume | +0.38 | Weak | 有方向但不穩定 |
| F6 HMM Regime | **-0.20** | Noise | IC 為負（方向反？或 Regime 本身非預測性） |
| F12 Turbulence | **-0.15** | Noise | IC 為負（SOL -0.62，較明顯） |
| F1 RSI | +0.04 | Noise | IC 接近 0，但作為組合過濾條件仍有意義 |
| F2 Bollinger | +0.01 | Noise | IC 接近 0，同 F1 |

**IC 低 ≠ 因子無用**（RSI/Bollinger 是 Dashboard 的解釋性指標，非 XGBoost 預測核心）
**保持人工 Dashboard 權重**，XGBoost 自動學習真實因子重要性。

---

## 當前未完成 / 下一步

### 🔴 高優先
1. **前端 MultiFactorPanel how-to-read 說明更新**
   - 說明文字還在提「8 因子」或「11 因子」，需要更新到「13 因子 v4.1」
   - 注意：副本無 TierGate，但 panel 內說明框文字需同步

### 🟡 中優先
2. **Stacking/Ensemble（XGBoost + LightGBM）**
   - 三模型 ensemble，預計 DirAcc +2–4%
   - 主文件新建 `analyze_ensemble.py` → 同步到副本

3. **SOL AUC 提升**
   - SOL avg AUC = 0.505（最弱），考慮 SOL 專屬替代因子

### 🔵 長期
4. **SOPR / 更多鏈上指標**（Glassnode 免費層）
5. **LSTM 對比**（`analyze_lstm.py`）
6. **F1–F13 接入 FinRL RL state**（條件：DirAcc 先到 55%+）

---

## 本輪完成的所有改動（v18.0 + v19.0，本次對話）

### v18.0 新增（同步自主文件）

**F12 Turbulence Index：**
- `scripts/analyze_turbulence.py`：Mahalanobis distance，2021-05-20 起
- 加入 Multi-Factor Score（12因子），f12_norm = 1 - turbulence_norm

**Portfolio Optimization Panel：**
- `scripts/analyze_portfolio_optimization.py`：PyPortfolioOpt MVO
- `web/src/app/api/portfolio-optimization/route.ts`
- `web/src/app/components/PortfolioOptimizationPanel.tsx`
- Max Sharpe：BTC 57% + SOL 43%；Min Vol：BTC 100%

**XGBoost 結果（v18，12 因子）：**
```
BTC: avg AUC=0.513（F12 加入前）
ETH: avg AUC=0.464
SOL: avg AUC=0.491
F12 Turbulence 重要性：BTC #3/ETH #3/SOL #2
```

### v19.0 新增（同步自主文件）

**F13 MVRV：**
- `scripts/analyze_mvrv.py`：CoinMetrics 免費 API
- BTC 2014+，ETH 2015+，SOL 用 BTC 代理

**XGBoost v4.1（連續版特徵 + Lag Features + HMM f6_cont）：**
```
原始 → +F13 MVRV → +連續特徵+Lag → +HMM f6_cont → +剔除BTC早期雜訊
BTC AUC: 0.513 → 0.499 → 0.515 → 0.516 → 0.529
ETH AUC: 0.464 → 0.494 → 0.532 → 0.541 → 0.541
```

**HMM Regime v2：**
- `scripts/analyze_hmm_regime.py`：GaussianHMM 3狀態，10次初始化
- 輸出 `hmm_posterior.csv`，f6_cont = Bull 後驗概率

**TRAIN_START = "2017-11-01"**：BTC 剔除 2014–2017 雜訊

**前端 MultiFactorPanel：**
- 顯示 `xgb_expected_ret`、`DirAcc`、`RMSE`
- 表格標題：Acc → DirAcc + RMSE

**副本 Tier 污染修復（本輪已完成）：**
- `page.tsx`：移除 TierGate、Pricing section、DevTierSwitcher
- `ResearchTOC.tsx`：移除 tier 顏色點和 legend
- `RsiPanel.tsx` / `ResultsTable.tsx`：移除 useTier import

---

## 工作慣例（必須遵守）

- 一步一步來，完成一步才繼續
- 每步先詳細解釋知識點，再動手
- **主文件和副本務必分清楚，不要混淆**
- 每次對話結束時 git commit + push HANDOVER
- push 前先 `git pull --rebase`
- **主要指標是 DirAcc（方向準確率），AUC 只作輔助參考**
- 說明框全程中文，口語化，雙語（英/中）
- **凡是 UI 改動，主文件 + 副本必須同步**，但 Tier 邏輯只在主文件

---

## 本輪完成的所有改動（v20.0，本次對話）

### 副本同步項目（與主文件保持一致）

**腳本新增（主文件 + 副本同步）：**
- `scripts/analyze_regime_signal_efficacy.py` — Regime 條件信號勝率 + Chi-square 顯著性檢驗
- `scripts/analyze_ensemble.py` — XGBoost + LightGBM Soft Voting Ensemble

**腳本更新（同步）：**
- `scripts/analyze_multifactor.py` — 加入 F13 MVRV（第 13 個因子，WEIGHTS 總和維持 1.0）
- `scripts/run_update.sh` — 加入 `analyze_regime_signal_efficacy.py` + `analyze_ensemble.py`
- `.github/workflows/update-data.yml` — 同上；pip 依賴加入 `lightgbm` + `PyPortfolioOpt`

**前端組件新增（同步）：**
- `components/RegimeEfficacyPanel.tsx` — Bull/Bear/Sideways 信號勝率對比，Chi-square 顯著性，副本**無 TierGate 直接顯示**
- `components/PatternValidationPanel.tsx` — 說明框加入三層防過擬合設計（Discovery/Validation Split、Walk-Forward、Purged CV）

**前端組件更新（同步）：**
- `components/MultiFactorPanel.tsx` — F12/F13 加入 FACTOR_META/ORDER；說明框「8/10/11 因子」→「13 因子」；新增 Ensemble 區塊（XGB vs LGB vs Ensemble 逐年 AUC 對比）；AUC/DirAcc/RMSE 名詞解釋

**API 新增（同步）：**
- `/api/regime-signal-efficacy` — regime_signal_efficacy.csv
- `/api/ensemble` — ensemble_results.csv + ensemble_predictions.csv

**API 修復（同步）：**
- `/api/xgboost/route.ts` — 補上 `dir_acc`、`rmse`、`xgb_expected_ret` 欄位（之前漏寫導致前端顯示 `—`）

**頁面更新（注意：副本無 TierGate）：**
- `validation/page.tsx` — 加入 RegimeEfficacyPanel（副本直接顯示，無 TierGate 包裝）
- `signals/page.tsx` — 加入 ensemble API fetch + 傳入 MultiFactorPanel

**數據文件（同步）：**
- `data/regime_signal_efficacy.csv`、`data/ensemble_results.csv`、`data/ensemble_predictions.csv`
- `web/public/data/`（以上三個的副本）
- `web/public/data/xgb_results.csv` / `xgb_predictions.csv`（從主文件同步，確保兩邊數字一致）

### 關鍵實證發現（Regime 分析，BTC 7d）

| 信號 | Bull | Bear | Sideways | p 值 | 顯著？ |
|------|------|------|---------|------|------|
| Vol Spike | 71.9% | 43.9% | 53.8% | 0.001 | ✓ 顯著 |
| Drop3 | 62.6% | 61.9% | 50.8% | 0.054 | 接近顯著 |

**結論：信號有效性是 Regime-dependent 的**——這是 FYP 題目「Empirical Pattern of Cryptocurrencies」的核心實證發現之一。

### XGBoost v4.1 + Ensemble 最新結果

```
BTCUSDT: avg XGB AUC=0.529 | avg Ensemble AUC=0.532 | avg DirAcc=52.1%
ETHUSDT: avg XGB AUC=0.543 | avg Ensemble AUC=0.546 | avg DirAcc=48.9%
SOLUSDT: avg XGB AUC=0.514 | avg Ensemble AUC=0.511 | avg DirAcc=48.5%
```


---

## 下一步（v21 方向，與主文件同步）

### ✅ 已完成（v22）
- F14 Funding Rate Trend 加入因子體系（f14_cont + f14_lag7）✅
- F15 BTC Dominance Change（Dashboard only，不進 XGBoost）✅
- F11 ETH/SOL 噪音修復（幣種專屬 FEATURES，get_features(symbol)）✅
- Factor IC 分析（analyze_factor_ic.py + FactorIcPanel）✅
- Bug fix：ensemble.py f14_lag7 KeyError ✅

### 🔴 高優先（下一步）
1. **6 個新 Panels**（Factors Tab 用）
   - FundingRatePanel（F9 + F14，費率水平 + 趨勢）
   - MvrvPanel（F13，IC 最強，MVRV 走勢 + 超熱/超冷區間）
   - TurbulencePanel（F12，市場異常指數歷史，標出重大崩盤）
   - ActiveAddressesPanel（F11，BTC only，鏈上活躍地址趨勢）
   - BtcDominancePanel（F15，BTC 佔有率走勢 + 7d 變化率）
   - VolumeMomentumPanel（F7 + F8，成交量方向 + 動量指標）
   全部 Tier = Pro

2. **新增 Factors Tab**（WorkspaceHeader 第四個 tab）
   移入：GARCH（降至 Pro）、Drawdown Recovery（降至 Pro）、Rolling Correlation、以上 6 個新 Panel

3. **架構重組**
   - MultiFactorPanel 升至 Research tier
   - Monte Carlo + Portfolio Optimization 移至 Signals Tab
   - VolumeMomentumPanel 放 Validation Tab

### 已確認不做
- F16 Open Interest：數據不足，暫緩（等累積 1 年後再加）
- 用 IC 替換人工 Dashboard 權重：不做（Dashboard 是解釋性，XGBoost 已自動學習）

### 🟡 中優先（架構完成後）

目前 F3/F4/F10 XGBoost 重要性 = 0%，是無效佔位。候選新因子：

| 因子 | 數據源 | 原理 | 成本 |
|------|--------|------|------|
| **F14 Funding Rate Trend** | 現有 `funding_rate_history.csv` | 7d 變化方向（趨勢），與 F9 當前值互補 | 零成本 |
| **F15 BTC Dominance 變化率** | CoinGecko 免費 API | BTC 佔比上升 = 市場避險；對 ETH/SOL 尤其有效 | 免費無需 key |
| **F16 Open Interest 變化率** | Bybit API（已有連接）| 持倉量急增+價格不動 = 不穩定 | 免費已有 API |

執行順序：F14（零成本）→ F15 → F16

### 🟡 中優先
- **因子有效性時間序列分析（Factor Decay 可視化）**：用現有 `xgb_results.csv` 各年份 Feature Importance 繪製排名變化圖
- **SOPR 鏈上指標**：與 MVRV 組合做底部識別對比（Glassnode 免費層）

### 已確認待做的 ML 分支（按優先順序）
- ~~集成學習 Ensemble~~ ✅ 已完成
- **深度學習 LSTM** — 捕捉時序連續性，與 XGBoost 做 AUC 對比
- **強化學習 PPO/SAC** — 需 AUC 先到 0.55+
- **貝葉斯方法** — Bayesian Optimization 超參數自動調優
- **圖神經網絡 GNN** — 跨資產傳導關係圖

