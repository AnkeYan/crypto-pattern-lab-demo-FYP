# CryptoPatternLab 項目交接文件 v15.0

## 產品定位
AI-powered crypto pattern research assistant。

短期：web-based research tool / demo  
中期：agent-like workflow  
長期：AI Agent 可嵌入交易軟件

## 競爭定位
Bloomberg Terminal 的分析深度 + AI 自動翻譯成人話 + 專注 Crypto，後續可擴展到股票市場。

## 目標客戶
- 活躍交易者
- 研究型內容創作者 / newsletter 作者
- 小型 research / analyst 團隊

---

## 產品設計決策（已確認）

- 頁面結構：同一個產品體驗以 workspace 方式組織
  - 主研究頁 `/`：Research workspace
  - 驗證頁 `/validation`：Validation workspace
  - 信號頁 `/signals`：Signal Intelligence workspace
- 所有 Research panel 對所有人可見（功能層），登入系統加入後才做權限控制
- BTC Dominance：已確認不做
- AR/ARMA：已確認不做（BTC lag1 autocorrelation = -0.051，近乎 random walk）
- Fear & Greed 選用原因：唯一適用所有 Crypto 幣種的情緒指標
- Signal Intelligence workspace 定位：不叫「Prediction」，是 conditional historical statistics
- 主頁不要塞過多 validation 細節
- 產品要有 Bloomberg / TradingView / SaaS workspace 的感覺
- **推廣策略：不花錢做廣告**，依靠產品本身質量自然增長

---

## Tier 權限系統（已實作）

### 收費結構
- Free $0：AI Summary、Pattern Results（含 Win Rate Chart toggle）、Fear & Greed
- Pro $29/月：+ RSI、Bollinger、Month Seasonality、Consecutive Drop、Rolling Correlation、Signal Intelligence、Multi-Factor Setup Score、Pattern Validation、PDF Report
- Research $79/月：Pro 全部 + GARCH、Drawdown Recovery、Halving Cycle、Monte Carlo、Walk-Forward、ACF/PACF、Regime Transition

### 技術實作
- `useTier()` — 讀 localStorage `cpl_dev_tier`，SSR hydration 第一次 render = "free"，useEffect 後更新
- `hasAccess(userTier, requiredTier)` — TIER_RANK: free=0, pro=1, research=2
- `TierGate` — 包住整個 panel，不符合 tier 則 blur + 升級 CTA
- `DevTierSwitcher` — **生產環境需在 URL 加 `?dev=true` 才顯示**（安全設計，普通用戶不知道此參數）
  - 本地開發：`NODE_ENV === 'development'` 自動顯示
  - 生產測試：`https://crypto-pattern-lab.vercel.app/?dev=true`
  - **⚠️ 已移除 `NEXT_PUBLIC_DEV_PANEL` 環境變數**（之前所有人都能看到，安全問題已修復）
- **重要**：ResultsTable / RsiPanel / BollingerPanel 有內部 Pro 欄 blur，已接 `useTier()` 動態控制

### Panel 所屬 Tier 完整清單
**Research workspace `/`**
```
Free:     AI Summary, Pattern Results（含 Win Rate Chart）, Fear & Greed
Pro:      RSI, Bollinger, Month Seasonality, Consecutive Drop, Rolling Correlation
Research: GARCH, Drawdown Recovery, Halving Cycle, Monte Carlo
```
**Validation workspace `/validation`**
```
Pro:      Pattern Validation
Research: Walk-Forward, ACF/PACF
```
**Signals workspace `/signals`**
```
Pro:      Signal Intelligence, Multi-Factor Setup Score
Research: Regime Transition (Markov Chain)
```

---

## 技術架構

### 本地路徑
```
/Users/nganyukkuen/Bob/crypto-pattern-lab/
├── data/           ← CSV 分析結果
├── scripts/        ← Python 腳本
└── web/            ← Next.js 網頁
```

- **Git root**：`/Users/nganyukkuen/Bob/crypto-pattern-lab/`
- Terminal 工作目錄（本地開發）：`crypto-pattern-lab/web`（跑 npm run dev）
- Python 腳本執行目錄：`crypto-pattern-lab/`（跑 python3 scripts/...）

### Git commit 指令（唯一正確方式）
```bash
cd /Users/nganyukkuen/Bob/crypto-pattern-lab && git pull --rebase && git add -A && git commit -m "..." && git push
```
**⚠️ 重要**：GitHub Actions 每天 HKT 09:00 自動 commit CSV，若當天已跑過需先 `git pull --rebase` 再 push，否則會報 `rejected`。

### 設備資訊
- MacBook Air M4，13吋，2560×1664 Retina（邏輯解析度 1280×832）

---

## 目錄結構（最新版）

