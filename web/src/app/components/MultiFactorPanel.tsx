"use client";

// MultiFactorPanel — Multi-Factor Setup Score
// 跨模型加權整合：6個因子 → 0-100分的入場設置質量評分

import { useState } from "react";

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

export default function MultiFactorPanel({ data }: { data: MultifactorRow[] }) {
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
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                The <strong className="text-white">Multi-Factor Setup Score</strong> integrates 6 models into a single 0–100 quality score for the current market setup. Each factor contributes a weighted portion based on its historical relevance to short-term bounces.
              </p>
              <p className="text-gray-400 text-sm">
                High score = multiple independent models simultaneously favour a bullish setup. Low score = neutral or unfavourable conditions. This is a <em>cross-model synthesis</em>, not a standalone prediction.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">多因子設置評分</strong>將 6 個現有模型整合為 0–100 的當前市場設置質量分。每個因子根據其對短期反彈的歷史相關性貢獻加權分數。
              </p>
              <p className="text-gray-400 text-sm">
                高分 = 多個獨立模型同時指向看漲設置。低分 = 中性或不利條件。這是<em>跨模型綜合評分</em>，不是獨立預測信號。
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-400">
            {FACTOR_ORDER.map((f) => {
              const meta = FACTOR_META[f];
              const w = data.find((r) => r.symbol === symKey && r.factor === f)?.weight;
              return (
                <div key={f} className="flex items-center gap-1.5">
                  <span>{meta.icon}</span>
                  <span className="text-gray-300">{meta.label}</span>
                  <span className="text-gray-600 ml-auto">{w != null ? `${(w * 100).toFixed(0)}%` : ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Symbol tabs */}
      <div className="flex gap-1 border-b border-gray-700 mt-4 mb-5">
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

      <div className="mt-5 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-purple-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          Score reflects current factor alignment based on historical patterns — not a trading signal. Weights are static and not dynamically optimised. Always cross-reference with the individual panels. 評分反映當前因子組合的歷史對齊程度，不構成交易信號。權重為靜態設定，未經動態優化。請結合各個獨立面板綜合判斷。
        </p>
      </div>
    </div>
  );
}
