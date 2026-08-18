# CryptoPatternLab FYP 副本 項目交接文件 v23.0

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
- ❌ **無商業字眼**：無定價頁、無升級 CTA、無 Pro/Research 標籤、無 Tier 顏色點
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

- ✅ **可同步的**：純 UI 組件展示邏輯（Panel、Chart、Table、TOC 導航功能）
- ❌ **不能同步的**：Tier 相關視覺（顏色點、badge、legend、TierGate blur gate、CTA）
- ❌ **不能同步的**：useTier、TierGate（功能）、DevTierSwitcher
- **同步後必問**：「這個視覺元素是為了區分誰能看/誰不能看嗎？」→ 是則副本移除

### ⚠️ Tier 剝除 Checklist（每次 sync 後必須執行）
```
副本/web/src/app/page.tsx
  → 移除 TierGate import + 所有 <TierGate> 包裝
  → 移除 Pricing section
  → 移除 DevTierSwitcher

副本/web/src/app/signals/page.tsx
副本/web/src/app/validation/page.tsx
副本/web/src/app/factors/page.tsx
  → TierGate 已是直接顯示 children，無需額外處理
  → 確認沒有 tier badge / legend 殘留

副本/web/src/app/components/ResearchTOC.tsx
副本/web/src/app/components/WorkspaceTOC.tsx
  → 純導航，無 tier 顏色點、無 legend、無 TIER_DOT

副本/web/src/app/components/RsiPanel.tsx
副本/web/src/app/components/ResultsTable.tsx
副本/web/src/app/components/BollingerPanel.tsx
  → 移除 useTier import，isProUnlocked = true

副本/web/src/app/lib/useTier.ts
  → 永遠回傳 "research"

副本/web/src/app/components/TierGate.tsx
  → 直接顯示 children

副本/web/src/app/components/DevTierSwitcher.tsx
  → 回傳 null
```

### ⚠️ 主文件 / 副本組件不能互相覆蓋
- 主文件 ResearchTOC / WorkspaceTOC **有** tier 顏色點 + legend
- 副本 ResearchTOC / WorkspaceTOC **無** 任何 tier 元素
- `cp` 前必須確認 comment 頭不含「FYP 副本版」字樣

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
cd /Users/nganyukkuen/Desktop/crypto-pattern-lab-export
git add -A && git stash && git pull --rebase && git stash pop && git add -A && git commit -m "..." && git push
```
**⚠️ 重要**：副本有 GitHub Actions 每天 UTC 03:00 自動 commit CSV，push 前必須先 stash + pull --rebase。

**GitHub Actions Python 依賴（已更新）：**
```
pandas numpy requests scipy arch statsmodels yfinance xgboost scikit-learn hmmlearn PyPortfolioOpt lightgbm
```

---

## 15 因子體系（v23.0，最新）

| 因子 | 權重 | 數據源 | XGBoost 使用版本 |
|------|------|--------|----------------|
| F1 RSI Oversold Intensity | 15% | 技術指標 | f1_cont |
| F2 Bollinger Deviation | 7% | 技術指標 | f2_cont |
| F3 GARCH Vol Regime | 6% | 波動率模型 | f3_norm（XGBoost 移除） |
| F4 Fear & Greed Zone | 9% | Alternative.me | f4_norm（XGBoost 移除） |
| F5 Month Seasonality | 9% | 統計 | f5_cont |
| F6 Regime Favorability | 9% | HMM 後驗概率 | f6_cont（Bull 後驗概率） |
| F7 Volume Surge | 6% | 成交量 | f7_cont |
| F8 Price Momentum | 6% | 技術指標 | f8_cont + f8_lag7 + f8_lag14 |
| F9 Funding Rate Sentiment | 5% | Bybit 期貨 | f9_cont |
| F10 Long/Short Ratio | 4% | Bybit 期貨 | f10_norm（XGBoost 移除） |
| F11 Active Addresses | 6% | Blockchain.com | f11_cont（BTC only） |
| F12 Turbulence Index | 7% | 三幣種協方差 | f12_cont + f12_lag7 |
| F13 MVRV Valuation | 7% | CoinMetrics | f13_cont + f13_lag7 + f13_lag14 |
| F14 Funding Rate Trend | 2% | Bybit（同 F9） | f14_cont + f14_lag7 |
| F15 BTC Dominance Change | 2% | CoinGecko API | **Dashboard only**，不進 XGBoost |

**幣種專屬特徵集：**
```
FEATURES_COMMON (ETH/SOL，16個)：f1/f2/f5/f6/f7/f8/f9/f12/f13/f14 _cont + lags
FEATURES_BTC   (BTC，17個)：FEATURES_COMMON + f11_cont
f15 不進 XGBoost（只有 30 天數據）
```

---

## XGBoost v4.1 + Ensemble 最新結果

```
BTC: XGB AUC=0.529 | Ensemble AUC=0.532 | DirAcc=52.1%
ETH: XGB AUC=0.543 | Ensemble AUC=0.546 | DirAcc=48.9%
SOL: XGB AUC=0.514 | Ensemble AUC=0.511 | DirAcc=48.5%
```
Feature Importance Top-5（BTC）: f13_lag7 > f13_lag14 > f12_cont > f8_cont > f6_cont
**主要指標：DirAcc（方向準確率），AUC 只作輔助**

---

## Factor IC 核心發現（v22）

| 因子 | IC IR | 評級 |
|------|-------|------|
| F13 MVRV | **+1.76** | Strong · 耐久型 |
| F9 Funding Rate | **+1.41** | Strong · 耐久型 |
| F14 FR Trend | **+1.33** | Strong · 耐久型 |
| F5 Month Seasonality | **+1.07** | Strong · 耐久型 |
| F7 Volume | +0.38 | Weak |
| F6 HMM Regime | -0.20 | Noise |
| F12 Turbulence | -0.15 | Noise |
| F1 RSI | +0.04 | Noise |
| F2 Bollinger | +0.01 | Noise |

IC IR 低 ≠ 因子無用（RSI/Bollinger 是解釋性指標，XGBoost 自動學習真實重要性）

---

## Workspace 架構（v23，最終版）

```
Research  /          → AI Summary（Free）· Pattern Results（Free）· Fear&Greed（Free）
                       RSI（Pro）· Bollinger（Pro）· Seasonality（Pro）· Drop（Pro）
                       Halving（Pro）
                       ResearchTOC: 8個條目，有 tier 顏色點（主文件）/ 純導航（副本）