```
crypto-pattern-lab/
├── .github/workflows/update-data.yml   ← GitHub Actions 每天 UTC 01:00 自動更新
├── data/
│   ├── BTCUSDT.csv / ETHUSDT.csv / SOLUSDT.csv
│   ├── pattern_results.csv
│   ├── fear_greed_results.csv
│   ├── rolling_correlation.csv
│   ├── garch_results.csv
│   ├── pattern_validation_results.csv
│   ├── bollinger_results.csv
│   ├── rsi_results.csv
│   ├── acf_results.csv / ljung_box_results.csv
│   ├── walk_forward_results.csv
│   ├── regime_results.csv
│   ├── signal_summary.csv
│   ├── confluence_results.csv
│   ├── month_seasonality_results.csv
│   ├── consecutive_drop_results.csv
│   ├── drawdown_recovery_results.csv
│   ├── halving_results.csv / halving_price_path.csv
│   ├── regime_transition_results.csv
│   └── multifactor_results.csv
├── scripts/
│   ├── API調取-fetch_prices.py        ← yfinance，已加今日數據截止邏輯
│   ├── analyze_patterns.py
│   ├── analyze_fear_greed.py
│   ├── analyze_rolling_correlation.py
│   ├── analyze_garch.py
│   ├── analyze_pattern_validation.py
│   ├── analyze_bollinger.py
│   ├── analyze_acf.py
│   ├── analyze_walk_forward.py
│   ├── analyze_rsi.py
│   ├── analyze_month_seasonality.py
│   ├── analyze_signals.py
│   ├── analyze_regime_transition.py
│   ├── analyze_multifactor.py         ← v2：8 因子
│   ├── analyze_consecutive_drop.py
│   ├── analyze_drawdown_recovery.py
│   ├── analyze_halving.py
│   └── run_update.sh
└── web/
    ├── public/data/                   ← CSV 副本（Vercel 部署用）
    ├── .env.local                     ← 含 GEMINI_API_KEY（不會 commit）
    └── src/app/
        ├── page.tsx
        ├── validation/page.tsx
        ├── signals/page.tsx
        ├── report/page.tsx + ReportClient.tsx   ← ReportClient 已有 Pro gate
        ├── globals.css                ← overflow-x:hidden + 固定深色背景 #030712
        ├── lib/
        │   ├── useTier.ts
        │   ├── wilson.ts
        │   └── baseUrl.ts
        ├── api/（20個 routes）
        └── components/（23個 components）
```

---

## 數據來源

- **BTC 價格：yfinance (Yahoo Finance)，2014-09-17 起**
- **ETH 價格：yfinance，2017-08-17 起**
- **SOL 價格：yfinance，2020-09-09 起**
- Fear & Greed Index：Alternative.me API（免費，無需 key），limit=3000

### 為什麼換 yfinance？
Binance API 對美國 IP 返回 HTTP 451（地理封鎖），GitHub Actions 伺服器在美國，所有 Binance 域名全被封鎖。yfinance 無地理封鎖限制。

### yfinance 重要注意事項
1. **MultiIndex**：新版 yfinance 單 ticker 下載產生 MultiIndex columns，需 `df.columns.droplevel("Ticker")`，已處理
2. **今日數據截止**：crypto 市場 24h 不停，yfinance 在盤中會返回當天未完整日線。已在 `fetch_prices.py` 加入：
   ```python
   cutoff = datetime.now(timezone.utc).date() - timedelta(days=1)
   df = df[df.index.date <= cutoff]  # 只保留昨天及更早的完整收盤
   ```
   **原因**：不加的話，手動觸發時會寫入當天未完整數據，且可能跳過前一天（Yahoo Finance 有時延遲一天）

### 重要 CSV schema
```
open_time  ← Unix timestamp in milliseconds（不是 date）
open / high / low / close / volume
```

### BTC 數據延伸的影響
BTC 從 2014-09-17 起，比原本 Binance 早 3 年：
- **Halving Cycle**：n=3 → **n=4**（第二次減半 2016-07-09 現在有完整前後數據）
- Pattern Results / RSI / Bollinger：BTC 樣本數增加 ~1000 天

---

## GitHub Actions（自動數據更新）

- **Workflow 位置**：`.github/workflows/update-data.yml`
- **執行時間**：每天 **UTC 03:00（香港時間 11:00）**
  - 原為 UTC 01:00，v12 改為 UTC 03:00 原因：Yahoo Finance 週末偶爾延遲至 UTC 02:00+ 才入庫，推遲後成功率更高
- **手動觸發**：GitHub → Actions → Update Data → Run workflow
- **流程**：跑 17 個 Python 腳本 → 輸出到 `data/` → 複製到 `web/public/data/` → `git pull --rebase` → commit → push → Vercel 自動重新部署
- **Python 依賴**：`pandas numpy requests scipy arch statsmodels yfinance`
- **Workflow permissions**：已設為 Read and write（必須，否則 git push 會 403）

### ⚠️ GitHub Actions push rejected 問題（已修復）
**症狀**：Actions 最後一步 `git push` 報 `rejected (fetch first)`
**原因**：我們本地 commit 後 push，Actions checkout 的版本落後，push 被拒
**修復**：在 workflow 的 commit 後、push 前加了 `git pull --rebase origin main`
```yaml
git pull --rebase origin main
git push
```

### run_update.sh 執行順序（17個腳本）
```
API調取-fetch_prices.py        ← 必須第一個（yfinance，含今日截止邏輯）
analyze_patterns.py
analyze_fear_greed.py
analyze_rolling_correlation.py
analyze_garch.py
analyze_pattern_validation.py
analyze_bollinger.py
analyze_acf.py
analyze_walk_forward.py
analyze_rsi.py
analyze_month_seasonality.py
analyze_signals.py             ← 需在 regime / confluence 之後
analyze_regime_transition.py
analyze_multifactor.py         ← 必須在 signals / regime / fg / seasonality 之後
analyze_consecutive_drop.py
analyze_drawdown_recovery.py
analyze_halving.py
```

---

## 部署狀態（已完成 ✅）

### 主項目（商業版）
- **GitHub**：`https://github.com/AnkeYan/crypto-pattern-lab`（**Private**）
- **本地路徑**：`/Users/nganyukkuen/Bob/crypto-pattern-lab/`
- **Vercel 網址**：`https://crypto-pattern-lab.vercel.app` ✅
- **Root Directory**：`web`
- **環境變數**：`NEXT_PUBLIC_SITE_URL`、`GEMINI_API_KEY`
- **特點**：有 Tier 系統（Free/Pro/Research）、收費字眼、DevTierSwitcher

