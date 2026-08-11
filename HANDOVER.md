# CryptoPatternLab FYP 副本 項目交接文件 v17.0

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

## 副本特性

**⚠️ 本副本是學術 FYP 版本，與主文件（商業版）的本質區別：**
- ✅ **技術實作完全相同**：所有分析腳本、數據 CSV、XGBoost 模型、前端組件邏輯一致
- ❌ **無 Tier 系統**：沒有收費功能、DevTierSwitcher、TierGate 等權限控制
- ❌ **無商業字眼**：無定價頁、無升級 CTA、無 Pro/Research 標籤
- ✅ **全部功能開放**：所有 panel、所有分析工具無限制使用

**UI 同步原則（後續改動時務必遵守）：**
- ✅ 可同步的：純 UI 組件（Panel、Chart、Table 等的展示邏輯）
- ❌ 不能同步的：Tier 相關邏輯（useTier、TierGate、DevTierSwitcher）
- ❌ 不能同步的：Layout 層改動（overflow-x-hidden 等副本特有的調整）
- **同步流程**：只複製無 Tier 的功能代碼，Tier 相關的自行刪除

---

## 技術架構

**本地路徑**
```
/Users/nganyukkuen/Desktop/crypto-pattern-lab-export/
├── data/           ← CSV 分析結果
├── scripts/        ← Python 腳本
└── web/            ← Next.js 網頁
```

**Git commit 指令**
```bash
cd /Users/nganyukkuen/Desktop/crypto-pattern-lab-export && git pull --rebase && git add -A && git commit -m "..." && git push
```

---

## 11 因子體系（v17.0）

| 因子 | 權重 | 數據源 | 說明 |
|------|------|--------|------|
| F1 RSI Oversold Intensity | 16% | 技術指標 | RSI-14，< 50 才計分 |
| F2 Bollinger Deviation | 12% | 技術指標 | BB 2σ 下軌偏離 |
| F3 GARCH Vol Regime | 9% | 波動率模型 | 校準版固定 0（無歷史） |
| F4 Fear & Greed Zone | 10% | 情緒指標 | 校準版固定 0（靜態代理） |
| F5 Month Seasonality | 10% | 統計 | 月份歷史偏向 |
| F6 Regime Favorability | 10% | Markov Chain | Bull/Bear/Sideways 中當前信號有效性 |
| F7 Volume Surge | 6% | 成交量 | 放量下跌訊號 |
| F8 Price Momentum | 6% | 技術指標 | 5d vs 20d 負動量 |
| F9 Funding Rate Sentiment | 7% | Bybit 期貨 | 7d 平均資金費率（BTC/ETH/SOL 逐日） |
| F10 Long/Short Ratio | 7% | Bybit 期貨 | 大戶多空比（即時快照，校準版固定 0） |
| F11 Active Addresses | 7% | Blockchain.com | BTC 鏈上活躍地址 vs 30d MA（BTC only） |

**XGBoost 最新結果（v17）：**
```
BTC: avg AUC=0.517 | Feature Importance: F1 RSI > F11 Active Addresses > F8 Momentum > F2 Bollinger > F9 Funding Rate
ETH: avg AUC=0.466
SOL: avg AUC=0.469

Calibration：
BTC top 10%: 62.2% win rate | top 50%: 56.5% win rate | bottom 50%: 51.0% win rate
```

---

## 本輪完成的所有改動（v17.0）

### F9/F10/F11 完整實作

**新增腳本：**
- `analyze_active_addresses.py`：Blockchain.com API，1585 行（2009-03-06 → 今天），F11 邏輯觸發式評分
- `analyze_futures_sentiment.py` v3：Bybit API，F9/F10，增量策略，graceful exit

**更新腳本：**
- `analyze_multifactor_calibration.py`：加入 f11_norm，11 因子校準版
- `analyze_xgboost.py`：FEATURES 加入 f9_norm, f10_norm, f11_norm
- `analyze_multifactor.py`：11 因子

**前端：**
- `MultiFactorPanel.tsx`：加入 active_addresses（icon 🔗），英文+中文說明「11 factors」
- `page.tsx`：移除 `overflow-x-hidden`（允許 sticky ResearchTOC）

---

## 關鍵知識點

### GitHub Actions 報 451 的解決
原：Binance API 對美國 IP 地理封鎖 → Python exit code 1 → workflow 停止
現：
1. 數據源改 Bybit（無地理限制）
2. 增量策略：只新增最新 200 筆，保留歷史 CSV
3. Graceful exit：Bybit 抓不到時 `sys.exit(0)`，保留舊 CSV，workflow 繼續

### F11 Active Addresses 為什麼有效
- 鏈上活躍地址驟降 = 用戶恐慌離場 = 歷史上常見底部特徵
- BTC 用 Blockchain.com（有完整 2009 年起歷史）
- 公式：`clamp(0.5 + (1 - ratio) * 2, 0, 1)`，ratio = addr / ma30
- ETH/SOL：無免費歷史鏈上數據，F11 固定 0.5（中性）

### 副本和主文件的同步原則
**後續改動時務必遵守：**
- ✅ **複製無 Tier 的組件**：任何 panel UI 邏輯、chart、table
- ❌ **不複製 Tier 邏輯**：useTier()、TierGate、DevTierSwitcher
- ❌ **不複製 layout 全部改動**：只改副本需要的部分
- **同步方式**：讀主文件改動 → 評估是否有 Tier 邏輯 → 有則手動改副本，無則直接複製

---

## 工作慣例

- 一步一步來，完成一步才繼續
- 每步先詳細解釋知識點，再動手
- **主文件和副本務必分清楚，不要混淆**
- 每次對話結束時 git commit + push HANDOVER
- push 前先 `git pull --rebase`
