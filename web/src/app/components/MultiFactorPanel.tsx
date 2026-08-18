"use client";

// MultiFactorPanel — Multi-Factor Setup Score
// 跨模型加權整合：13個因子 → 0-100分的入場設置質量評分 + 歷史校準 + XGBoost 區塊

import { useMemo, useState } from "react";

export type XgbFold = {
  symbol:      string;
  test_year:   number | null;
  n_train:     number | null;
  n_test:      number | null;
  auc:         number | null;
  accuracy:    number | null;
  rmse:        number | null;
  dir_acc:     number | null;
  train_start: string | null;
  train_end:   string | null;
};

export type XgbImportance = {
  symbol:       string;
  feature:      string | null;
  feature_name: string | null;
  importance:   number | null;
  rank:         number | null;
};

export type XgbPrediction = {
  symbol:            string;
  date:              string;
  xgb_win_prob:      number | null;
  xgb_expected_ret:  number | null;
  calib_score:       number | null;
};

export type CalibSummaryRow = {
  symbol:     string;
  pct_bucket: string;
  n:          number;
  win_rate:   number;
  mean_7d:    number;
  score_min:  number;
  score_max:  number;
};

export type CalibScatterPoint = {
  score:      number;
  outcome_7d: number;
  win:        number;
};

export type MultifactorRow = {
  symbol: string;
  factor: string;
  raw_value: number | null;
  normalized_score: number | null;
  weight: number | null;
  weighted_score: number | null;
  description: string;
};

const SYMBOLS = ["BTC", "ETH", "SOL"];

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_COLOR: Record<string, string> = {
  BTC: "#22c55e", ETH: "#60a5fa", SOL: "#facc15",
};

const FACTOR_META: Record<string, { label: string; zh: string; icon: string }> = {
  rsi_intensity:       { label: "RSI Oversold Intensity",    zh: "RSI 超賣強度",     icon: "📉" },
  bollinger_deviation: { label: "Bollinger Deviation",        zh: "布林帶偏離幅度",   icon: "📊" },
  garch_vol_regime:    { label: "GARCH Vol Regime",           zh: "波動率收縮/擴張",  icon: "🌊" },
  fear_greed_zone:     { label: "Fear & Greed Zone",          zh: "恐懼貪婪指標分層", icon: "😱" },
  month_seasonality:   { label: "Month Seasonality Bias",     zh: "月份季節性偏向",   icon: "📅" },
  regime_favorability: { label: "Regime Signal Favorability", zh: "Regime 信號有效性",icon: "🎯" },
  volume_surge:        { label: "Volume Surge",                zh: "成交量放大訊號",   icon: "📦" },
  price_momentum:      { label: "Price Momentum",              zh: "價格動量偏離",     icon: "⚡" },
  funding_rate:        { label: "Funding Rate",                zh: "期貨資金費率",     icon: "💹" },
  ls_ratio:            { label: "Long/Short Ratio",            zh: "大戶多空比",       icon: "⚖️" },
  active_addresses:    { label: "Active Addresses",            zh: "BTC 鏈上活躍地址", icon: "🔗" },
  turbulence_calm:     { label: "Turbulence Index",            zh: "市場異常指數",     icon: "🌡️" },
  mvrv:                { label: "MVRV Valuation",              zh: "市值/實現價值",    icon: "⛓️" },
};

const FACTOR_ORDER = [
  "rsi_intensity",
  "bollinger_deviation",
  "garch_vol_regime",
  "fear_greed_zone",
  "month_seasonality",
  "regime_favorability",
  "volume_surge",
  "price_momentum",
  "funding_rate",
  "ls_ratio",
  "active_addresses",
  "turbulence_calm",
  "mvrv",
];

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  if (score >= 30) return "#9ca3af";
  return "#6b7280";
}

function scoreLabel(score: number): { label: string; zh: string; color: string } {
  if (score >= 70) return { label: "Strong Setup",   zh: "強力設置",   color: "text-green-400" };
  if (score >= 50) return { label: "Moderate Setup", zh: "中性偏多",   color: "text-yellow-400" };
  if (score >= 30) return { label: "Weak Setup",     zh: "設置偏弱",   color: "text-gray-400" };
  return               { label: "No Setup",       zh: "無明顯設置", color: "text-gray-600" };
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        {/* filled arc */}
        <circle
          cx="50" cy="50" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="50" y="46" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
          {score.toFixed(0)}
        </text>
        <text x="50" y="62" textAnchor="middle" fill="#6b7280" fontSize="10">
          / 100
        </text>
      </svg>
    </div>
  );
}