### FYP 副本（學術展示版）⚠️ 完全獨立，不要混淆
- **GitHub**：`https://github.com/AnkeYan/crypto-pattern-lab-demo-FYP`（**Public**）
- **本地路徑**：`/Users/nganyukkuen/Desktop/crypto-pattern-lab-export/`（✅ 已移至正式路徑，不再是 /tmp/）
- **Vercel 網址**：`https://crypto-pattern-lab-demo-fyp.vercel.app` ✅
- **Root Directory**：`web`
- **環境變數**：`NEXT_PUBLIC_SITE_URL = https://crypto-pattern-lab-demo-fyp.vercel.app`、`GEMINI_API_KEY`
- **GitHub Actions**：每天 UTC 03:00 自動更新數據（已設定，Read and write permissions ✅）
- **特點**：無 Tier 系統（`useTier()` 永遠回傳 `"research"`）、無收費字眼、無 Pricing section、無 blur gate、全部 panel 開放
- **用途**：FYP 提交（Department of Systems Engineering and Engineering Management，題目：Empirical Pattern of Cryptocurrencies）
- **README**：已加入中英文完整說明（含技術棧、研究問題、Anti-Overfitting 措施、實證發現）
- **git 狀態**：`.git` 已初始化，upstream 已設為 `origin/main`，可直接 commit + push

### ⚠️ 副本 git push 方式
```bash
cd /Users/nganyukkuen/Desktop/crypto-pattern-lab-export
git add -A && git commit -m "..." && git pull --rebase && git push
```
**重要**：副本有 GitHub Actions 每天自動 commit CSV，push 前必須先 `git pull --rebase`，否則會 rejected。

### ⚠️ UI 改動同步原則
**凡是 UI 相關改動，主文件 + 副本必須同步修改。**
副本的組件（`PatternValidationPanel`、`WalkForwardPanel` 等純 UI 組件）跟主文件完全一樣。
有 Tier 邏輯的組件（`useTier`、`TierGate`、`DevTierSwitcher`）副本不需要。

### baseUrl() 邏輯
```typescript
// web/src/app/lib/baseUrl.ts
export function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
```
Server Components 用 `baseUrl()` fetch API，不能用相對路徑。

### API Routes CSV 路徑
所有 API routes 讀取：`process.cwd() + "/public/data/xxx.csv"`
原因：Vercel 只有 `web/` 的內容，CSV 需要放在 `web/public/data/`

---

## 前端組件完整清單（23個）

| 組件 | Tier | Workspace | 說明 |
|------|------|-----------|------|
| WorkspaceHeader | - | 全部 | sticky header，search nav，3個 workspace tab |
| ResearchTOC | - | Research | sticky sidebar（xl）/ pill bar（mobile），`mobileOnly` / `desktopOnly` prop |
| TierGate | - | 全部 | blur gate + 升級 CTA |
| DevTierSwitcher | - | 全部 | ?dev=true URL 參數顯示，localStorage，切換後 reload |
| SummaryButton | Free | Research | react-markdown，Gemini 2.5 Flash，含數據來源說明 |
| ResultsTable | Free+Pro | Research | **已整合 WinRateChart**，Table/Chart toggle，5免費欄+7Pro欄，所有欄有 ⓘ hover tooltip（含 Wilson CI 說明） |
| FearGreedPanel | Free | Research | 5層情緒分析，Show statistics 含 r/p 名詞解釋 + 動態結論 |
| RsiPanel | Pro | Research | RSI 超賣統計，動態 Key Takeaway，動態條件說明行，口語化說明框 |
| BollingerPanel | Pro | Research | BB 突破統計，動態 Key Takeaway，動態條件說明行，口語化說明框（信封比喻 + 靈敏度說明） |
| MonthSeasonalityPanel | Pro | Research | 月份季節性，重寫說明框（Win Rate 定義、n 樣本限制），tooltip 顏色已修復 |
| ConsecutiveDropPanel | Pro | Research | 連跌分析，**表格現在按選中的 holding period 篩選顯示** |
| RollingCorrelationChart | Pro | Research | 60d 滾動相關係數，事件鏈接移至靜態列表（tooltip 不再放鏈接），事件列表默認展開 |
| GarchPanel | Research | Research | GARCH 波動率預測 |
| DrawdownRecoveryPanel | Research | Research | 回撤恢復分析 |
| HalvingPanel | Research | Research | 減半週期，**n=4** |
| MonteCarloPanel | Research | Research | 純 JS 模擬 |
| PatternValidationPanel | Pro | Validation | Discovery vs Validation split，How to read? dropdown |
| WalkForwardPanel | Research | Validation | 滾動驗證 |
| AcfPanel | Research | Validation | ACF/PACF + Ljung-Box |
| SignalIntelligencePanel | Pro | Signals | Regime + Confluence + 條件回報 |
| MultiFactorPanel | Pro | Signals | 8因子加權評分 |
| RegimeTransitionPanel | Research | Signals | Markov Chain 轉換矩陣 |

**注意**：`WinRateChart.tsx` 檔案仍存在但已整合入 ResultsTable，不再單獨使用。

---

## Panel UI 設計標準（已統一）

### 所有 Panel 都應有：
1. **雙語說明框**：`▸ How to read this?` / `▸ What is RSI?` 等 dropdown，英文 + 中文各一欄
2. **口語化語言**：不用學術術語，用比喻和大白話解釋（參考 RSI / Bollinger 的做法）
3. **「這個 panel 在問什麼問題？」段落**：以斜體引用核心問題句，然後解釋表格各欄的意思
4. **動態 Key Takeaway 框**：根據當前篩選的數據自動生成結論（顏色+文字）
5. **動態條件說明行**：放在表格/圖表正上方，解釋「現在顯示的是什麼條件的數據」
6. **標題格式**：`text-lg font-semibold` 標題 + `text-gray-500 text-sm` 副標題（英文/中文）

