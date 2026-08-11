"use client";

import { useState } from "react";
import { useTier } from "../lib/useTier";

// ── Types ──────────────────────────────────────────────────────────────────
type Row = {
  row_type: string;
  label: string;
  value: number | null;
  extra: string;
};

type Props = { data: Row[] };

const COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
};

function PieChart({ weights }: { weights: Record<string, number> }) {
  const entries = Object.entries(weights).filter(([, v]) => v > 0);
  let cumAngle  = -90;
  const r = 80;
  const cx = 100, cy = 100;

  const slices = entries.map(([ticker, w]) => {
    const angle     = w * 360;
    const startAngle = cumAngle;
    cumAngle        += angle;
    const endAngle  = cumAngle;
    const start = {
      x: cx + r * Math.cos((startAngle * Math.PI) / 180),
      y: cy + r * Math.sin((startAngle * Math.PI) / 180),
    };
    const end = {
      x: cx + r * Math.cos((endAngle * Math.PI) / 180),
      y: cy + r * Math.sin((endAngle * Math.PI) / 180),
    };
    const largeArc = angle > 180 ? 1 : 0;
    const midAngle = startAngle + angle / 2;
    const labelR   = r * 0.65;
    const labelX   = cx + labelR * Math.cos((midAngle * Math.PI) / 180);
    const labelY   = cy + labelR * Math.sin((midAngle * Math.PI) / 180);
    return { ticker, w, start, end, largeArc, labelX, labelY, color: COLORS[ticker] ?? "#888" };
  });

  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40">
      {slices.map(({ ticker, start, end, largeArc, labelX, labelY, color, w }) => (
        <g key={ticker}>
          <path
            d={`M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`}
            fill={color}
            stroke="#0f172a"
            strokeWidth="1.5"
          />
          {w > 0.08 && (
            <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle"
              fontSize="11" fontWeight="700" fill="white">
              {Math.round(w * 100)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function PortfolioOptimizationPanel({ data }: Props) {
  const [mode, setMode]   = useState<"maxsharpe" | "minvol">("maxsharpe");
  const [open, setOpen]   = useState(false);

  // Parse data
  const mvoWeights:    Record<string, number> = {};
  const minvolWeights: Record<string, number> = {};
  const metrics:       Record<string, number | string> = {};
  const history: { date: string; equal: number; mvo: number }[] = [];
  const frontier: { risk: number; ret: number; sharpe: number }[] = [];

  for (const row of data) {
    if (row.row_type === "weights")        mvoWeights[row.label]    = row.value ?? 0;
    if (row.row_type === "minvol_weights") minvolWeights[row.label] = row.value ?? 0;
    if (row.row_type === "metrics")        metrics[row.label]       = row.value ?? row.extra;
    if (row.row_type === "history") {
      history.push({ date: row.label, equal: row.value ?? 0, mvo: parseFloat(row.extra) });
    }
    if (row.row_type === "frontier") {
      frontier.push({ risk: parseFloat(row.label), ret: row.value ?? 0, sharpe: parseFloat(row.extra) });
    }
  }

  const activeWeights = mode === "maxsharpe" ? mvoWeights : minvolWeights;
  const activeSharpe  = mode === "maxsharpe" ? metrics["mvo_sharpe"]  : metrics["minvol_sharpe"];
  const activeReturn  = mode === "maxsharpe" ? metrics["mvo_return"]  : metrics["minvol_return"];
  const activeVol     = mode === "maxsharpe" ? metrics["mvo_vol"]     : metrics["minvol_vol"];
  const trainStart    = metrics["train_start"] as string ?? "";
  const trainEnd      = metrics["train_end"]   as string ?? "";

  // History chart dimensions
  const W = 520, H = 160, PAD = { top: 12, right: 8, bottom: 28, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  const histMin = history.length > 0 ? Math.min(...history.map(h => Math.min(h.equal, h.mvo))) : 80;
  const histMax = history.length > 0 ? Math.max(...history.map(h => Math.max(h.equal, h.mvo))) : 120;
  const yRange  = histMax - histMin || 1;

  const toX = (i: number) => PAD.left + (i / Math.max(history.length - 1, 1)) * chartW;
  const toY = (v: number) => PAD.top  + chartH - ((v - histMin) / yRange) * chartH;

  const eqPath  = history.map((h, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(h.equal)}`).join(" ");
  const mvoPath = history.map((h, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(h.mvo)}`).join(" ");

  // Tick dates (every ~6 months)
  const tickIndices = history.length > 0
    ? [0, Math.floor(history.length / 4), Math.floor(history.length / 2),
       Math.floor(history.length * 3 / 4), history.length - 1]
    : [];

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Portfolio Optimization</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase">Research</span>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          What's the historically optimal allocation across BTC, ETH, and SOL?&nbsp;
          <span className="text-gray-600">BTC / ETH / SOL 的最優配比是多少？</span>
        </p>
      </div>

      {/* How to read */}
      <div className="mb-4">
        <button onClick={() => setOpen(!open)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
          <span>{open ? "▾" : "▸"}</span>
          <span>How to read this? / 如何解讀？</span>
        </button>
        {open && (
          <div className="mt-2 rounded-lg bg-white/[0.04] border border-white/[0.06] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">ENGLISH</div>
              <p className="text-gray-300 mb-2">This panel answers: <em>"If I hold BTC, ETH, and SOL, what allocation historically maximises risk-adjusted return?"</em></p>
              <p className="text-gray-400 text-xs"><strong>Max Sharpe</strong> — finds the weights that maximise Sharpe Ratio (return ÷ risk). Best for growth-oriented investors.</p>
              <p className="text-gray-400 text-xs mt-1"><strong>Min Volatility</strong> — finds the safest allocation with the lowest historical volatility. Best for risk-averse investors.</p>
              <p className="text-gray-400 text-xs mt-1"><strong>Sharpe Ratio</strong> — how much return you get per unit of risk. Higher = better risk-adjusted performance.</p>
              <p className="text-gray-400 text-xs mt-1">Training data: {trainStart} → {trainEnd}. Weights are calculated from historical statistics — not a guarantee of future performance.</p>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">中文</div>
              <p className="text-gray-300 mb-2">這個面板回答：<em>「如果我同時持有 BTC、ETH 和 SOL，歷史上什麼配比的風險調整後回報最好？」</em></p>
              <p className="text-gray-400 text-xs"><strong>最大 Sharpe</strong> — 找出讓 Sharpe Ratio（回報÷風險）最大的配比。適合追求增長的投資者。</p>
              <p className="text-gray-400 text-xs mt-1"><strong>最小波動</strong> — 找出歷史波動率最低的最安全配比。適合風險厭惡的投資者。</p>
              <p className="text-gray-400 text-xs mt-1"><strong>Sharpe Ratio</strong> — 每承擔一單位風險能獲得多少回報，越高越好。</p>
              <p className="text-gray-400 text-xs mt-1">訓練數據：{trainStart} → {trainEnd}。基於歷史統計，不保證未來表現。</p>
            </div>
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        {(["maxsharpe", "minvol"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              mode === m ? "bg-purple-600 text-white" : "bg-white/[0.06] text-gray-400 hover:bg-white/[0.10]"
            }`}>
            {m === "maxsharpe" ? "📈 Max Sharpe" : "🛡 Min Volatility"}
          </button>
        ))}
      </div>

      {/* Condition banner */}
      <div className="mb-5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">
          {mode === "maxsharpe" ? "Maximum Sharpe Ratio allocation" : "Minimum Volatility allocation"}
        </span>
        <span className="text-gray-400"> — historically optimal weights for BTC / ETH / SOL</span>
        <span className="block mt-1 text-gray-500 text-sm">
          顯示：{mode === "maxsharpe" ? "最大化 Sharpe Ratio 的配比" : "最小化波動率的配比"} — 歷史最優 BTC / ETH / SOL 配比
        </span>
      </div>

      {/* Main content: Pie + Metrics */}
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {/* Pie chart */}
        <div className="flex flex-col items-center gap-3">
          <PieChart weights={activeWeights} />
          <div className="flex flex-col gap-1">
            {Object.entries(activeWeights).map(([ticker, w]) => (
              <div key={ticker} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS[ticker] ?? "#888" }} />
                <span className="text-gray-300 font-medium w-8">{ticker}</span>
                <span className="text-white font-bold">{Math.round(w * 100)}%</span>
                {w === 0 && <span className="text-gray-600 text-xs">(excluded)</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-1 grid grid-cols-1 gap-3">
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-4">
            <div className="text-xs text-gray-500 uppercase font-bold mb-3">Portfolio Metrics / 組合指標</div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Sharpe Ratio", sub: "風險調整回報", value: typeof activeSharpe === "number" ? activeSharpe.toFixed(2) : "—", color: "text-green-400" },
                { label: "Ann. Return", sub: "年化回報", value: typeof activeReturn === "number" ? `${(activeReturn * 100).toFixed(1)}%` : "—", color: "text-blue-400" },
                { label: "Ann. Volatility", sub: "年化波動率", value: typeof activeVol === "number" ? `${(activeVol * 100).toFixed(1)}%` : "—", color: "text-orange-400" },
              ].map(({ label, sub, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                  <div className="text-[10px] text-gray-600">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Takeaway */}
          <div className={`rounded-lg border p-3 text-sm ${
            mode === "maxsharpe"
              ? "border-purple-500/30 bg-purple-500/5"
              : "border-blue-500/30 bg-blue-500/5"
          }`}>
            {mode === "maxsharpe" ? (
              <>
                <span className="font-bold text-purple-300">📊 Max Sharpe: </span>
                <span className="text-gray-300">
                  Allocate <strong>{Math.round((mvoWeights["BTC"] ?? 0) * 100)}% BTC</strong> + <strong>{Math.round((mvoWeights["SOL"] ?? 0) * 100)}% SOL</strong>
                  {(mvoWeights["ETH"] ?? 0) === 0 && " (ETH excluded — lower Sharpe & high BTC correlation)"}
                  . Sharpe {typeof activeSharpe === "number" ? activeSharpe.toFixed(2) : "—"} vs equal-weight.
                </span>
                <span className="block mt-1 text-gray-500 text-xs">
                  最優配比：{Math.round((mvoWeights["BTC"] ?? 0) * 100)}% BTC + {Math.round((mvoWeights["SOL"] ?? 0) * 100)}% SOL
                  {(mvoWeights["ETH"] ?? 0) === 0 && "（ETH 被排除——Sharpe 較低且與 BTC 高度相關）"}
                </span>
              </>
            ) : (
              <>
                <span className="font-bold text-blue-300">🛡 Min Volatility: </span>
                <span className="text-gray-300">
                  Allocate <strong>{Math.round((minvolWeights["BTC"] ?? 0) * 100)}% BTC</strong> for the lowest historical volatility ({typeof activeVol === "number" ? `${(activeVol * 100).toFixed(1)}%` : "—"} ann.).
                  Best for risk-averse holders.
                </span>
                <span className="block mt-1 text-gray-500 text-xs">
                  最低風險配比：{Math.round((minvolWeights["BTC"] ?? 0) * 100)}% BTC — 歷史波動率最低，適合保守型投資者
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Historical performance chart */}
      {history.length > 0 && (
        <div className="mt-2">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            Historical Performance Comparison / 歷史表現對比
            <span className="ml-2 text-gray-600 normal-case font-normal">(base = 100)</span>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = PAD.top + chartH * (1 - t);
                const val = histMin + yRange * t;
                return (
                  <g key={t}>
                    <line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                      stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    <text x={PAD.left - 4} y={y} textAnchor="end" dominantBaseline="middle"
                      fontSize="9" fill="#6b7280">{Math.round(val)}</text>
                  </g>
                );
              })}
              {/* Baseline 100 */}
              <line x1={PAD.left} y1={toY(100)} x2={PAD.left + chartW} y2={toY(100)}
                stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />
              {/* Equal weight line */}
              <path d={eqPath} fill="none" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5 3" />
              {/* MVO line */}
              <path d={mvoPath} fill="none" stroke={mode === "maxsharpe" ? "#a855f7" : "#3b82f6"} strokeWidth="2" />
              {/* X-axis ticks */}
              {tickIndices.map((idx) => (
                <text key={idx} x={toX(idx)} y={H - 6} textAnchor="middle"
                  fontSize="9" fill="#6b7280">
                  {history[idx]?.date?.slice(0, 7) ?? ""}
                </text>
              ))}
            </svg>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 border-t border-dashed border-gray-500" />
              Equal Weight (33/33/33%)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-6 border-t-2 border-purple-500" />
              {mode === "maxsharpe" ? "Max Sharpe" : "Min Volatility"} Weights
            </span>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-600 mt-4">
        ⚠️ Historical optimisation only. Past performance does not guarantee future results. Not financial advice. /
        僅供研究參考，歷史最優配比不保證未來表現，不構成投資建議。
      </p>
    </div>
  );
}