// ── SVG Scatter Plot ────────────────────────────────────────────────────────
function CalibScatter({
  points,
  color,
}: {
  points: CalibScatterPoint[];
  color: string;
}) {
  const W = 320, H = 160, PAD = { t: 8, r: 8, b: 28, l: 38 };
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;

  if (points.length === 0) return null;

  const scores   = points.map((p) => p.score);
  const outcomes = points.map((p) => p.outcome_7d);
  const xMin = Math.min(...scores),   xMax = Math.max(...scores);
  const rawYMin = Math.min(...outcomes), rawYMax = Math.max(...outcomes);
  // Symmetric y-axis around 0, capped at ±40%
  const yExt  = Math.min(Math.max(Math.abs(rawYMin), Math.abs(rawYMax)) * 1.1, 0.40);
  const yMin = -yExt, yMax = yExt;

  const toX = (s: number) =>
    xMax === xMin ? PAD.l + IW / 2 : PAD.l + ((s - xMin) / (xMax - xMin)) * IW;
  const toY = (o: number) =>
    PAD.t + ((yMax - o) / (yMax - yMin)) * IH;

  const y0 = toY(0);

  // x-axis ticks (3)
  const xTicks = [xMin, (xMin + xMax) / 2, xMax];
  // y-axis ticks: ±yExt and 0
  const yTickVals = [-yExt, -yExt / 2, 0, yExt / 2, yExt];

  return (
    <svg width={W} height={H} className="overflow-visible">
      {/* zero line */}
      <line x1={PAD.l} x2={PAD.l + IW} y1={y0} y2={y0} stroke="#374151" strokeWidth={1} strokeDasharray="3 3" />

      {/* y-axis ticks */}
      {yTickVals.map((v) => {
        const y = toY(v);
        const lbl = v === 0 ? "0" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
        return (
          <g key={v}>
            <line x1={PAD.l - 3} x2={PAD.l} y1={y} y2={y} stroke="#4b5563" strokeWidth={1} />
            <text x={PAD.l - 5} y={y + 4} textAnchor="end" fill="#6b7280" fontSize={9}>
              {lbl}
            </text>
          </g>
        );
      })}

      {/* x-axis ticks */}
      {xTicks.map((v) => {
        const x = toX(v);
        return (
          <g key={v}>
            <line x1={x} x2={x} y1={PAD.t + IH} y2={PAD.t + IH + 3} stroke="#4b5563" strokeWidth={1} />
            <text x={x} y={PAD.t + IH + 12} textAnchor="middle" fill="#6b7280" fontSize={9}>
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* axis labels */}
      <text x={PAD.l + IW / 2} y={H - 2} textAnchor="middle" fill="#6b7280" fontSize={9}>
        Score
      </text>

      {/* dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={toX(p.score)}
          cy={toY(p.outcome_7d)}
          r={2.5}
          fill={p.win === 1 ? color : "#ef4444"}
          opacity={0.45}
        />
      ))}
    </svg>
  );
}

export type EnsembleFold = {
  symbol: string; test_year: string;
  n_test: string; xgb_auc: string; lgb_auc: string;
  ens_auc: string; dir_acc: string; rmse: string;
};
export type EnsemblePrediction = {
  symbol: string; date: string;
  ensemble_win_prob: string; ensemble_expected_ret: string; calib_score: string;
};

export default function MultiFactorPanel({
  data,
  calibSummary    = [],
  calibScatter    = {},
  xgbFolds        = [],
  xgbImportance   = [],
  xgbPredictions  = [],
  ensembleFolds       = [],
  ensemblePredictions = [],
}: {
  data:                 MultifactorRow[];
  calibSummary?:        CalibSummaryRow[];
  calibScatter?:        Record<string, CalibScatterPoint[]>;
  xgbFolds?:            XgbFold[];
  xgbImportance?:       XgbImportance[];
  xgbPredictions?:      XgbPrediction[];
  ensembleFolds?:       EnsembleFold[];
  ensemblePredictions?: EnsemblePrediction[];
}) {
  const [sym, setSym] = useState("BTC");
  const [showInfo, setShowInfo] = useState(false);
  const [showCalibInfo, setShowCalibInfo] = useState(false);
  const [showXgbInfo, setShowXgbInfo] = useState(false);
  const [showEnsInfo, setShowEnsInfo] = useState(false);

  const symKey  = `${sym}USDT`;
  const symData = data.filter((r) => r.symbol === symKey);
  const totalRow = symData.find((r) => r.factor === "__total__");
  const score    = totalRow?.raw_value ?? 0;
  const regime   = totalRow?.description?.replace("regime=", "") ?? "unknown";
  const color    = SYMBOL_COLOR[sym];
  const { label, zh, color: labelColor } = scoreLabel(score);

  const factorRows = FACTOR_ORDER.map((f) => symData.find((r) => r.factor === f)).filter(Boolean) as MultifactorRow[];

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Multi-Factor Setup Score</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            多因子設置評分 · Cross-model weighted integration · 0–100 pts
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: right now, how many independent signals are simultaneously pointing to an oversold / bullish setup for this coin?</em>
              </p>
              <p className="text-gray-400 mb-2">
                The <strong className="text-white">Multi-Factor Setup Score</strong> combines 15 independent factors into a single 0–100 score. Think of it like a checklist — the more boxes ticked, the stronger the historical setup quality.
              </p>
              <p className="text-gray-400 mb-3">
                A high score does <strong className="text-white">not</strong> mean the price will definitely go up. It means that historically, when multiple signals aligned like this, the odds of a short-term bounce were higher than average.
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Score ranges</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-green-400">70–100 Strong Setup</strong> — most factors favour a bullish setup simultaneously. Historically rarer but stronger setups.</li>
                <li><strong className="text-yellow-400">50–69 Moderate Setup</strong> — some factors aligned but not all. Moderate historical edge.</li>
                <li><strong className="text-gray-400">30–49 Weak Setup</strong> — conditions are mixed or mostly neutral.</li>
                <li><strong className="text-gray-600">0–29 No Setup</strong> — no meaningful alignment across factors.</li>
              </ul>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-3">What do the 15 factors measure?</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-gray-200">F1 RSI Oversold Intensity</strong> — how deeply oversold RSI-14 is (RSI=20 → max score). IC IR = +0.04.</li>
                <li><strong className="text-gray-200">F2 Bollinger Deviation</strong> — how far price has fallen below the Bollinger Band. IC IR = +0.01.</li>
                <li><strong className="text-gray-200">F3 GARCH Vol Regime</strong> — whether volatility is compressing (favourable) or expanding.</li>
                <li><strong className="text-gray-200">F4 Fear & Greed Zone</strong> — whether sentiment is in Extreme Fear (historically higher bounce rates).</li>
                <li><strong className="text-gray-200">F5 Month Seasonality</strong> — whether the current month historically has a positive bias. IC IR = +1.07 (Strong).</li>
                <li><strong className="text-gray-200">F6 Regime Favorability</strong> — HMM posterior probability of Bull regime. IC IR = −0.20.</li>
                <li><strong className="text-gray-200">F7 Volume Surge</strong> — volume spike on a down day (capitulation signal). IC IR = +0.38.</li>
                <li><strong className="text-gray-200">F8 Price Momentum</strong> — short-term momentum negative enough to suggest oversold conditions.</li>
                <li><strong className="text-gray-200">F9 Funding Rate</strong> — perpetual futures funding level: negative = crowded shorts, squeeze potential. IC IR = +1.41 (Strong).</li>
                <li><strong className="text-gray-200">F11 Active Addresses</strong> — daily unique BTC on-chain addresses vs 30-day MA. BTC only; ETH/SOL = N/A. IC IR measured separately.</li>
                <li><strong className="text-gray-200">F12 Turbulence Index</strong> — Mahalanobis distance across BTC/ETH/SOL: spikes signal systemic stress. Feature importance #2–3.</li>
                <li><strong className="text-gray-200">F13 MVRV Valuation</strong> — Market Value / Realized Value: below 1.0 = deep value zone. IC IR = +1.76 (strongest factor).</li>
                <li><strong className="text-gray-200">F14 Funding Rate Trend</strong> — 7-day directional change in funding rate. IC IR = +1.33 (Strong).</li>
                <li><strong className="text-gray-200">F15 BTC Dominance</strong> — BTC market cap share change (Dashboard only; data accumulating).</li>
                <li className="text-gray-600"><strong className="text-gray-500">F10 Long/Short Ratio</strong> — removed from XGBoost model; noise in out-of-sample testing.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：現在有多少個獨立指標同時指向這個幣的超賣／看漲設置？</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-white">多因子設置評分</strong>把 15 個獨立因子整合成一個 0–100 分。就像一份檢查清單——打勾的項目越多，歷史上設置質量越強。
              </p>
              <p className="text-gray-400 mb-3">
                高分<strong className="text-white">不代表</strong>價格一定會漲。它代表歷史上當多個信號同時出現時，短期反彈的概率比平均更高。
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">分數區間說明</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-green-400">70–100 強力設置</strong> — 大部分因子同時看多，歷史上較罕見但設置更強。</li>
                <li><strong className="text-yellow-400">50–69 中性偏多</strong> — 部分因子對齊，有一定歷史優勢。</li>
                <li><strong className="text-gray-400">30–49 設置偏弱</strong> — 條件混合或大多中性。</li>
                <li><strong className="text-gray-600">0–29 無明顯設置</strong> — 各因子之間無明顯對齊。</li>
              </ul>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-3">15 個因子各測量什麼？</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-gray-200">F1 RSI 超賣強度</strong> — RSI-14 有多超賣（RSI=20 → 最高分）。IC IR = +0.04。</li>
                <li><strong className="text-gray-200">F2 布林帶偏離幅度</strong> — 價格跌破布林下軌的程度。IC IR = +0.01。</li>
                <li><strong className="text-gray-200">F3 GARCH 波動率狀態</strong> — 波動率是否正在收縮（有利）或擴張。</li>
                <li><strong className="text-gray-200">F4 恐懼貪婪分層</strong> — 市場情緒是否處於極度恐懼（歷史上反彈率更高）。</li>
                <li><strong className="text-gray-200">F5 月份季節性</strong> — 當前月份在歷史上是否有正向偏向。IC IR = +1.07（Strong）。</li>
                <li><strong className="text-gray-200">F6 Regime 有利性</strong> — HMM 牛市後驗概率。IC IR = −0.20。</li>
                <li><strong className="text-gray-200">F7 成交量放大</strong> — 下跌日是否伴隨放量（恐慌性拋售信號）。IC IR = +0.38。</li>
                <li><strong className="text-gray-200">F8 價格動量偏離</strong> — 短期動量是否足夠負向以暗示超賣。</li>
                <li><strong className="text-gray-200">F9 資金費率水平</strong> — 負費率 = 空頭付給多頭，代表空頭擁擠有軋空潛力。IC IR = +1.41（Strong）。</li>
                <li><strong className="text-gray-200">F11 BTC 鏈上活躍地址</strong> — 每日唯一地址 vs 30 日均值。僅 BTC；ETH/SOL 顯示 N/A。</li>
                <li><strong className="text-gray-200">F12 市場異常指數</strong> — 三幣種馬氏距離：飆升代表系統性壓力事件。XGBoost 重要性排名 #2–3。</li>
                <li><strong className="text-gray-200">F13 MVRV 估值</strong> — 市值/已實現市值：低於 1.0 = 深度低估區。IC IR = +1.76（最強因子）。</li>
                <li><strong className="text-gray-200">F14 資金費率趨勢</strong> — 費率 7 日方向性變化。IC IR = +1.33（Strong）。</li>
                <li><strong className="text-gray-200">F15 BTC 市場佔有率</strong> — BTC 佔有率 7 日變化（Dashboard 展示，數據累積中）。</li>
                <li className="text-gray-600"><strong className="text-gray-500">F10 大戶多空比</strong> — 已從 XGBoost 移除；樣本外測試顯示為噪音。</li>
              </ul>
            </div>
          </div>
          <div className="pt-3 border-t border-white/[0.05] grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
            {FACTOR_ORDER.map((f) => {
              const meta = FACTOR_META[f];
              const w = data.find((r) => r.symbol === symKey && r.factor === f)?.weight;
              return (
                <div key={f} className="flex items-center gap-1.5">
                  <span>{meta.icon}</span>
                  <span className="text-gray-400">{meta.zh}</span>
                  <span className="text-gray-600 ml-auto">{w != null ? `${(w * 100).toFixed(0)}%` : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Symbol tabs */}
      <div className="flex gap-1 border-b border-gray-700 mt-4 mb-4">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => setSym(s)}
            className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              sym === s ? SYMBOL_BORDER[s] : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── 條件說明行 ── */}
      <div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">{sym}</span>
        <span className="text-gray-400"> current multi-factor setup score — how aligned are conditions for a short-term bounce </span>
        <span className="text-white font-medium">right now</span>
        <span className="text-gray-400">?</span>
        <span className="block mt-1 text-gray-500 text-sm">
          顯示：{sym} 當前多因子設置評分——現在的市場條件對短期反彈有多少個因子同時有利
        </span>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Score gauge */}
        <div className="flex flex-col items-center gap-2 xl:w-40 flex-shrink-0">
          <ScoreGauge score={score} color={scoreColor(score)} />
          <div className="text-center">
            <p className={`text-sm font-bold ${labelColor}`}>{label}</p>
            <p className="text-xs text-gray-500">{zh}</p>
            <p className="text-xs text-gray-600 mt-1 capitalize">Regime: {regime}</p>
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="flex-1 min-w-0 w-full">
          <p className="text-sm text-gray-400 mb-3">Factor Breakdown · 因子分解</p>
          <div className="space-y-2.5">
            {factorRows.map((row) => {
              const meta  = FACTOR_META[row.factor];
              const norm  = row.normalized_score ?? 0;
              const ws    = row.weighted_score ?? 0;
              const maxWS = row.weight ?? 0.2;
              const barPct = maxWS > 0 ? (ws / maxWS) * 100 : 0;
              return (
                <div key={row.factor} className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base leading-none">{meta.icon}</span>
                    <span className="text-xs font-medium text-gray-200 flex-1">{meta.label}</span>
                    <span className="text-xs text-gray-500">{meta.zh}</span>
                    <span className="text-xs font-semibold tabular-nums ml-2" style={{ color }}>
                      {(norm * 100).toFixed(0)}/100
                    </span>
                  </div>
                  {/* bar: filled portion of this factor's max weight */}
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(barPct, 100).toFixed(1)}%`, background: color, opacity: 0.8 }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{row.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Key Takeaway ── */}
      {(() => {
        const { label: scoreL, zh: scoreZh, color: scoreColor } = scoreLabel(score);
        let border = "border-gray-700";
        let bg = "bg-white/[0.03]";
        let icon = "~";
        let en = "";
        let zh = "";

        if (score >= 70) {
          border = "border-green-500/30"; bg = "bg-green-500/5"; icon = "✓";
          en = `${sym} current score: ${score.toFixed(0)}/100 (${scoreL}). Multiple factors are simultaneously aligned — RSI, Bollinger, Vol, Regime, and Seasonality are all contributing positively. Historically, setups like this have shown higher short-term bounce probability than average.`;
          zh = `${sym} 當前評分：${score.toFixed(0)}/100（${scoreZh}）。多個因子同時對齊，RSI、布林帶、波動率、Regime 和季節性均有正向貢獻。歷史上此類設置的短期反彈概率高於平均。`;
        } else if (score >= 50) {
          border = "border-gray-700"; bg = "bg-white/[0.03]"; icon = "~";
          en = `${sym} current score: ${score.toFixed(0)}/100 (${scoreL}). Some factors are aligned but the setup is not at full strength. Check the factor breakdown above to see which signals are contributing and which are neutral.`;
          zh = `${sym} 當前評分：${score.toFixed(0)}/100（${scoreZh}）。部分因子對齊但設置尚未達到全力。查看上方因子分解，了解哪些信號有貢獻、哪些中性。`;
        } else if (score >= 30) {
          border = "border-gray-700"; bg = "bg-white/[0.03]"; icon = "~";
          en = `${sym} current score: ${score.toFixed(0)}/100 (${scoreL}). Conditions are mixed — most factors are neutral or slightly unfavourable. Not a high-conviction setup at this time.`;
          zh = `${sym} 當前評分：${score.toFixed(0)}/100（${scoreZh}）。條件混合，大部分因子中性或略為不利。目前不是高信心設置。`;
        } else {
          border = "border-red-500/20"; bg = "bg-red-500/5"; icon = "✗";
          en = `${sym} current score: ${score.toFixed(0)}/100 (${scoreL}). Most factors are not aligned for a bullish setup. This does not predict a decline — it simply means conditions are unfavourable for a high-quality entry signal right now.`;
          zh = `${sym} 當前評分：${score.toFixed(0)}/100（${scoreZh}）。大部分因子未對齊看多設置。這不代表預測下跌——只是說明目前不是高質量入場信號的好時機。`;
        }

        return (
          <div className={`mt-5 rounded-lg border ${border} ${bg} px-4 py-3`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{icon} Key Takeaway</p>
            <p className="text-sm text-gray-200 leading-relaxed">{en}</p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">{zh}</p>
          </div>
        );
      })()}

      {/* ── Historical Calibration ── */}
      {(() => {
        const symKey      = `${sym}USDT`;
        const symSummary  = calibSummary.filter((r) => r.symbol === symKey);
        const symScatter  = calibScatter[symKey] ?? [];
        const color       = SYMBOL_COLOR[sym];

        if (symSummary.length === 0) return null;

        const PCT_ORDER = ["bottom 50%", "top 50%", "top 25%", "top 10%"];
        const PCT_LABELS: Record<string, { en: string; zh: string; color: string }> = {
          "bottom 50%": { en: "Bottom 50%",  zh: "後 50%",  color: "text-gray-500"  },
          "top 50%":    { en: "Top 50%",     zh: "前 50%",  color: "text-gray-300"  },
          "top 25%":    { en: "Top 25%",     zh: "前 25%",  color: "text-yellow-400"},
          "top 10%":    { en: "Top 10%",     zh: "前 10%",  color: "text-green-400" },
        };

        const currentScore = totalRow?.raw_value ?? 0;
        const sortedBuckets = symSummary.slice().sort((a, b) => a.score_min - b.score_min);
        let currentPctBucket = "bottom 50%";
        for (const b of sortedBuckets) {
          if (currentScore >= b.score_min) currentPctBucket = b.pct_bucket;
        }
        const currentBucketRow = symSummary.find((r) => r.pct_bucket === currentPctBucket);
        const currentPctLabel  = PCT_LABELS[currentPctBucket];

        return (
          <div className="mt-6 pt-5 border-t border-gray-800">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-200">Historical Calibration · 歷史校準</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  How did similar scores perform historically? · 歷史上相近分數的 7d 結果分布
                </p>
              </div>
              <button
                onClick={() => setShowCalibInfo((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0 ml-4"
              >
                {showCalibInfo ? "▾" : "▸"} How to read this?
              </button>
            </div>

            {/* Explainer dropdown */}
            {showCalibInfo && (
              <div className="mb-4 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
                    <p className="text-gray-300 mb-2">
                      <em>The core question: historically, when the Multi-Factor Score was this high, how often did the price go up 7 days later?</em>
                    </p>
                    <p className="text-gray-400 mb-2">
                      This section back-tests the scoring logic across all historical days. For each day, we compute what the score <em>would have been</em> using that day&apos;s data, then check if the price was higher 7 days later.
                    </p>
                    <p className="text-gray-400 mb-2">
                      The table groups days into <strong className="text-white">percentile buckets</strong> — e.g. &quot;Top 10%&quot; means days when the score was in the top 10% of all historical days. The key insight: do higher-scoring days show a higher win rate?
                    </p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-3">Important caveats</p>
                    <ul className="space-y-1 text-gray-400 text-xs">
                      <li>• <strong className="text-gray-300">Score distribution is right-skewed by design</strong> — high scores are intentionally rare (most days are normal, not extreme).</li>
                      <li>• <strong className="text-gray-300">F3 (GARCH) and F4 (Fear &amp; Greed) are excluded</strong> from calibration scoring — GARCH has no daily historical record, and F&amp;G uses a static proxy that would not vary day-to-day.</li>
                      <li>• This is <strong className="text-white">historical frequency, not a guarantee</strong>. Past patterns may not repeat.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
                    <p className="text-gray-300 mb-2">
                      <em>核心問題：歷史上當多因子評分這麼高時，7 天後價格上漲的頻率有多高？</em>
                    </p>
                    <p className="text-gray-400 mb-2">
                      這個區塊對所有歷史日期做回測：對每一天，用當天的數據算出「當天如果用這套評分系統會得多少分」，然後看 7 天後價格漲了還是跌了。
                    </p>
                    <p className="text-gray-400 mb-2">
                      表格按<strong className="text-white">歷史百分位</strong>分組——例如「Top 10%」代表分數在歷史上前 10% 的日子。核心問題：分數越高的日子，7d 勝率是否真的更高？
                    </p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-3">重要說明</p>
                    <ul className="space-y-1 text-gray-400 text-xs">
                      <li>• <strong className="text-gray-300">分數分布右偏屬設計預期</strong>——高分本就稀有，大部分日子都是正常市場，不是極端超賣。</li>
                      <li>• <strong className="text-gray-300">F3（GARCH）和 F4（恐懼貪婪）不納入校準評分</strong>——GARCH 無逐日歷史記錄，F&G 使用靜態代理，無法逐日變動。</li>
                      <li>• 這是<strong className="text-white">歷史頻率，不是保證</strong>。過去的模式不一定重複。</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic insight — Historical Calibration */}
            {currentBucketRow && (() => {
              const wr       = currentBucketRow.win_rate;
              const mean7d   = currentBucketRow.mean_7d;
              const bucket   = currentPctBucket;
              const isTop10  = bucket === "top 10%";
              const isTop25  = bucket === "top 25%" || isTop10;
              const isBot50  = bucket === "bottom 50%";
              let border = "border-gray-700", bg = "bg-white/[0.03]", icon = "–", titleColor = "text-gray-400";
              let enText = "", zhText = "";

              if (isTop10 && wr >= 0.54) {
                border = "border-green-500/30"; bg = "bg-green-500/5"; icon = "✓"; titleColor = "text-green-400";
                enText = `${sym} score ${currentScore.toFixed(1)} is in the Top 10% of all historical days. Days at this score level have historically shown a ${(wr*100).toFixed(1)}% win rate with mean 7d return of ${mean7d >= 0 ? "+" : ""}${(mean7d*100).toFixed(2)}% (n=${currentBucketRow.n}). This is the highest-conviction bucket in the calibration.`;
                zhText = `${sym} 當前分數 ${currentScore.toFixed(1)} 屬於歷史前 10% 的日子。這個分位數的日子歷史勝率 ${(wr*100).toFixed(1)}%，7d 平均回報 ${mean7d >= 0 ? "+" : ""}${(mean7d*100).toFixed(2)}%（n=${currentBucketRow.n}）。這是校準表中信心最高的分位數。`;
              } else if (isTop25 && wr >= 0.53) {
                border = "border-yellow-500/30"; bg = "bg-yellow-500/5"; icon = "~"; titleColor = "text-yellow-400";
                enText = `${sym} score ${currentScore.toFixed(1)} is in the Top ${isTop10 ? "10" : "25"}% of historical days. Historical win rate at this level: ${(wr*100).toFixed(1)}%, mean 7d return ${mean7d >= 0 ? "+" : ""}${(mean7d*100).toFixed(2)}% (n=${currentBucketRow.n}). Setup is above average but not at peak historical strength.`;
                zhText = `${sym} 當前分數 ${currentScore.toFixed(1)} 屬於歷史前 ${isTop10 ? "10" : "25"}% 的日子。歷史勝率 ${(wr*100).toFixed(1)}%，7d 平均回報 ${mean7d >= 0 ? "+" : ""}${(mean7d*100).toFixed(2)}%（n=${currentBucketRow.n}）。設置高於平均但未到歷史最強。`;
              } else if (isBot50) {
                border = "border-gray-700"; bg = "bg-white/[0.03]"; icon = "–"; titleColor = "text-gray-400";
                enText = `${sym} score ${currentScore.toFixed(1)} is in the Bottom 50% of historical days — meaning current conditions are below the median setup quality. Historical win rate at this level: ${(wr*100).toFixed(1)}% (n=${currentBucketRow.n}). No strong historical edge at this score level.`;
                zhText = `${sym} 當前分數 ${currentScore.toFixed(1)} 屬於歷史後 50% 的日子，低於中位數設置質量。這個分位數歷史勝率 ${(wr*100).toFixed(1)}%（n=${currentBucketRow.n}）。當前分數水平沒有明顯歷史優勢。`;
              } else {
                enText = `${sym} score ${currentScore.toFixed(1)} is in the ${currentPctLabel.en} of historical days. Historical win rate: ${(wr*100).toFixed(1)}%, mean 7d return ${mean7d >= 0 ? "+" : ""}${(mean7d*100).toFixed(2)}% (n=${currentBucketRow.n}).`;
                zhText = `${sym} 當前分數 ${currentScore.toFixed(1)} 屬於歷史${currentPctLabel.zh}的日子。歷史勝率 ${(wr*100).toFixed(1)}%，7d 平均回報 ${mean7d >= 0 ? "+" : ""}${(mean7d*100).toFixed(2)}%（n=${currentBucketRow.n}）。`;
              }

              return (
                <div className={`mb-4 rounded-lg border ${border} ${bg} px-4 py-3 text-sm`}>
                  <div className={`font-medium mb-2 ${titleColor}`}>{icon} Historical calibration for current score · 當前分數的歷史校準</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p className="text-gray-300 text-sm">{enText}</p>
                    <p className="text-gray-500 text-sm">{zhText}</p>
                  </div>
                </div>
              );
            })()}

            {/* Current score percentile banner */}
            {currentBucketRow && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
                <span className="text-gray-400">Current {sym} score </span>
                <span className="text-white font-medium">{currentScore.toFixed(1)}</span>
                <span className="text-gray-400"> is in the </span>
                <span className={`font-semibold ${currentPctLabel.color}`}>{currentPctLabel.en}</span>
                <span className="text-gray-400"> of historical days</span>
                <span className="text-gray-400"> · Historical win rate: </span>
                <span className="font-semibold" style={{ color }}>
                  {(currentBucketRow.win_rate * 100).toFixed(1)}%
                </span>
                <span className="text-gray-400"> (n={currentBucketRow.n})</span>
                <span className="block mt-1 text-gray-500 text-sm">
                  當前分數屬於歷史上{currentPctLabel.zh}的日子 · 該分位數日子 7d 勝率：{(currentBucketRow.win_rate * 100).toFixed(1)}%
                </span>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-5 items-start">
              {/* Summary table */}
              <div className="flex-1 min-w-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left">
                      <th className="text-xs text-gray-500 font-medium pb-2 pr-3">Percentile</th>
                      <th className="text-xs text-gray-500 font-medium pb-2 pr-3 text-right">n</th>
                      <th className="text-xs text-gray-500 font-medium pb-2 pr-3 text-right">Win Rate</th>
                      <th className="text-xs text-gray-500 font-medium pb-2 pr-3 text-right">Mean 7d</th>
                      <th className="text-xs text-gray-500 font-medium pb-2 text-right">Score range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PCT_ORDER.map((bucket) => {
                      const row = symSummary.find((r) => r.pct_bucket === bucket);
                      if (!row) return null;
                      const lbl      = PCT_LABELS[bucket];
                      const isCurrent = bucket === currentPctBucket;
                      return (
                        <tr
                          key={bucket}
                          className={`border-t border-gray-800 ${isCurrent ? "bg-white/[0.04]" : ""}`}
                        >
                          <td className={`py-2 pr-3 font-medium text-xs ${lbl.color}`}>
                            {lbl.en}
                            {isCurrent && (
                              <span className="ml-1.5 text-[10px] text-gray-500 font-normal">← now</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right text-gray-400 tabular-nums text-xs">{row.n}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-xs">
                            <span className={row.win_rate >= 0.55 ? "text-green-400" : row.win_rate < 0.50 ? "text-red-400" : "text-gray-300"}>
                              {(row.win_rate * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-xs">
                            <span className={row.mean_7d >= 0 ? "text-green-400" : "text-red-400"}>
                              {row.mean_7d >= 0 ? "+" : ""}{(row.mean_7d * 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-2 text-right text-gray-500 tabular-nums text-xs">
                            {row.score_min.toFixed(1)}–{row.score_max.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Scatter plot */}
              {symScatter.length > 0 && (
                <div className="flex-shrink-0">
                  <p className="text-xs text-gray-500 mb-1.5">Score vs 7d outcome · 分數 vs 7日回報</p>
                  <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-2 overflow-x-auto">
                    <CalibScatter points={symScatter} color={color} />
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5">
                    <span style={{ color }} className="opacity-70">●</span> win &nbsp;
                    <span className="text-red-500/70">●</span> loss &nbsp;·&nbsp;
                    sample of {symScatter.length} historical days
                  </p>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-gray-600 leading-relaxed">
              ⚠️ Calibration note: F3 (GARCH) and F4 (Fear & Greed) are excluded from calibration scoring — GARCH has no daily history, and F&G uses a static proxy. Score distribution is right-skewed by design; high scores are intentionally rare.
              <span className="block mt-0.5">校準說明：F3（GARCH）和 F4（恐懼貪婪）不納入校準評分（GARCH 無逐日歷史，F&G 使用靜態代理）。分數分布右偏屬設計預期，高分本就稀有。</span>
            </p>
          </div>
        );
      })()}

      {/* ── XGBoost Section ── */}
      {(() => {
        const symKey       = `${sym}USDT`;
        const symFolds     = xgbFolds.filter((r) => r.symbol === symKey);
        const symImportance = xgbImportance
          .filter((r) => r.symbol === symKey)
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
        const symPred      = xgbPredictions.find((r) => r.symbol === symKey);
        const color        = SYMBOL_COLOR[sym];

        if (symFolds.length === 0 && !symPred) return null;

        const avgAuc = symFolds.length > 0
          ? symFolds.reduce((s, r) => s + (r.auc ?? 0), 0) / symFolds.length
          : null;
        const avgDirAcc = symFolds.length > 0
          ? symFolds.reduce((s, r) => s + (r.dir_acc ?? 0), 0) / symFolds.length
          : null;
        const consistentFolds = symFolds.filter((r) => (r.auc ?? 0) > 0.52).length;
        const prob    = symPred?.xgb_win_prob     ?? null;
        const expRet  = symPred?.xgb_expected_ret ?? null;

        // Prob colour
        const probColor = prob == null ? "text-gray-400"
          : prob >= 0.58 ? "text-green-400"
          : prob <= 0.45 ? "text-red-400"
          : "text-gray-300";

        // Expected return colour
        const retColor = expRet == null ? "text-gray-400"
          : expRet >= 0.02 ? "text-green-400"
          : expRet <= -0.02 ? "text-red-400"
          : "text-gray-300";

        return (
          <div className="mt-6 pt-5 border-t border-gray-800">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-200">XGBoost Factor Validation · 因子重要性驗證</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Walk-forward back-test of predictive power · 機器學習驗證各因子對 7d 漲跌的預測能力
                </p>
              </div>
              <button
                onClick={() => setShowXgbInfo((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0 ml-4"
              >
                {showXgbInfo ? "▾" : "▸"} How to read this?
              </button>
            </div>

            {showXgbInfo && (
              <div className="mb-4 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
                    <p className="text-gray-300 mb-2">
                      <em>The core question: which of the 13 factors actually has predictive power for 7-day returns? And does the model generalise out-of-sample?</em>
                    </p>
                    <p className="text-gray-400 mb-2">
                      <strong className="text-white">XGBoost</strong> is a machine learning model that learns the optimal combination of the 13 factors to predict whether the price will be higher 7 days later. Unlike the static weighted score above, XGBoost discovers factor interactions automatically — e.g. RSI&lt;30 may only matter when Volume is also surging.
                    </p>
                    <p className="text-gray-400 mb-2">
                      <strong className="text-white">Walk-Forward validation</strong> prevents look-ahead bias: each year&apos;s test fold is predicted using only data from prior years. This mimics real-world deployment.
                    </p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-2">Reading the results</p>
                    <ul className="space-y-1 text-gray-400 text-xs">
                      <li>• <strong className="text-gray-300">Feature Importance</strong> — how much each factor contributed to the model&apos;s decisions (0 = unused).</li>
                      <li>• <strong className="text-gray-300">AUC</strong> (Area Under Curve) — measures how well the model ranks &quot;will go up&quot; vs &quot;will go down&quot;. AUC = 0.50 is pure chance (coin flip). AUC = 0.55 means meaningfully better than random. Think of it as the model&apos;s &quot;sorting ability&quot;.</li>
                      <li>• <strong className="text-gray-300">DirAcc</strong> (Directional Accuracy) — the % of days where the model correctly predicted the direction (up or down). 50% = random. 55% = model got the direction right 55 out of 100 times.</li>
                      <li>• <strong className="text-gray-300">RMSE</strong> (Root Mean Square Error) — average error when predicting the actual return magnitude. Lower is better. RMSE = 0.08 means predictions were off by ~8% on average.</li>
                      <li>• <strong className="text-gray-300">Win Probability</strong> — the model&apos;s current estimate of 7d upside probability based on today&apos;s factor values.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
                    <p className="text-gray-300 mb-2">
                      <em>核心問題：13 個因子中哪些真的有預測力？模型在樣本外是否仍然有效？</em>
                    </p>
                    <p className="text-gray-400 mb-2">
                      <strong className="text-white">XGBoost</strong> 是機器學習模型，自動學習 13 個因子的最優組合來預測 7 天後漲跌。與上方固定權重評分不同，XGBoost 能發現因子之間的交互效應——例如 RSI&lt;30 只在成交量同時放大時才有效。
                    </p>
                    <p className="text-gray-400 mb-2">
                      <strong className="text-white">Walk-Forward 驗證</strong>防止未來數據洩漏：每年的測試只使用該年之前的數據訓練，模擬真實部署場景。
                    </p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-2">如何看結果</p>
                    <ul className="space-y-1 text-gray-400 text-xs">
                      <li>• <strong className="text-gray-300">因子重要性</strong> — 每個因子對模型決策的貢獻程度（0 = 模型完全不使用該因子）。</li>
                      <li>• <strong className="text-gray-300">AUC</strong>（曲線下面積）— 模型區分「會漲」vs「會跌」的排序能力。0.50 = 跟擲硬幣一樣隨機；0.55 = 比隨機猜明顯更準。可以理解為模型的「排序準確度」。</li>
                      <li>• <strong className="text-gray-300">DirAcc</strong>（方向準確率）— 模型猜對漲跌方向的百分比。50% = 隨機；55% = 每 100 天猜對 55 次。這是最直覺的指標。</li>
                      <li>• <strong className="text-gray-300">RMSE</strong>（均方根誤差）— 預測回報幅度的平均誤差，越低越好。RMSE = 0.08 代表預測平均差了約 8%。</li>
                      <li>• <strong className="text-gray-300">當前預測勝率</strong> — 模型根據今天的因子數值，估計 7 天後上漲的概率。</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic insight — XGBoost */}
            {(() => {
              if (prob == null && avgAuc == null) return null;
              const dirAccPct = avgDirAcc != null ? avgDirAcc * 100 : null;
              const topFeat   = symImportance[0];
              const topName   = topFeat?.feature_name ?? topFeat?.feature ?? "—";

              let border = "border-gray-700", bg = "bg-white/[0.03]", icon = "–", titleColor = "text-gray-400";
              let enText = "", zhText = "";

              if (prob != null && prob >= 0.55 && avgAuc != null && avgAuc >= 0.52) {
                border = "border-green-500/30"; bg = "bg-green-500/5"; icon = "✓"; titleColor = "text-green-400";
                enText = `XGBoost currently shows a ${(prob*100).toFixed(1)}% win probability for ${sym} — above the 55% edge threshold. Model avg AUC = ${avgAuc.toFixed(3)}, avg DirAcc = ${dirAccPct != null ? dirAccPct.toFixed(1)+"%" : "—"} across ${symFolds.length} walk-forward folds. Top feature: ${topName}. This combination of elevated win probability and above-random AUC is relatively uncommon.`;
                zhText = `XGBoost 目前預測 ${sym} 勝率 ${(prob*100).toFixed(1)}%，高於 55% 優勢門檻。模型平均 AUC = ${avgAuc.toFixed(3)}，平均方向準確率 = ${dirAccPct != null ? dirAccPct.toFixed(1)+"%" : "—"}（${symFolds.length} 個滾動驗證折）。最重要因子：${topName}。這種高勝率配合高於隨機的 AUC 組合相對罕見。`;
              } else if (prob != null && prob <= 0.45) {
                border = "border-red-500/20"; bg = "bg-red-500/[0.03]"; icon = "⚠"; titleColor = "text-red-400";
                enText = `XGBoost's current win probability for ${sym} is ${(prob*100).toFixed(1)}% — below 45%, suggesting bearish model bias. Model avg AUC = ${avgAuc != null ? avgAuc.toFixed(3) : "—"}, avg DirAcc = ${dirAccPct != null ? dirAccPct.toFixed(1)+"%" : "—"}. This does not guarantee a decline, but the model does not see a favourable setup in today's factor values.`;
                zhText = `XGBoost 目前預測 ${sym} 勝率 ${(prob*100).toFixed(1)}%，低於 45%，模型偏空。平均 AUC = ${avgAuc != null ? avgAuc.toFixed(3) : "—"}，平均方向準確率 = ${dirAccPct != null ? dirAccPct.toFixed(1)+"%" : "—"}。這不代表一定下跌，但模型在今天的因子數值中看不到有利的進場設置。`;
              } else {
                enText = `XGBoost win probability for ${sym}: ${prob != null ? (prob*100).toFixed(1)+"%" : "—"} (neutral range). Model avg AUC = ${avgAuc != null ? avgAuc.toFixed(3) : "—"}, avg DirAcc = ${dirAccPct != null ? dirAccPct.toFixed(1)+"%" : "—"} across ${symFolds.length} folds. Top contributing factor: ${topName}.`;
                zhText = `XGBoost 預測 ${sym} 勝率 ${prob != null ? (prob*100).toFixed(1)+"%" : "—"}（中性區間）。平均 AUC = ${avgAuc != null ? avgAuc.toFixed(3) : "—"}，平均方向準確率 = ${dirAccPct != null ? dirAccPct.toFixed(1)+"%" : "—"}（${symFolds.length} 個折）。最重要因子：${topName}。`;
              }

              return (
                <div className={`mb-4 rounded-lg border ${border} ${bg} px-4 py-3 text-sm`}>
                  <div className={`font-medium mb-2 ${titleColor}`}>{icon} XGBoost current prediction · 當前 XGBoost 預測解讀</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p className="text-gray-300 text-sm">{enText}</p>
                    <p className="text-gray-500 text-sm">{zhText}</p>
                  </div>
                </div>
              );
            })()}

            {/* Current prediction + avg AUC banner */}
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {prob != null && (
                  <span>
                    <span className="text-gray-400 text-xs">Win Prob </span>
                    <span className={`font-bold text-base ${probColor}`}>{(prob * 100).toFixed(1)}%</span>
                    <span className="text-gray-500 ml-1 text-xs">
                      ({prob >= 0.58 ? "↑ edge" : prob <= 0.45 ? "↓ cautious" : "→ neutral"})
                    </span>
                  </span>
                )}
                {expRet != null && (
                  <span>
                    <span className="text-gray-400 text-xs">Expected 7d Ret </span>
                    <span className={`font-bold text-base ${retColor}`}>
                      {expRet >= 0 ? "+" : ""}{(expRet * 100).toFixed(1)}%
                    </span>
                  </span>
                )}
                {avgAuc != null && (
                  <span className="text-gray-500 text-xs">
                    avg AUC <span className={avgAuc >= 0.52 ? "text-green-400" : "text-gray-400"}>{avgAuc.toFixed(3)}</span>
                    {" · "}avg DirAcc <span className={avgDirAcc != null && avgDirAcc >= 0.52 ? "text-green-400" : "text-gray-400"}>
                      {avgDirAcc != null ? (avgDirAcc * 100).toFixed(1) + "%" : "—"}
                    </span>
                    {" · "}{consistentFolds}/{symFolds.length} folds AUC&gt;0.52
                  </span>
                )}
              </div>
              {(prob != null || expRet != null) && (
                <span className="block mt-1 text-gray-500 text-xs">
                  {prob != null && `勝率 ${(prob * 100).toFixed(1)}%`}
                  {prob != null && expRet != null && " · "}
                  {expRet != null && `預期回報 ${expRet >= 0 ? "+" : ""}${(expRet * 100).toFixed(1)}%`}
                  {avgAuc != null && ` · avg AUC ${avgAuc.toFixed(3)}`}
                </span>
              )}
            </div>

            <div className="flex flex-col lg:flex-row gap-5 items-start">
              {/* Feature importance bars */}
              {symImportance.length > 0 && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-2">Feature Importance · 因子重要性（全歷史訓練）</p>
                  <div className="space-y-1.5">
                    {symImportance.map((row) => {
                      const imp    = row.importance ?? 0;
                      const isZero = imp === 0;
                      return (
                        <div key={row.feature ?? ""} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-44 flex-shrink-0 truncate">
                            {row.feature_name ?? row.feature}
                          </span>
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(imp * 100).toFixed(1)}%`,
                                background: isZero ? "#374151" : color,
                                opacity: isZero ? 0.3 : 0.85,
                              }}
                            />
                          </div>
                          <span className={`text-xs tabular-nums w-10 text-right ${isZero ? "text-gray-600" : "text-gray-300"}`}>
                            {isZero ? "—" : (imp * 100).toFixed(1) + "%"}
                          </span>
                          {isZero && (
                            <span className="text-[10px] text-red-400/70">unused</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Walk-forward AUC table */}
              {symFolds.length > 0 && (
                <div className="flex-shrink-0 w-full lg:w-64">
                  <p className="text-xs text-gray-500 mb-2">Walk-Forward Results by Year</p>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left text-gray-500 font-medium pb-1.5 pr-2">Year</th>
                        <th className="text-right text-gray-500 font-medium pb-1.5 pr-2">AUC</th>
                        <th className="text-right text-gray-500 font-medium pb-1.5 pr-2">DirAcc</th>
                        <th className="text-right text-gray-500 font-medium pb-1.5">RMSE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {symFolds.map((fold) => {
                        const auc    = fold.auc ?? 0;
                        const dirAcc = fold.dir_acc ?? null;
                        const rmse   = fold.rmse ?? null;
                        const hasEdge = auc > 0.52;
                        return (
                          <tr key={fold.test_year} className="border-t border-gray-800/60">
                            <td className="py-1 pr-2 text-gray-400">{fold.test_year}</td>
                            <td className={`py-1 pr-2 text-right tabular-nums font-medium ${hasEdge ? "text-green-400" : auc < 0.48 ? "text-red-400/80" : "text-gray-400"}`}>
                              {auc.toFixed(3)}
                            </td>
                            <td className={`py-1 pr-2 text-right tabular-nums ${dirAcc != null && dirAcc >= 0.52 ? "text-green-400" : "text-gray-500"}`}>
                              {dirAcc != null ? (dirAcc * 100).toFixed(1) + "%" : "—"}
                            </td>
                            <td className="py-1 text-right tabular-nums text-gray-500">
                              {rmse != null ? rmse.toFixed(3) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-gray-600 leading-relaxed">
              Model v4.1 · 15 features (continuous + lag) · Purged walk-forward · Rolling 3y final model · Training from 2017-11-01.
              AUC measures ranking ability; DirAcc measures directional accuracy; Expected Ret is the regression model&apos;s 7d return forecast.
              <span className="block mt-0.5">模型 v4.1 · 15 個連續特徵（含滯後特徵）· Purged Walk-Forward · 最終模型滾動 3 年訓練。AUC 衡量排序能力；DirAcc 衡量方向準確率；預期回報為回歸模型的 7 天回報率預測。</span>
            </p>
          </div>
        );
      })()}

      {/* ── Ensemble Section ─────────────────────────────────────── */}
      {ensembleFolds.length > 0 && (() => {
        const symFolds = ensembleFolds.filter(r => r.symbol === symKey);
        const symPred  = ensemblePredictions.find(r => r.symbol === symKey);
        if (symFolds.length === 0) return null;

        const avgXgb = symFolds.reduce((s, r) => s + parseFloat(r.xgb_auc), 0) / symFolds.length;
        const avgLgb = symFolds.reduce((s, r) => s + parseFloat(r.lgb_auc), 0) / symFolds.length;
        const avgEns = symFolds.reduce((s, r) => s + parseFloat(r.ens_auc), 0) / symFolds.length;
        const avgDir = symFolds.reduce((s, r) => s + parseFloat(r.dir_acc), 0) / symFolds.length;
        const ensPct  = symPred ? parseFloat(symPred.ensemble_win_prob) : null;
        const ensRet  = symPred ? parseFloat(symPred.ensemble_expected_ret) : null;
        const improvement = avgEns - avgXgb;

        return (
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-950/40 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-200">Ensemble Model · XGBoost + LightGBM</p>
                <p className="text-xs text-gray-500">Soft voting average · 兩模型概率平均，抵消單模型偏差</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                {improvement > 0
                  ? <span className="text-xs text-green-400 font-medium">↑ AUC +{(improvement * 1000).toFixed(1)} pts vs XGB alone</span>
                  : <span className="text-xs text-gray-500 font-medium">≈ Similar to XGB alone</span>
                }
                <button onClick={() => setShowEnsInfo((v) => !v)} className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap">
                  {showEnsInfo ? "▾" : "▸"} How to read this?
                </button>
              </div>
            </div>

            {/* Explainer */}
            {showEnsInfo && (
              <div className="mb-4 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
                    <p className="text-gray-300 mb-2">
                      <em>The core question: does combining XGBoost and LightGBM produce better predictions than either model alone?</em>
                    </p>
                    <p className="text-gray-400 mb-2">
                      <strong className="text-white">Soft voting ensemble</strong> averages the win probability predicted by XGBoost and LightGBM. Because the two models have different biases, averaging them tends to reduce overconfident predictions and smooth out single-model errors.
                    </p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-2">Reading the table</p>
                    <ul className="space-y-1 text-gray-400 text-xs">
                      <li>• <strong className="text-gray-300">▲ in Ensemble AUC</strong> — ensemble outperformed both individual models in that fold.</li>
                      <li>• <strong className="text-gray-300">DirAcc</strong> — directional accuracy of the ensemble. 50% = coin flip; 55% = meaningful edge.</li>
                      <li>• <strong className="text-gray-300">Ensemble Win Prob</strong> — the averaged model's current probability estimate for a 7d up move.</li>
                      <li>• <strong className="text-gray-300">AUC improvement</strong> shown in the top-right badge — how many AUC points the ensemble gained vs XGBoost alone.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
                    <p className="text-gray-300 mb-2">
                      <em>核心問題：XGBoost + LightGBM 組合是否比單一模型預測更準？</em>
                    </p>
                    <p className="text-gray-400 mb-2">
                      <strong className="text-white">軟投票集成</strong>把兩個模型預測的勝率平均，因為兩個模型各有不同偏差，平均後能減少過度自信的預測，平滑單模型誤差。
                    </p>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-2">如何看表格</p>
                    <ul className="space-y-1 text-gray-400 text-xs">
                      <li>• <strong className="text-gray-300">Ensemble AUC 有 ▲</strong> — 集成在那一折同時優於兩個單獨模型。</li>
                      <li>• <strong className="text-gray-300">DirAcc</strong> — 集成的方向準確率。50% = 隨機；55% = 有實質優勢。</li>
                      <li>• <strong className="text-gray-300">集成勝率</strong> — 目前集成模型估計的 7 天上漲概率。</li>
                      <li>• <strong className="text-gray-300">AUC 提升</strong> — 右上角 badge 顯示集成相比單獨 XGBoost 提升了多少 AUC 點數。</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic insight — Ensemble */}
            {ensPct != null && (() => {
              const dirAccPct = avgDir * 100;
              let border = "border-gray-700", bg = "bg-white/[0.03]", icon = "–", titleColor = "text-gray-400";
              let enText = "", zhText = "";

              if (ensPct >= 0.55 && avgEns >= 0.52) {
                border = "border-green-500/30"; bg = "bg-green-500/5"; icon = "✓"; titleColor = "text-green-400";
                enText = `The Ensemble model shows ${(ensPct*100).toFixed(1)}% win probability for ${sym} — above the 55% threshold. Avg ensemble AUC = ${avgEns.toFixed(3)}, avg DirAcc = ${dirAccPct.toFixed(1)}% across ${symFolds.length} folds.${improvement > 0 ? ` The ensemble gained +${(improvement*1000).toFixed(1)} AUC pts vs XGBoost alone, confirming the diversification benefit.` : ""}`;
                zhText = `集成模型預測 ${sym} 勝率 ${(ensPct*100).toFixed(1)}%，高於 55% 門檻。平均集成 AUC = ${avgEns.toFixed(3)}，平均方向準確率 = ${dirAccPct.toFixed(1)}%（${symFolds.length} 個折）。${improvement > 0 ? `集成相比單獨 XGBoost 提升了 +${(improvement*1000).toFixed(1)} AUC 點，驗證了分散化效益。` : ""}`;
              } else if (ensPct <= 0.45) {
                border = "border-red-500/20"; bg = "bg-red-500/[0.03]"; icon = "⚠"; titleColor = "text-red-400";
                enText = `Ensemble win probability for ${sym} is ${(ensPct*100).toFixed(1)}% — the combined model leans bearish. Avg AUC = ${avgEns.toFixed(3)}, avg DirAcc = ${dirAccPct.toFixed(1)}%. Neither XGBoost nor LightGBM sees a favourable setup in today's conditions.`;
                zhText = `集成模型預測 ${sym} 勝率 ${(ensPct*100).toFixed(1)}%，組合模型偏空。平均 AUC = ${avgEns.toFixed(3)}，平均方向準確率 = ${dirAccPct.toFixed(1)}%。XGBoost 和 LightGBM 均未在今天的條件中看到有利設置。`;
              } else {
                enText = `Ensemble win probability for ${sym}: ${(ensPct*100).toFixed(1)}% (neutral). Avg AUC = ${avgEns.toFixed(3)}, avg DirAcc = ${dirAccPct.toFixed(1)}% across ${symFolds.length} folds.${improvement > 0 ? ` Ensemble gained +${(improvement*1000).toFixed(1)} AUC pts vs XGB alone.` : " Performance is similar to XGBoost alone."}`;
                zhText = `集成模型預測 ${sym} 勝率 ${(ensPct*100).toFixed(1)}%（中性）。平均 AUC = ${avgEns.toFixed(3)}，平均方向準確率 = ${dirAccPct.toFixed(1)}%（${symFolds.length} 個折）。${improvement > 0 ? `集成相比 XGBoost 提升 +${(improvement*1000).toFixed(1)} AUC 點。` : "集成效果與單獨 XGBoost 相近。"}`;
              }

              return (
                <div className={`mb-4 rounded-lg border ${border} ${bg} px-4 py-3 text-sm`}>
                  <div className={`font-medium mb-2 ${titleColor}`}>{icon} Ensemble current prediction · 集成模型當前預測</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p className="text-gray-300 text-sm">{enText}</p>
                    <p className="text-gray-500 text-sm">{zhText}</p>
                  </div>
                </div>
              );
            })()}

            {/* Prediction banner */}
            {ensPct != null && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm flex flex-wrap gap-x-5 gap-y-1">
                <span>
                  <span className="text-gray-400 text-xs">Ensemble Win Prob </span>
                  <span className={`font-bold ${ensPct >= 0.55 ? "text-green-400" : ensPct >= 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                    {(ensPct * 100).toFixed(1)}%
                  </span>
                </span>
                {ensRet != null && (
                  <span>
                    <span className="text-gray-400 text-xs">Expected Ret </span>
                    <span className={`font-medium ${ensRet >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {ensRet >= 0 ? "+" : ""}{(ensRet * 100).toFixed(1)}%
                    </span>
                  </span>
                )}
                <span className="text-xs text-gray-600 self-center">集成模型預測勝率 · 預期 7 天回報</span>
              </div>
            )}

            {/* Comparison table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-2 py-1.5 text-left text-gray-500">Year</th>
                    <th className="px-2 py-1.5 text-center text-gray-500">XGB AUC</th>
                    <th className="px-2 py-1.5 text-center text-gray-500">LGB AUC</th>
                    <th className="px-2 py-1.5 text-center text-blue-400/70">Ensemble AUC</th>
                    <th className="px-2 py-1.5 text-center text-gray-500">DirAcc</th>
                  </tr>
                </thead>
                <tbody>
                  {symFolds.map((r, i) => {
                    const ensV = parseFloat(r.ens_auc);
                    const xgbV = parseFloat(r.xgb_auc);
                    const lgbV = parseFloat(r.lgb_auc);
                    const better = ensV > Math.max(xgbV, lgbV);
                    return (
                      <tr key={i} className="border-b border-gray-900 hover:bg-white/[0.02]">
                        <td className="px-2 py-1.5 text-gray-400">{r.test_year}</td>
                        <td className="px-2 py-1.5 text-center text-gray-400">{xgbV.toFixed(3)}</td>
                        <td className="px-2 py-1.5 text-center text-gray-400">{lgbV.toFixed(3)}</td>
                        <td className={`px-2 py-1.5 text-center font-medium ${better ? "text-blue-400" : ensV >= 0.52 ? "text-green-400" : "text-gray-400"}`}>
                          {ensV.toFixed(3)}{better ? " ▲" : ""}
                        </td>
                        <td className={`px-2 py-1.5 text-center ${parseFloat(r.dir_acc) >= 0.52 ? "text-green-400" : "text-gray-500"}`}>
                          {(parseFloat(r.dir_acc) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-gray-700 bg-gray-900/40">
                    <td className="px-2 py-1.5 text-gray-400 font-medium">avg</td>
                    <td className="px-2 py-1.5 text-center text-gray-400 font-medium">{avgXgb.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-center text-gray-400 font-medium">{avgLgb.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-center text-blue-400 font-medium">{avgEns.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-center text-gray-400 font-medium">{(avgDir * 100).toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-600">Ensemble = (XGBoost prob + LightGBM prob) / 2 · Purged walk-forward · Rolling 3y · ▲ = ensemble beats both individual models in that fold</p>
          </div>
        );
      })()}

      <div className="mt-4 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-purple-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          Score reflects current factor alignment based on historical patterns — not a trading signal. Weights are static and not dynamically optimised. Always cross-reference with the individual panels. 評分反映當前因子組合的歷史對齊程度，不構成交易信號。權重為靜態設定，未經動態優化。請結合各個獨立面板綜合判斷。
        </p>
      </div>
    </div>
  );
}