### Key Takeaway 設計模式（RsiPanel / BollingerPanel 已實作，其他待做）
```typescript
// 四種狀態 + 顏色
✓ Signal has edge   → 綠色邊框 border-green-500/30 bg-green-500/5
✗ No consistent edge → 紅色邊框 border-red-500/20 bg-red-500/5
⚠ Low sample        → 黃色邊框 border-yellow-500/30 bg-yellow-500/5
~ Marginal signal   → 灰色邊框 border-gray-700 bg-white/[0.03]

// 判斷邏輯（RSI/Bollinger 用的標準）
7d 勝率 ≥ 55% → hasEdge（綠）
7d 勝率 < 52% → weak7d（紅）
n < threshold  → lowN（黃）
其他           → marginal（灰）
```

### 條件說明行設計模式
```tsx
<div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
  <span className="text-gray-400">Showing: </span>
  <span className="text-white font-medium">every time {sym}'s RSI-{rsiWin} dropped below {rsiThr}</span>
  <span className="text-gray-400"> in history — how often was the price </span>
  <span className="text-white font-medium">higher 1 / 3 / 7 days later?</span>
  <span className="text-gray-500 ml-2 text-xs">({n} signals found)</span>
  <span className="block mt-1 text-gray-500 text-sm">顯示：...</span>
</div>
```

### 完成狀態（v14 全部完成 ✅）
| Panel | 雙語說明 | 口語化 | 條件說明行 | Key Takeaway |
|-------|---------|--------|-----------|-------------|
| ResultsTable | ✅ | ✅ | — | ✅ Wilson CI |
| FearGreedPanel | ✅ | ✅ | — | ✅ r/p 動態結論 |
| RsiPanel | ✅ | ✅ | ✅ | ✅ |
| BollingerPanel | ✅ | ✅ | ✅ | ✅ |
| MonthSeasonalityPanel | ✅ | ✅ | — | ✅ **v14** |
| ConsecutiveDropPanel | ✅ | ✅ | — | ✅ **v14** |
| RollingCorrelationChart | ✅ | ✅ | — | ✅ 動態解讀 |
| GarchPanel | ✅ | ✅ | — | ✅ |
| DrawdownRecoveryPanel | ✅ | ✅ | — | ✅ |
| HalvingPanel | ✅ | ✅ | — | ⚠️ n=4，刻意不做統計推斷 |
| MonteCarloPanel | ✅ | ✅ | — | ✅ |
| SignalIntelligencePanel | ✅ | ✅ | ✅ **v14** | ✅ **v14** |
| MultiFactorPanel | ✅ | ✅ | ✅ **v14** | ✅ **v14** |
| RegimeTransitionPanel | ✅ | ✅ | ✅ **v14** | ✅ **v14** |
| PatternValidationPanel | ✅ | ✅ | ✅ **v14** | ✅ **v14** |
| WalkForwardPanel | ✅ | ✅ | ✅ **v14** | ✅ **v14** |
| AcfPanel | ✅ | ✅ | ✅ **v14** | ✅ **v14**（含短/中期交易意義解讀）|

---

## RsiPanel 詳細設計（v11 重要更新）

### 說明框結構（三段）
1. **What is RSI?** — 「把它想成『這個幣跌得有多慘』的分數」比喻
2. **What is this panel asking?** — 斜體引用核心問題，解釋 Signals 欄和 Win Rate 欄
3. **Window / RSI below** — 口語解釋篩選器，不用「窗口」術語

### 條件說明行
動態顯示：`Showing: every time BTC's RSI-14 dropped below 30 in history — how often was the price higher 1 / 3 / 7 days later? (170 signals found)`
中文版在第二行，字體同為 `text-sm`

### Key Takeaway（buildTakeaway 函式）
- 輸入：`sym, rsiWin, rsiThr, filteredRows`
- 輸出：`{ enSummary, zhSummary, hasEdge, weak7d, lowN }`
- 邏輯：找出最佳 holding period，判斷 7d 勝率，生成結論

---

## BollingerPanel 詳細設計（v11 重要更新）

### 說明框核心比喻
- **信封比喻**：「想像在幣價周圍畫一個信封」
- **靈敏度說明**：`Band 2σ/2.5σ` = 靈敏度旋鈕，不再用「帶寬乘數」術語
- **⚠️ 完全移除「帶寬乘數」這個詞**（用戶反饋不明白）

### Key Takeaway 特有邏輯
每次結論包含 k 值說明（`kNote`）：
- 2.5σ：`"2.5σ band is wider, triggering fewer but more extreme signals."`
- 2.0σ：`"2.0σ band triggers more frequently but with a lower extreme-move filter."`

---

## ConsecutiveDropPanel 修復記錄（v11）

**問題**：切換 Hold（1d/3d/7d）按鈕時，圖表會變，但下方表格永遠顯示全部 12 行（4 streak × 3 hold）

**修復**：表格改為只顯示當前選中的 holding period（4行），去掉 Hold 欄，表格標題動態顯示當前選擇：
```
After N consecutive drops · Hold 7d · 連跌後持有 7 天的結果
```

---

## MonthSeasonalityPanel 修復記錄（v11）

### Tooltip 顏色修復
`formatter` 回傳自定義 JSX `<span>` 時，瀏覽器預設繼承黑色文字（深色背景上看不見）。
修復：所有 span 明確指定顏色：
- `n =`：`#6b7280`（灰）
- Mean / Median / Win Rate：`#e5e7eb` / `#d1d5db`（淺白）
- Best：`#4ade80`（綠）/ Worst：`#f87171`（紅）

