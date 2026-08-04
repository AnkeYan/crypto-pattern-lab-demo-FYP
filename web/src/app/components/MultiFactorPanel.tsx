"use client";

// MultiFactorPanel — Multi-Factor Setup Score
// 跨模型加權整合：8個因子 → 0-100分的入場設置質量評分 + 歷史校準區塊

import { useMemo, useState } from "react";

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
  rsi_intensity:       { label: "RSI Oversold Intensity",   zh: "RSI 超賣強度",     icon: "📉" },
  bollinger_deviation: { label: "Bollinger Deviation",       zh: "布林帶偏離幅度",   icon: "📊" },
  garch_vol_regime:    { label: "GARCH Vol Regime",          zh: "波動率收縮/擴張",  icon: "🌊" },
  fear_greed_zone:     { label: "Fear & Greed Zone",         zh: "恐懼貪婪指標分層", icon: "😱" },
  month_seasonality:   { label: "Month Seasonality Bias",    zh: "月份季節性偏向",   icon: "📅" },
  regime_favorability: { label: "Regime Signal Favorability",zh: "Regime 信號有效性",icon: "🎯" },
  volume_surge:        { label: "Volume Surge",               zh: "成交量放大訊號",   icon: "📦" },
  price_momentum:      { label: "Price Momentum",             zh: "價格動量偏離",     icon: "⚡" },
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

export default function MultiFactorPanel({
  data,
  calibSummary = [],
  calibScatter = {},
}: {
  data: MultifactorRow[];
  calibSummary?: CalibSummaryRow[];
  calibScatter?: Record<string, CalibScatterPoint[]>;
}) {
  const [sym, setSym] = useState("BTC");
  const [showInfo, setShowInfo] = useState(false);

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
                The <strong className="text-white">Multi-Factor Setup Score</strong> combines 8 different models into a single 0–100 score. Think of it like a checklist — the more boxes ticked, the stronger the historical setup quality.
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-3">What do the 8 factors measure?</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-gray-200">RSI Oversold Intensity</strong> — how deeply oversold the RSI is (RSI=20 → max score)</li>
                <li><strong className="text-gray-200">Bollinger Deviation</strong> — how far price has fallen below the Bollinger Band</li>
                <li><strong className="text-gray-200">GARCH Vol Regime</strong> — whether volatility is compressing (favourable) or expanding</li>
                <li><strong className="text-gray-200">Fear & Greed Zone</strong> — whether market sentiment is in Extreme Fear (historically higher bounce rates)</li>
                <li><strong className="text-gray-200">Month Seasonality</strong> — whether the current month historically has a positive bias</li>
                <li><strong className="text-gray-200">Regime Favorability</strong> — whether the current market regime (bull/bear/sideways) has historically been favourable for signals</li>
                <li><strong className="text-gray-200">Volume Surge</strong> — whether there is a volume spike on a down day (capitulation signal)</li>
                <li><strong className="text-gray-200">Price Momentum</strong> — whether short-term momentum is negative enough to suggest oversold conditions</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：現在有多少個獨立指標同時指向這個幣的超賣／看漲設置？</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-white">多因子設置評分</strong>把 8 個不同模型整合成一個 0–100 分。就像一份檢查清單——打勾的項目越多，歷史上設置質量越強。
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
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 mt-3">8 個因子各測量什麼？</p>
              <ul className="space-y-1 text-gray-400">
                <li><strong className="text-gray-200">RSI 超賣強度</strong> — RSI 有多超賣（RSI=20 → 最高分）</li>
                <li><strong className="text-gray-200">布林帶偏離幅度</strong> — 價格跌破布林下軌的程度</li>
                <li><strong className="text-gray-200">GARCH 波動率狀態</strong> — 波動率是否正在收縮（有利）或擴張</li>
                <li><strong className="text-gray-200">恐懼貪婪指標分層</strong> — 市場情緒是否處於極度恐懼（歷史上反彈率更高）</li>
                <li><strong className="text-gray-200">月份季節性偏向</strong> — 當前月份在歷史上是否有正向偏向</li>
                <li><strong className="text-gray-200">Regime 信號有效性</strong> — 當前市場狀態（牛熊橫盤）歷史上對信號是否有利</li>
                <li><strong className="text-gray-200">成交量放大訊號</strong> — 下跌日是否伴隨放量（恐慌性拋售信號）</li>
                <li><strong className="text-gray-200">價格動量偏離</strong> — 短期動量是否足夠負向以暗示超賣</li>
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

        // Current score percentile (approximated from calibration data)
        // Find the closest score_max in each bucket to determine where current score sits
        const currentScore = totalRow?.raw_value ?? 0;
        // Find which bucket the current score would fall into based on historical thresholds
        const sortedBuckets = symSummary.slice().sort((a, b) => a.score_min - b.score_min);
        let currentPctBucket = "bottom 50%";
        for (const b of sortedBuckets) {
          if (currentScore >= b.score_min) currentPctBucket = b.pct_bucket;
        }
        const currentBucketRow = symSummary.find((r) => r.pct_bucket === currentPctBucket);
        const currentPctLabel  = PCT_LABELS[currentPctBucket];

        return (
          <div className="mt-6 pt-5 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-200">Historical Calibration · 歷史校準</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  How did similar scores perform historically? · 歷史上相近分數的 7d 結果分布
                </p>
              </div>
            </div>

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

      <div className="mt-4 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-purple-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          Score reflects current factor alignment based on historical patterns — not a trading signal. Weights are static and not dynamically optimised. Always cross-reference with the individual panels. 評分反映當前因子組合的歷史對齊程度，不構成交易信號。權重為靜態設定，未經動態優化。請結合各個獨立面板綜合判斷。
        </p>
      </div>
    </div>
  );
}
