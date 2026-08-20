"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type RlRow = {
  row_type: string;
  label: string;
  value: number | null;
  extra1: number | null;
  extra2: number | null;
  extra3: number | null;
};

type Props = { data: RlRow[] };

// ── Colours ────────────────────────────────────────────────────────────────
const COLORS = {
  rl:   "#a78bfa", // violet  — RL Agent
  ew:   "#34d399", // green   — Equal Weight
  btc:  "#f7931a", // orange  — Buy & Hold BTC
  mvo:  "#60a5fa", // blue    — MVO
};

const STRATEGIES = [
  { key: "rl",  label: "RL Agent",        color: COLORS.rl,  dash: ""      },
  { key: "ew",  label: "Equal Weight",    color: COLORS.ew,  dash: "6 3"   },
  { key: "btc", label: "Buy & Hold BTC",  color: COLORS.btc, dash: "3 3"   },
  { key: "mvo", label: "MVO Max Sharpe",  color: COLORS.mvo, dash: "8 4"   },
];

// ── Equity Curve SVG ───────────────────────────────────────────────────────
function EquityCurveSvg({
  equity,
  visible,
}: {
  equity: Array<{ date: string; rl: number; ew: number; btc: number; mvo: number }>;
  visible: Record<string, boolean>;
}) {
  if (equity.length < 2) return null;

  const W = 640, H = 220;
  const padL = 52, padR = 12, padT = 14, padB = 28;
  const w = W - padL - padR;
  const h = H - padT - padB;

  const allVals = equity.flatMap((d) =>
    [d.rl, d.ew, d.btc, d.mvo].filter((v) => isFinite(v))
  );
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const toX = (i: number) => padL + (i / (equity.length - 1)) * w;
  const toY = (v: number) => padT + h - ((v - minV) / range) * h;

  function makePath(key: "rl" | "ew" | "btc" | "mvo") {
    return equity
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d[key]).toFixed(1)}`)
      .join(" ");
  }

  // Y-axis ticks
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = minV + (range * i) / (yTicks - 1);
    return { y: toY(v), label: `$${Math.round(v / 1000) * 1000 === v ? v.toLocaleString() : Math.round(v).toLocaleString()}` };
  });

  // X-axis ticks (yearly)
  const xTicks: { x: number; label: string }[] = [];
  let prevYear = "";
  equity.forEach((d, i) => {
    const yr = d.date.slice(0, 4);
    if (yr !== prevYear) { xTicks.push({ x: toX(i), label: yr }); prevYear = yr; }
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
      {/* grid */}
      {yLabels.map(({ y, label }, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={padL + w} y2={y} stroke="#1e293b" strokeWidth="1" />
          <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#475569">{label}</text>
        </g>
      ))}
      {xTicks.map(({ x, label }, i) => (
        <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="#475569">{label}</text>
      ))}

      {/* strategy lines */}
      {STRATEGIES.map(({ key, color, dash }) =>
        visible[key] ? (
          <path
            key={key}
            d={makePath(key as "rl" | "ew" | "btc" | "mvo")}
            fill="none"
            stroke={color}
            strokeWidth={key === "rl" ? 2 : 1.5}
            strokeDasharray={dash}
            strokeLinejoin="round"
            opacity={key === "rl" ? 1 : 0.75}
          />
        ) : null
      )}

      {/* fold boundary line — first data point is fold 2 start if multi-fold */}
    </svg>
  );
}

// ── Weight Area Chart SVG ──────────────────────────────────────────────────
function WeightChartSvg({
  weights,
}: {
  weights: Array<{ date: string; btc: number; eth: number; sol: number }>;
}) {
  if (weights.length < 2) return null;

  const W = 640, H = 100;
  const padL = 8, padR = 8, padT = 8, padB = 8;
  const w = W - padL - padR;
  const h = H - padT - padB;

  const toX = (i: number) => padL + (i / (weights.length - 1)) * w;

  // Stacked areas: btc bottom, eth middle, sol top
  const btcArea =
    `${padL},${padT + h} ` +
    weights.map((d, i) => `${toX(i).toFixed(1)},${(padT + h - d.btc * h).toFixed(1)}`).join(" ") +
    ` ${padL + w},${padT + h}`;

  const ethAreaTop = weights.map((d, i) =>
    `${toX(i).toFixed(1)},${(padT + h - (d.btc + d.eth) * h).toFixed(1)}`
  );
  const ethAreaBot = weights.map((d, i) =>
    `${toX(i).toFixed(1)},${(padT + h - d.btc * h).toFixed(1)}`
  ).reverse();
  const ethArea = ethAreaTop.join(" ") + " " + ethAreaBot.join(" ");

  const solAreaTop = weights.map((d, i) =>
    `${toX(i).toFixed(1)},${(padT).toFixed(1)}`
  );
  const solAreaBot = weights.map((d, i) =>
    `${toX(i).toFixed(1)},${(padT + h - (d.btc + d.eth) * h).toFixed(1)}`
  ).reverse();
  const solArea = solAreaTop.join(" ") + " " + solAreaBot.join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 100 }}>
      <polygon points={btcArea} fill={COLORS.btc} opacity={0.7} />
      <polygon points={ethArea} fill="#627eea"    opacity={0.7} />
      <polygon points={solArea} fill="#9945ff"    opacity={0.7} />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function RlBacktestPanel({ data }: Props) {
  const [open,    setOpen]    = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({
    rl: true, ew: true, btc: true, mvo: true,
  });

  // Parse data
  const equity: Array<{ date: string; rl: number; ew: number; btc: number; mvo: number }> = [];
  const weights: Array<{ date: string; btc: number; eth: number; sol: number }> = [];
  const metrics: Record<string, { total_ret: number; ann_ret: number; sharpe: number; max_dd: number }> = {};
  let testStart = "", testEnd = "", factorsUsed = 0, trainYears = 3;

  for (const r of data) {
    if (r.row_type === "equity") {
      const rl  = r.value  ?? 0;
      const ew  = r.extra1 ?? 0;
      const btc = r.extra2 ?? 0;
      const mvo = r.extra3 ?? 0;
      if (isFinite(rl) && isFinite(ew) && isFinite(btc) && isFinite(mvo)) {
        equity.push({ date: r.label, rl, ew, btc, mvo });
      }
    } else if (r.row_type === "weights") {
      weights.push({
        date: r.label,
        btc:  r.value  ?? 0,
        eth:  r.extra1 ?? 0,
        sol:  r.extra2 ?? 0,
      });
    } else if (r.row_type === "metrics") {
      metrics[r.label] = {
        total_ret: r.value  ?? 0,
        ann_ret:   r.extra1 ?? 0,
        sharpe:    r.extra2 ?? 0,
        max_dd:    r.extra3 ?? 0,
      };
    } else if (r.row_type === "meta") {
      if (r.label === "test_start") {
        testStart = r.extra1?.toString() ?? "";
        testEnd   = r.extra2?.toString() ?? "";
      }
      if (r.label === "train_years")   trainYears   = r.value ?? 3;
      if (r.label === "factors_used")  factorsUsed  = r.value ?? 0;
    }
  }

  const toggle = (key: string) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  // Derive interpretation text
  const rlM  = metrics["RL Agent"];
  const mvoM = metrics["MVO (Max Sharpe)"];
  const btcM = metrics["Buy & Hold BTC"];

  function interpretColor(sharpe: number) {
    if (sharpe >= 1.0) return "text-green-400";
    if (sharpe >= 0.5) return "text-yellow-400";
    return "text-red-400";
  }

  function rlVerdict(): string {
    if (!rlM || !mvoM) return "";
    if (rlM.sharpe >= mvoM.sharpe) return "RL Agent outperformed MVO on a risk-adjusted basis — the 15 factors provided useful signal.";
    if (rlM.max_dd < mvoM.max_dd)  return "RL Agent had a smaller maximum drawdown than MVO — the factor-driven risk management worked.";
    return `RL Agent underperformed MVO (Sharpe ${rlM.sharpe.toFixed(2)} vs ${mvoM.sharpe.toFixed(2)}) — consistent with findings in 7.html: short training periods and market regime shifts limit RL performance.`;
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
      {/* header */}
      <div className="mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">RL Strategy Backtester</h2>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          Factor-driven RL agent (REINFORCE) vs. static strategies — walk-forward out-of-sample
          {testStart && <span className="text-gray-600"> · {testStart} → {testEnd}</span>}
        </p>
      </div>

      {/* How to read — standard style */}
      <div className="mb-4 mt-3">
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>How to read this? / 如何解讀？</span>
        </button>
        {open && (
          <div className="mt-2 rounded-lg bg-white/[0.04] border border-white/[0.06] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">ENGLISH</div>
              <p className="text-gray-300 mb-2">This panel answers: <em>&ldquo;If I use the 15 research factors to drive an AI agent, can it beat static allocation strategies?&rdquo;</em></p>
              <p className="text-gray-400 text-xs mb-1">The RL agent observes a <strong>{factorsUsed}-dimensional state vector</strong> (MVRV, Turbulence, Funding Rate, RSI, etc. × 3 coins) each day and learns to allocate across BTC/ETH/SOL using REINFORCE policy gradient.</p>
              <p className="text-gray-400 text-xs mb-1"><strong>Walk-forward</strong>: {trainYears}-year rolling train window, 1-year test window — all results are out-of-sample.</p>
              <p className="text-gray-400 text-xs mb-1"><strong>Sharpe Ratio</strong>: return ÷ risk. &gt;1.0 = excellent · 0.5–1.0 = acceptable · &lt;0.5 = weak.</p>
              <p className="text-gray-400 text-xs"><strong>Max DD</strong>: largest peak-to-trough loss. Closer to 0% = better downside control.</p>
              <p className="text-gray-400 text-xs mt-1 italic">Includes 10 bps transaction cost per trade. Not investment advice.</p>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">中文</div>
              <p className="text-gray-300 mb-2">這個面板回答：<em>「用 15 個研究因子驅動 AI，能否跑贏靜態配置策略？」</em></p>
              <p className="text-gray-400 text-xs mb-1">RL Agent 每天觀察 <strong>{factorsUsed} 維狀態向量</strong>（MVRV、Turbulence、Funding Rate、RSI 等 × 3 幣種），用 REINFORCE 策略梯度學習 BTC/ETH/SOL 最優倉位配比。</p>
              <p className="text-gray-400 text-xs mb-1"><strong>Walk-forward 驗證</strong>：{trainYears} 年滾動訓練窗口，1 年測試窗口，所有結果均為 out-of-sample（訓練期之外）。</p>
              <p className="text-gray-400 text-xs mb-1"><strong>Sharpe Ratio</strong>：回報÷風險。&gt;1.0 = 優秀 · 0.5–1.0 = 可接受 · &lt;0.5 = 較弱。</p>
              <p className="text-gray-400 text-xs"><strong>最大回撤（Max DD）</strong>：從峰值到最低點的最大虧損，越接近 0% 越好。</p>
              <p className="text-gray-400 text-xs mt-1 italic">包含每筆 10bps 交易成本。不構成投資建議。</p>
            </div>
          </div>
        )}
      </div>

      {/* strategy toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STRATEGIES.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all"
            style={{
              borderColor: visible[key] ? color : "#374151",
              background:  visible[key] ? `${color}20` : "transparent",
              color:       visible[key] ? color : "#6b7280",
            }}
          >
            <span className="w-3 h-0.5 inline-block rounded" style={{ background: visible[key] ? color : "#6b7280" }} />
            {label}
          </button>
        ))}
      </div>

      {/* equity curve */}
      {equity.length > 0 ? (
        <div className="bg-gray-950 rounded-lg p-3 mb-4">
          <EquityCurveSvg equity={equity} visible={visible} />
        </div>
      ) : (
        <div className="bg-gray-950 rounded-lg p-6 text-center text-gray-500 text-xs mb-4">
          No equity data available
        </div>
      )}

      {/* metrics table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 font-medium py-2 pr-3">Strategy</th>
              <th className="text-right text-gray-400 font-medium py-2 px-2">Total Return</th>
              <th className="text-right text-gray-400 font-medium py-2 px-2">Ann. Return</th>
              <th className="text-right text-gray-400 font-medium py-2 px-2">Sharpe</th>
              <th className="text-right text-gray-400 font-medium py-2 pl-2">Max DD</th>
            </tr>
          </thead>
          <tbody>
            {STRATEGIES.map(({ key, label, color }) => {
              const labelMap: Record<string, string> = {
                rl:  "RL Agent",
                ew:  "Equal Weight",
                btc: "Buy & Hold BTC",
                mvo: "MVO (Max Sharpe)",
              };
              const m = metrics[labelMap[key]];
              if (!m) return null;
              return (
                <tr key={key} className="border-b border-gray-800/50">
                  <td className="py-2 pr-3 font-semibold" style={{ color }}>
                    {label}
                  </td>
                  <td className={`text-right py-2 px-2 font-mono ${m.total_ret >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {m.total_ret >= 0 ? "+" : ""}{m.total_ret.toFixed(1)}%
                  </td>
                  <td className={`text-right py-2 px-2 font-mono ${m.ann_ret >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {m.ann_ret >= 0 ? "+" : ""}{m.ann_ret.toFixed(1)}%
                  </td>
                  <td className={`text-right py-2 px-2 font-mono font-semibold ${interpretColor(m.sharpe)}`}>
                    {m.sharpe.toFixed(3)}
                  </td>
                  <td className="text-right py-2 pl-2 font-mono text-red-400">
                    {m.max_dd.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RL agent weight chart */}
      {weights.length > 1 && visible.rl && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1.5">
            RL Agent monthly allocation &mdash; <span style={{ color: COLORS.btc }}>BTC</span> / <span style={{ color: "#627eea" }}>ETH</span> / <span style={{ color: "#9945ff" }}>SOL</span>
          </p>
          <div className="bg-gray-950 rounded-lg p-2">
            <WeightChartSvg weights={weights} />
          </div>
        </div>
      )}

      {/* dynamic verdict box */}
      {rlM && (
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3.5">
          <p className="text-xs font-semibold text-violet-300 mb-1">📊 結果解讀 / Interpretation</p>
          <p className="text-xs text-gray-300 leading-relaxed">{rlVerdict()}</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            RL Sharpe <span className={`font-mono font-bold ${interpretColor(rlM.sharpe)}`}>{rlM.sharpe.toFixed(3)}</span>
            {" "}· MDD <span className="font-mono text-red-400">{rlM.max_dd.toFixed(1)}%</span>
            {mvoM && <> · vs MVO Sharpe <span className="font-mono text-blue-400">{mvoM.sharpe.toFixed(3)}</span></>}
            {btcM && <> · BTC B&H Sharpe <span className="font-mono text-orange-400">{btcM.sharpe.toFixed(3)}</span></>}
          </p>
          <p className="text-xs text-gray-500 mt-1.5">
            訓練窗口 {trainYears} 年（滾動）· 狀態向量 {factorsUsed} 維（{Math.round(factorsUsed / 3)} 因子 × 3 幣種）· 交易成本 10 bps/side
          </p>
        </div>
      )}
    </div>
  );
}