### 說明框重寫（三段）
1. **這個 panel 在做什麼？** — 「把每年的 10 月收集起來，回答：歷史上 10 月是好月份嗎？」
2. **Win Rate 是什麼？** — 「12個歷史10月裡有9個收漲，跟RSI無關」（用戶問題：誤以為跟RSI的Win Rate是同一個東西）
3. **Mean vs Median / 樣本數** — 加了具體例子：某年暴漲200%會拉高均值，樣本最多11–12年

---

## RollingCorrelationChart 修復記錄（v11）

### Tooltip 鏈接問題（已解決）
**問題**：事件詳情的 `<a>` 鏈接放在 Recharts tooltip 裡，游標移到鏈接時 tooltip 就消失，根本無法點擊

**解決方案**：
- Tooltip 加 `pointer-events-none`，不接受任何鼠標事件
- 移除 tooltip 裡的 `<a>` 鏈接，改為灰色提示文字 `↓ See source link in event list below`
- 事件列表默認展開（`useState(true)`），鏈接永遠在靜態列表裡可點

### Hover 難以觸發問題（部分改善）
**問題**：「All」模式下數千數據點壓縮在幾百像素，精準 hover 很難
**改動**：
- `activeDot={{ r: 5, strokeWidth: 0 }}`（擴大感應點）
- `isAnimationActive={false}`（tooltip 立即顯示，無延遲）
**注意**：建議用戶在 1Y / 6M 模式下查看事件，數據點密度低很多

### RollingCorrelationChart Brush / Pan 功能（v12 完成 ✅）

已完成以下改動：
- `<Brush>` 元件加入兩個圖表，時間範圍按鈕改為設定 Brush 預設範圍（不截斷數據）
- 自定義 Brush traveller（細豎線 SVG，深色風格，融入 UI）：`height=16`，`fill="#0f172a"`，`stroke="#1e293b"`
- 觸控板橫向滑動（deltaX only）平移圖表
  - **⚠️ 重要**：必須用 `useEffect` + `addEventListener("wheel", handler, { passive: false })` 而非 React `onWheel`，因為 React onWheel 是 passive listener，`preventDefault()` 無效，頁面會同時捲動
  - `if (e.deltaX === 0) return` — 純縱向（上下滾動）不觸發平移，只有橫向才攔截
  - `corrBrushIdxRef` / `ratioBrushIdxRef` 用 ref 讀取最新 brush 狀態（避免 stale closure）
- `WHEEL_STEP = 5`（靈敏度），可按需調整（數字越大移動越快）
- 兩個圖表各自獨立 Brush（`corrChartRef` / `ratioChartRef`）

---

## GarchPanel 詳細設計（v12 更新）

### 說明框結構（三段）
1. **「波動率 ≠ 漲跌方向」**：「幣價的脾氣大小」比喻，天氣預報風速類比，第一段直接點明
2. **「概率區間，不是確定結果」**：以「1D Forecast 1.96%」舉例，解釋 95% CI + 剩下 5% 是尾部事件，ν 越低極端程度越誇張
3. **▸ What do these terms mean? / 名詞解釋**（折疊）：雙語逐一解釋 8 個術語

### 名詞解釋涵蓋（雙語）
Annualized Vol / 1D / 7D Forecast / Alpha（短記憶）/ Beta（長記憶）/ Persistence（α+β，IGARCH 說明）/ Tail Parameter ν（t 分佈，ν < 5 = 高尾部風險）/ Mean return mu（基線參數，非預測）/ Forecast term structure

### 信號解讀
- 1D Forecast > 3% → 明天預計大幅波動
- Persistence ≈ 1.000 → 高波動會持續，不要以為一兩天就平靜
- ν < 4 → 極端行情發生機率遠高於正態分佈假設

---

## DrawdownRecoveryPanel 詳細設計（v12 更新）

### 說明框結構
1. **核心問題**（斜體引用）：「BTC 從近期高點跌了 10% 後，歷史上多快能反彈回來？」
2. **反彈速度測試比喻**：不是保證，44% 恢復率 = 歷史上 44% 的事件在 90 天內回到前高
3. **Term Glossary**（`text-sm`，與上方一致）：8 個術語雙語，包含 DNR 特別說明「是次數不是百分比」

### 名詞解釋涵蓋（雙語）
Drawdown −X% / 60-day rolling high / Events（14天間距）/ Recovery Rate（歷史頻率非保證）/ Median Days（不含 DNR）/ P25–P75（中間 50% 範圍）/ DNR（**次數**非百分比，DNR 124/255 = 49% 花超過 90 天）/ 90-day cap

### 動態 Key Takeaway
- 基於當前幣種的 −10% 和 −20% 數據
- 綠（恢復率 ≥ 50%）/ 紅（< 50%）/ 黃（n < 20 樣本不足）
- 切換 BTC/ETH/SOL 自動更新

---

## ResultsTable 詳細設計

### Table/Chart 整合
- `📋 Table` mode：單一幣種詳細數據
- `📊 Chart` mode：三幣種勝率對比圖（Chart 模式下幣種 Tab 自動灰化）
- 兩個 mode 共用同一個 `How to read this?` dropdown

### Tooltip 智能定位
`showTooltip()` 會偵測右側空間，自動決定向右或向左展開，確保不超出螢幕邊界。所有 12 欄都有 ⓘ tooltip。

### Wilson Confidence Interval
勝率下方灰色 `[51%–61%]` = Wilson 95% 置信區間，已在說明框有雙語說明。

---

## FearGreedPanel 統計數據說明

`Show statistics` 展開後包含：
1. **名詞解釋框**：r（Pearson 相關係數）和 p（p-value）的定義
2. **Same-day correlation**：動態結論（紅色 ✗ / 綠色 ✓）
3. **Pre-7d correlation**：動態結論