Validation /validation → Pattern Validation（Pro）· Regime Efficacy（Pro）
                          Rolling Correlation（Pro）· Volume Momentum（Pro）
                          Walk-Forward（Research）· ACF/PACF（Research）
                          Factor IC + Factor Decay（Research）
                          WorkspaceTOC: 7個條目（cyan）

Signals   /signals    → Signal Intelligence（Pro）· Multi-Factor Score（Pro）
                          Monte Carlo（Pro）
                          Regime Transition（Research）· Portfolio Optimization（Research）
                          WorkspaceTOC: 5個條目（purple）

Factors   /factors    → Funding Rate（Pro）· BTC Dominance（Pro）
                          Active Addresses（Pro）· Drawdown Recovery（Pro）
                          MVRV（Research）· Turbulence（Research）· GARCH（Research）
                          WorkspaceTOC: 7個條目（amber）
```

**Tier 分布：Free 3 · Pro 15 · Research 8**
**設計原則：越高難度越需要學識的 panel 越貴**

---

## Tier 邏輯（主文件，商業版）

### 三個 Tier 定義
| Tier | 價格 | 目標用戶 | 定義 |
|------|------|---------|------|
| Free | $0 | 路過的好奇者 | 結論型——看得懂，無需任何背景 |
| Pro | $29/mo | 活躍交易者 | 工具型——需要市場知識，無需 quant 背景 |
| Research | $79/mo | Quant/分析師/FYP | 模型型——需要統計/ML 知識才能解讀 |

### 技術實作
- `useTier()` — 讀 localStorage `cpl_dev_tier`
- `hasAccess(userTier, requiredTier)` — TIER_RANK: free=0, pro=1, research=2
- `TierGate` — blur gate + CTA；`title` + `description` 必填
- `DevTierSwitcher` — `?dev=true` 才顯示（本地開發自動顯示）
- `ResearchTOC` / `WorkspaceTOC` — 主文件有 tier 顏色點（🟢Free 🔵Pro 🟣Research）+ legend

---

## 腳本清單（25個，run_update.sh 執行順序）

```
API調取-fetch_prices.py
analyze_patterns.py
analyze_fear_greed.py
analyze_rolling_correlation.py
analyze_garch.py / analyze_pattern_validation.py
analyze_bollinger.py / analyze_rsi.py
analyze_acf.py / analyze_walk_forward.py
analyze_month_seasonality.py
analyze_signals.py
analyze_regime_transition.py
analyze_futures_sentiment.py         ← Bybit F9/F10
analyze_active_addresses.py          ← Blockchain.com F11
analyze_turbulence.py                ← F12
analyze_mvrv.py                      ← F13，CoinMetrics
analyze_btc_dominance.py             ← F15，CoinGecko
analyze_hmm_regime.py                ← HMM v2
analyze_regime_signal_efficacy.py    ← Chi-square
analyze_multifactor.py
analyze_multifactor_calibration.py
analyze_factor_ic.py                 ← Spearman IC + IC IR
analyze_xgboost.py
analyze_ensemble.py                  ← XGBoost + LightGBM
analyze_consecutive_drop.py / analyze_drawdown_recovery.py / analyze_halving.py
analyze_portfolio_optimization.py    ← 最後執行
```

---

## 前端組件清單（v23，33個）

### 共用
| 組件 | 說明 |
|------|------|
| WorkspaceHeader | sticky header，4個 tab（Research/Validation/Signals/Factors）|
| ResearchTOC | Research sidebar/pill，主文件有 tier 顏色點，副本純導航 |
| WorkspaceTOC | 通用 sidebar/pill，Validation/Signals/Factors 用，同上 |
| TierGate | 主文件：blur gate + CTA；副本：直接顯示 children |
| DevTierSwitcher | 主文件：?dev=true 顯示；副本：回傳 null |

### Research workspace
| 組件 | Tier |
|------|------|
| SummaryButton | Free |
| ResultsTable | Free |
| FearGreedPanel | Free |
| RsiPanel | Pro |
| BollingerPanel | Pro |
| MonthSeasonalityPanel | Pro |
| ConsecutiveDropPanel | Pro |
| HalvingPanel | Pro |

### Validation workspace
| 組件 | Tier |
|------|------|
| PatternValidationPanel | Pro |
| RegimeEfficacyPanel | Pro |
| RollingCorrelationChart | Pro |
| VolumeMomentumPanel | Pro |
| WalkForwardPanel | Research |
| AcfPanel | Research |
| FactorIcPanel | Research（含 IC by Year · Factor Decay tab）|

### Signals workspace
| 組件 | Tier |
|------|------|
| SignalIntelligencePanel | Pro |
| MultiFactorPanel | Pro（Dashboard）/ Research（XGBoost+Ensemble）|
| MonteCarloPanel | Pro |
| RegimeTransitionPanel | Research |
| PortfolioOptimizationPanel | Research |

### Factors workspace
| 組件 | Tier |
|------|------|
| FundingRatePanel | Pro |
| BtcDominancePanel | Pro |
| ActiveAddressesPanel | Pro |
| DrawdownRecoveryPanel | Pro |
| MvrvPanel | Research |
| TurbulencePanel | Research |
| GarchPanel | Research |

---

## API Routes（30個）

```
/api/results / /api/summary / /api/fear-greed
/api/rolling-correlation / /api/garch / /api/pattern-validation
/api/bollinger / /api/rsi / /api/acf / /api/ljung-box
/api/walk-forward / /api/monte-carlo
/api/month-seasonality / /api/signals / /api/regime
/api/regime-transition / /api/multifactor
/api/multifactor-calibration
/api/xgboost / /api/ensemble
/api/regime-signal-efficacy
/api/consecutive-drop / /api/drawdown-recovery / /api/halving
/api/portfolio-optimization
/api/factor-ic
/api/funding-rate-history
/api/mvrv-history
/api/turbulence-history
/api/active-addresses-history
/api/btc-dominance-history
```

---

## 數據文件清單（完整）

```
data/
├── BTCUSDT.csv / ETHUSDT.csv / SOLUSDT.csv
├── pattern_results.csv / fear_greed_results.csv
├── rolling_correlation.csv / garch_results.csv
├── pattern_validation_results.csv
├── bollinger_results.csv / rsi_results.csv
├── acf_results.csv / ljung_box_results.csv
├── walk_forward_results.csv
├── regime_results.csv / signal_summary.csv / confluence_results.csv
├── month_seasonality_results.csv
├── consecutive_drop_results.csv / drawdown_recovery_results.csv
├── halving_results.csv / halving_price_path.csv
├── regime_transition_results.csv
├── multifactor_results.csv / multifactor_calibration.csv
├── funding_rate_history.csv / active_addresses_history.csv
├── mvrv_history.csv / hmm_posterior.csv / turbulence_history.csv
├── portfolio_optimization.csv
├── xgb_results.csv / xgb_predictions.csv
├── regime_signal_efficacy.csv
├── ensemble_results.csv / ensemble_predictions.csv
├── btc_dominance_history.csv / btc_dominance_results.csv
└── factor_ic_results.csv
```
所有 CSV 同時在 `data/` 和 `web/public/data/`（Vercel 用）。

---

## 關鍵數據發現

- BTC RSI-14 < 30 後 7d：win rate 58.3%（n=170）
- ETH RSI-14 < 30 後 7d：win rate 48.7%（n=154）
- SOL RSI-14 < 30 後 7d：win rate 65.5%（n=87）
- Fear & Greed 與回報相關性：r≈0.007, p≈0.896（不顯著）
- GARCH persistence = 1.000 → IGARCH（BTC/ETH）
- Multi-Factor 校準：BTC top 25% 勝率 62.9%（n=663）
- MVO Max Sharpe：BTC 57% + SOL 43%（ETH = 0%，Sharpe 最低）

### Regime 信號有效性（FYP 核心實證發現）
| 信號 | Bull | Bear | Sideways | p值 | 顯著？ |
|------|------|------|---------|-----|------|
| Vol Spike | 71.9% | 43.9% | 53.8% | 0.001 | ✓ |
| Drop3 | 62.6% | 61.9% | 50.8% | 0.054 | 接近顯著 |
**結論：信號有效性是 Regime-dependent 的**

---

## 當前未完成 / 下一步（v23 → v24）

### ✅ 已完成（v22–v23）
- F14 Funding Rate Trend + F15 BTC Dominance（Dashboard only）✅
- F11 ETH/SOL 噪音修復（幣種專屬 FEATURES）✅
- Factor IC 分析（analyze_factor_ic.py + FactorIcPanel）✅
- **Factor Decay 可視化**（IC by Year tab + SparkLine in table）✅
- **Factors workspace**（/factors，7個 panels，4個 section）✅
- **WorkspaceTOC**（四個 tab 全部有 sticky sidebar + mobile pill bar）✅
- **Tier 重新設計**（Free 3 / Pro 15 / Research 8，難度原則）✅
- 架構重組（Research 精簡 / Validation 加 2 panels / Signals 加 Monte Carlo + Portfolio）✅
- ensemble.py f14_lag7 KeyError 修復 ✅

### 🔴 高優先
1. **F16 Open Interest 變化率**（Bybit API 已有）
   - 數據只有 30 天，需等累積 1 年後才加入 XGBoost
   - 現在可先做 Dashboard panel（類似 F15）
   
2. **Pricing section 文字更新**（主文件 page.tsx）
   - TierGate CTA 文字還有「6 models」/ 舊版描述，需對應新 tier 結構更新

### 🟡 中優先
3. **SOL AUC 提升**（目前 0.514，最弱）
   - 候選：SOL 專屬鏈上因子（Solana 活躍地址）
   - F15 BTC Dominance 加入 XGBoost 後可能改善（等數據累積）

4. **多因子說明更新**（MultiFactorPanel 說明框還有部分舊文字）

### 🔵 長期 ML 分支
- LSTM → RL(AUC 0.55+) → Transformer → GNN
- SOPR 鏈上指標（Glassnode）
- 登入系統 + Stripe（前提：先有真實用戶）

### ⚪ 暫緩
- F16 Open Interest（待數據累積）
- CPI/利率（需 FRED API key）
- AR/ARMA（lag1 太弱）

---

## ML 方法記錄（已用）
- 監督學習分類：XGBoost Classifier
- 監督學習回歸：XGBoost Regressor
- 集成學習：XGBoost + LightGBM Soft Voting
- 無監督序列：HMM GaussianHMM 3狀態
- 統計學習：GARCH(1,1) + t分佈
- 投資組合優化：Markowitz MVO
- 統計檢驗：Wilson CI、Ljung-Box、Chi-square
- 因子評估：Spearman IC / IC IR（含逐年 Factor Decay）

---

## 工作慣例（必須遵守）
- 一步一步來，完成一步才繼續
- push 前先 `git stash && git pull --rebase && git stash pop`
- **主要指標是 DirAcc，AUC 只作輔助**
- 說明框全程中文，口語化，雙語（英/中）
- **凡是 UI 改動，主文件 + 副本必須同步**
- **Tier 視覺（顏色點/badge/legend/gate）只在主文件**
- **同步組件後必查**：comment 頭有沒有「FYP 副本版」
- 每次對話結束：git commit + push 兩個 repo + 更新 HANDOVER.md

## VS Code 衝突
Bob 修改後 VS Code 彈 Compare → 選 File → Revert File