**設計理由**：F&G 與回報線性相關通常不顯著（r≈0.007, p≈0.896），這是誠實呈現——情緒是背景參考而非獨立信號。

---

## 字體系統

```
text-lg  (18px)  → Panel 主標題
text-sm  (14px)  → 說明框正文、表格數字、條件說明行、panel 副標題
text-xs  (12px)  → uppercase 標籤（ENGLISH/中文）、button/badge/filter pill、圖表 caption
text-[11px]      → 圖表 caption（偶爾）
text-[10px]      → Badge 標籤（PRO/Free 等）
```

### globals.css（當前設定）
```css
body {
  background: #030712;
  overflow-x: hidden;
  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

---

## Multi-Factor Setup Score 詳細設計

### 8個因子（v2）

| 因子 | 權重 | 設計邏輯 |
|------|------|---------|
| F1 RSI Oversold Intensity | 20% | RSI=20→1.0，RSI=50→0.40（neutral zone 基礎分），RSI=65→0 |
| F2 Bollinger Deviation | 15% | dev=-2→1.0，dev=0→0.40，dev=+3→0 |
| F3 GARCH Vol Regime | 12% | vol 收縮→高分，擴張→低分 |
| F4 Fear & Greed Zone | 13% | EF win_rate vs baseline edge，per-symbol |
| F5 Month Seasonality | 13% | median return + win_rate，stepped n_weight |
| F6 Regime Favorability | 13% | 當前 regime 下信號 edge vs baseline |
| F7 Volume Surge | 7% | 放量下跌→高分，放量上漲→低分，縮量→中性 |
| F8 Price Momentum | 7% | 5d vs 20d relative momentum，負動量→高分 |

### v2 待辦（歷史校準）— 下一步優先
- 目標：每個分數區間（0–20、20–40、40–60、60–80、80–100）對應的歷史實際 7d 勝率
- 方法：新建 `analyze_multifactor_calibration.py`，回測歷史每天的因子分數 + 7天後漲跌
- GARCH 回測問題：GARCH 無歷史記錄，回測時 F3 固定給 0.5（中性分），標注「未納入校準」
- 輸出：新 CSV `multifactor_calibration.csv`（schema：symbol, date, score, score_bucket, outcome_7d, win）
- 前端：MultiFactorPanel 加「Historical Calibration」區塊，顯示各分數區間的歷史勝率

---

## API Routes（20個）

```
/api/results           → pattern_results.csv
/api/summary           → Gemini 2.5 Flash，temperature=0.3
/api/fear-greed        → fear_greed_results.csv
/api/rolling-correlation
/api/garch
/api/pattern-validation
/api/bollinger
/api/rsi
/api/acf
/api/ljung-box
/api/walk-forward
/api/monte-carlo       → 純 JS 計算，無 CSV
/api/month-seasonality
/api/signals           → signal_summary + confluence 合併回傳
/api/regime
/api/regime-transition
/api/multifactor
/api/multifactor-calibration  → summary（percentile bucket 統計）+ scatter（400點樣本）
/api/xgboost                  → folds（walk-forward AUC）+ importance（因子重要性）+ predictions（當前預測概率）
/api/consecutive-drop
/api/drawdown-recovery
/api/halving
```

**注意**：所有 CSV 類 routes 都有 try/catch（v13 已全部加入）。

---

## 關鍵數據發現

- BTC RSI-14 < 30 後 7d：win rate 58.3%（n=170，BTC 延伸至 2014 後樣本增加）
- ETH RSI-14 < 30 後 7d：win rate 48.7%（n=154）— ETH 明顯較弱
- SOL RSI-14 < 30 後 7d：win rate 65.5%（n=87）
- Walk-forward：BTC 只有 31% folds consistent，SOL 63%
- ACF/PACF：BTC lag1 = -0.051，Ljung-Box p < 0.01，不是純 white noise 但自相關太弱
- GARCH persistence = 1.000 for BTC/ETH → IGARCH（正常現象）
- Markov Chain：Bull↔Bear 直接轉換 = 0%（rule-based 分類器設計，必須過 Sideways）
- 當前市場：三幣種皆為 Sideways regime
- Fear & Greed 與回報相關性：r≈0.007, p≈0.896（不顯著）

### Multi-Factor 歷史校準發現（v15 新增）
- 觸發式評分分布：BTC top 25% 勝率 **62.9%**（n=663）、top 10% 勝率 59.2%（n=434）
- ETH top 50% 勝率 56.9%，但 top 25% 勝率反跌至 50.0%（因子對 ETH 效果不穩定）
- SOL 樣本不足，top 10% n=218，勝率 58.3%

### XGBoost Walk-Forward 發現（v15 新增）
- BTC avg AUC = **0.530**（11 folds，5/11 folds AUC>0.52）— 有輕微正 edge
- ETH avg AUC = 0.467、SOL avg AUC = 0.474 — 低於 0.50，現有因子對 ETH/SOL 預測力弱
- **F3 GARCH / F4 Fear&Greed / F6 Regime 重要性全部 = 0%** — 對 7d 漲跌方向無預測力，下輪迭代候選移除
- **F1 RSI / F8 動量** 三幣種均排前列，最穩定
- F5 月份季節性：BTC #1，但 SOL = 0%（幣種差異大）

---

## Validation / Anti-overfitting 設計決策

- split 固定：discovery ≤ 2022-12-31，validation ≥ 2023-01-01
- confidence system：score-based + confidence_reasons + positive_but_weakened
- cap rule：validation sample < 30，不能標為 Higher confidence
- 主頁不塞 validation 細節

---

## 當前未完成 / 下一步（優先順序）

### 🔴 高優先（下次對話立即開始）
1. **新增 3 個因子（F9/F10/F11）**
   - **F9 Funding Rate**：Binance 期貨 API（免費，無地理限制）
     - 邏輯：Funding Rate 極度負值 → 空頭過多 → 軋空反彈概率高
     - 新建 `analyze_funding_rate.py` → `funding_rate_results.csv`
   - **F10 Exchange Netflow**（大戶行為）：CryptoQuant API（有免費層）
     - 邏輯：交易所淨流出（大戶提幣到冷錢包）→ 看漲信號
     - 新建 `analyze_exchange_netflow.py` → `exchange_netflow_results.csv`
   - **F11 Google Trends**（散戶情緒）：`pytrends`（完全免費）
     - 邏輯：搜索量暴跌 → 散戶恐慌離場 → 歷史上常見底部特徵
     - 新建 `analyze_google_trends.py` → `google_trends_results.csv`
   - 加入 `analyze_multifactor.py`、`analyze_multifactor_calibration.py`、`analyze_xgboost.py`
   - 加入 `run_update.sh` 和 GitHub Actions
   - 前端 MultiFactorPanel 新增 3 個因子顯示

### 🟡 中優先
2. **登入系統 + 付費牆**（NextAuth.js + Supabase + Stripe，前提：先有真實用戶）

### 🔵 ML / 量化 Agent 方向（已討論，記錄在案）

**三步走路線圖：**
- **Step 1 ✅ 完成**：Multi-Factor Score 歷史校準 + XGBoost Walk-Forward 驗證
- **Step 2（進行中）**：擴充因子（F9/F10/F11），重跑 XGBoost，觀察 AUC 是否提升
- **Step 3（長期）**：實時數據流 + Gemini 解讀 + Agent 架構 + 交易所 API

**XGBoost 核心原理：**
- 從歷史數據自動學出「什麼指標組合最預測漲跌」
- 決策樹疊加（Boosting）：每棵樹專門修正前一棵的錯誤，100棵樹投票
- 比人工權重更精準原因：自動發現因子交互（如 RSI < 30 在 Bull Regime 下才有效）

**完整量化 Agent 技術棧：**
```
數據層 → 特徵工程層（現有 8 因子）→ 預測層（XGBoost）→ 決策層（規則/RL/LLM）→ 風控層 → 執行層（交易所 API）
```

**其他 ML 方法：**
- 監督學習：Logistic Regression、Random Forest、XGBoost、LSTM、Transformer
- 強化學習：DQN、PPO（OpenAI 用的）、SAC — 最適合做量化 Agent
- 無監督學習：K-Means（市場狀態自動分群）、PCA（因子壓縮）

**因子刪除原則（歷史校準後執行）：**
- 刪除條件：因子分數高低對 7d 勝率幾乎無差異 + 加入後整體模型準確度無提升 + 與其他因子高度相關
- 不刪除：因子單獨沒用但與其他組合有用（XGBoost 會發現）
- 預期最弱：F5 月份季節性（樣本只有 7–12 年）、F3 GARCH（波動率與反彈關係間接）
- 預期最強：F1 RSI、F2 BB（最多歷史數據支撐）

**動態權重 vs 靜態權重：**
- 現有 8 個因子人工固定權重（完全是拍腦袋）
- 路線一（純統計）：按歷史校準結果重新分配靜態權重
- 路線二（XGBoost）：自動動態學習，發現因子交互效應

### ⚪ 已確認暫緩
- CPI / 利率相關性分析（需 FRED API key）
- AR/ARMA（BTC lag1 自相關太弱，無意義）

---

## 本輪完成的所有改動（v15.0，本次對話）

```
556baa7  feat: XGBoost factor validation — analyze_xgboost.py (walk-forward CV), /api/xgboost route, XGBoost section in MultiFactorPanel (feature importance, AUC table, win probability)
7d5661d  feat: MultiFactorPanel Historical Calibration — add bilingual How to read this? explainer dropdown
1b6a20b  feat: Multi-Factor Historical Calibration — calibration script (trigger-based scoring), /api/multifactor-calibration route, Historical Calibration section in MultiFactorPanel (percentile rank, summary table, SVG scatter plot)
```

### 歷史改動記錄（v14.0）
```
bf7b692  fix: SignalIntelligencePanel — complete all 15 signal combo labels (fix lowercase), add signal definitions + why combine to explainer
3c0dfe8  feat: SignalIntelligencePanel + MultiFactorPanel + RegimeTransitionPanel — expand explainers, add condition banners, dynamic Key Takeaways
be6b82b  feat: AcfPanel — improve Key Takeaway with short/mid-term trading implication detail
ece45a8  feat: AcfPanel — expand explainer with bilingual glossary + rainy day analogy, add condition banner, dynamic Key Takeaway
11eb9f7  feat: WalkForwardPanel — expand explainer with bilingual glossary + result labels, add condition banner, dynamic Key Takeaway
a7499a7  feat: PatternValidationPanel — expand explainer with bilingual glossary, add dynamic Key Takeaway, condition banner, bilingual Interpretation + Confidence Breakdown
```

### 歷史改動記錄（v13.0）
```
8bfc920  feat: MonthSeasonalityPanel + ConsecutiveDropPanel — add dynamic Key Takeaway (edge/weak/lowN/marginal, bilingual)
4d6ae0d  fix: mobile RWD — shrink header logo on mobile, hide search bar on mobile, fix FearGreedPanel badge wrapping
c2bbf10  fix: mobile RWD — wrap Research Workspace header, fix panel title overflow on small screens (RSI, Bollinger, ResultsTable)
f46dee8  fix: mobile RWD — overflow-x-hidden on all pages, fix Unlock all button overflow, fix table width bleed
5d98aaf  fix: header mobile — reduce logo size, add right padding to nav so Signals tab not clipped
bf88005  fix: ResultsTable — keep BTC/ETH/SOL tab and Table/Chart toggle in same row, prevents Chart button overflow on mobile
43c6c47  fix: add try/catch error handling to all 18 CSV API routes
6bc8244  fix: remove overflow-x-hidden from main — was breaking sticky ResearchTOC sidebar
baf6e3c  docs: update HANDOVER.md to v13.0
```

---

## 歷史改動記錄（v12.0）（保留供參考）

```
425760c  feat: RollingCorrelationChart — add Brush pan/scroll to both charts; range buttons set default brush window instead of slicing data
c6f3198  style: RollingCorrelationChart — custom Brush traveller (thin vertical lines), smaller height, darker fill
2128e01  feat: RollingCorrelationChart — trackpad horizontal swipe to pan both charts (deltaX only)
5bf28ef  fix: RollingCorrelationChart — use non-passive native wheel listener for reliable trackpad horizontal pan
2ddd944  fix: RollingCorrelationChart — intercept any deltaX!=0 to prevent page scroll during trackpad pan
cb6db54  tweak: RollingCorrelationChart — reduce WHEEL_STEP from 15 to 8
f599aa1  tweak: RollingCorrelationChart — WHEEL_STEP 8 -> 5
430519b  feat: GarchPanel — rewrite explainer (vol≠direction, probability interval), add bilingual term glossary dropdown
6fd0f8b  feat: DrawdownRecoveryPanel — rewrite explainer with plain-language analogy, add full term glossary, dynamic Key Takeaway
f5d75b6  docs: DrawdownRecoveryPanel — clarify DNR is a count not a percentage in term glossary
79d0a35  style: DrawdownRecoveryPanel — increase term glossary font from text-xs to text-sm for consistency
96bd6e1  docs: update HANDOVER.md to v12.0
e41a5d9  chore: delay daily workflow from UTC 01:00 to UTC 03:00 (HKT 11:00) to reduce Yahoo Finance weekend lag
```

---

## 歷史改動記錄（v11.0）

```
2e81182  fix: fetch_prices — exclude today's incomplete intraday bar, only keep dates <= yesterday UTC
dc23b02  fix: GitHub Actions — add git pull --rebase before push to prevent rejection
c0b7e2e  fix: RollingCorrelationChart — larger activeDot r=5, isAnimationActive=false on both tooltips
5081aeb  fix: RollingCorrelationChart — remove unclickable links from tooltip, move to static event list; default show events expanded
cf68360  fix: ConsecutiveDropPanel — table now filters by selected holding period, removed redundant Hold column
8c2ec82  feat: MonthSeasonalityPanel — rewrite explainer with plain-language Win Rate definition, n sample context
83e75f6  fix: MonthSeasonalityPanel — tooltip text colors (Mean/Median/WinRate/n were inheriting black)
739c5c0  feat: BollingerPanel — plain-language explainer (envelope analogy, sensitivity dial) + dynamic condition banner
3ea1c51  fix: RsiPanel condition banner — match Chinese text-sm to English font size
f0bc922  feat: RsiPanel — plain-language explainer + dynamic condition banner above table
c9c5882  feat: BollingerPanel — add dynamic Key Takeaway (edge/no-edge/low-sample, k-width note, bilingual)
581f35e  feat: RsiPanel — add dynamic Key Takeaway based on current sym/window/threshold selection
```

---

## 歷史改動記錄（v8.0–v10.0）

```
eaa8880  docs: update HANDOVER.md to v8.0
d58f59d  style: FearGreedPanel statistics — larger text, better contrast, color-coded conclusions
10e9e63  feat: FearGreedPanel — add r/p explanation + dynamic conclusion text
addfa7e  feat: add How to read this? dropdown to PatternValidationPanel, RollingCorrelationChart
849f1c5  feat: extend BTC data to 2014-09-17; update HalvingPanel n=3→4
c8c50ba  fix: FearGreedPanel — remove double %%, fix p_fg_pre7 display bug
19bbd73  feat: add Wilson CI explanation to ResultsTable How to read this dropdown
0e8a486  feat: merge WinRateChart into ResultsTable — Table/Chart toggle
ee4d4fd  fix: DevTierSwitcher — use ?dev=true URL param; fix mobile overflow-x white edge
37f77ac  fix: delay daily workflow to UTC 01:00 (HKT 09:00)
07c3ef2  fix: switch price fetching from Binance to yfinance (bypass geo-block)
de3f18d  fix: drop yfinance MultiIndex Ticker level
```

---

## 工作慣例（必須遵守）

- 一步一步來，完成一步才繼續
- 每步先詳細解釋知識點，再動手
- 建立新檔案優先用 terminal 指令
- 代碼有改動必須先解釋再執行
- 優先提供 Approve / Reject 類型的選擇（**不需要每次提醒風險，直接給方案讓用戶選擇**）
- 省 token 但不遺漏重要內容
- 專業用詞附帶中文解釋（特別是給非技術背景用戶看的說明框）
- **說明框語言原則**：口語化 > 學術化，用比喻，說清楚「這個 panel 在問什麼問題」
- 詳細解釋是需要的，但避免重複、避免過度繁複
- 每次對話結束（用戶說「今天到這裡」或類似）：自動執行 git commit + push HANDOVER
- **push 前先 `git pull --rebase`**（GitHub Actions 每天自動 commit，容易衝突）

---

## VS Code 衝突注意事項

Bob 修改檔案後，VS Code 可能彈出 Compare / Overwrite 提示
正確做法：**File → Revert File**（不要讓 VS Code 覆蓋）
已設定：files.autoSave: onFocusChange
