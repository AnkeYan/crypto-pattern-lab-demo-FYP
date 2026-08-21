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

  // Derive interpretation
  const rlM  = metrics["RL Agent"];
  const mvoM = metrics["MVO (Max Sharpe)"];
  const btcM = metrics["Buy & Hold BTC"];
  const ewM  = metrics["Equal Weight"];

  function interpretColor(sharpe: number) {
    if (sharpe >= 1.0) return "text-green-400";
    if (sharpe >= 0.5) return "text-yellow-400";
    return "text-red-400";
  }

  // Dynamic key takeaway — derived entirely from real backtest numbers
  const takeaway = (() => {
    if (!rlM || !mvoM || !btcM) return null;

    const beatsMvo = rlM.sharpe >= mvoM.sharpe;
    const beatsBtc = rlM.sharpe >= btcM.sharpe;
    const allBeat  = beatsMvo && beatsBtc;
    const bestBaseline = [
      { label: "MVO", sharpe: mvoM.sharpe },
      { label: "Buy & Hold BTC", sharpe: btcM.sharpe },
      ...(ewM ? [{ label: "Equal Weight", sharpe: ewM.sharpe }] : []),
    ].sort((a, b) => b.sharpe - a.sharpe)[0];

    const gap = Math.abs(rlM.sharpe - bestBaseline.sharpe).toFixed(3);

    if (allBeat) {
      return {
        border: "border-green-500/30", bg: "bg-green-500/5",
        icon: "✓", titleColor: "text-green-400",
        title: `RL Agent outperformed all baselines · 因子驅動 AI 跑贏所有基準策略`,
        en: `The RL agent achieved Sharpe ${rlM.sharpe.toFixed(3)} vs the best baseline (${bestBaseline.label}) at ${bestBaseline.sharpe.toFixed(3)} — a +${gap} Sharpe advantage. This suggests the ${factorsUsed}-dimensional factor state (MVRV, Turbulence, Funding Rate, etc.) provided meaningful signal for dynamic allocation across BTC, ETH, and SOL.`,
        zh: `RL Agent 取得 Sharpe ${rlM.sharpe.toFixed(3)}，優於最佳基準（${bestBaseline.label}）的 ${bestBaseline.sharpe.toFixed(3)}，Sharpe 領先 +${gap}。${factorsUsed} 維因子狀態（MVRV、Turbulence、Funding Rate 等）為動態配置提供了有效信號。`,
      };
    }
    if (beatsMvo && !beatsBtc) {
      return {
        border: "border-yellow-500/30", bg: "bg-yellow-500/5",
        icon: "~", titleColor: "text-yellow-400",
        title: `RL Agent beat MVO but not Buy & Hold BTC · 跑贏 MVO，但未跑贏 BTC 買入持有`,
        en: `The RL agent (Sharpe ${rlM.sharpe.toFixed(3)}) outperformed the static MVO portfolio (${mvoM.sharpe.toFixed(3)}) but trailed Buy & Hold BTC (${btcM.sharpe.toFixed(3)}). In the strong bull period tested, simply holding BTC proved hard to beat on a Sharpe basis.`,
        zh: `RL Agent（Sharpe ${rlM.sharpe.toFixed(3)}）跑贏了靜態 MVO 組合（${mvoM.sharpe.toFixed(3)}），但落後於 BTC 買入持有（${btcM.sharpe.toFixed(3)}）。在測試的強牛市階段，單純持有 BTC 的 Sharpe 表現難以超越。`,
      };
    }
    if (rlM.max_dd > -50 && mvoM.max_dd < -50) {
      return {
        border: "border-yellow-500/30", bg: "bg-yellow-500/5",
        icon: "~", titleColor: "text-yellow-400",
        title: `RL Agent showed better drawdown control · RL Agent 回撤控制較好`,
        en: `While the RL agent lagged on total return, its maximum drawdown (${rlM.max_dd.toFixed(1)}%) was better-controlled than some baselines. This suggests the factor state provides risk-awareness, even if the absolute return is limited by training epochs.`,
        zh: `雖然 RL Agent 總回報落後，但最大回撤（${rlM.max_dd.toFixed(1)}%）比部分基準更受控。這說明因子狀態提供了一定的風險感知能力，即使回報受訓練步數限制。`,
      };
    }
    // default: underperformed
    return {
      border: "border-orange-500/20", bg: "bg-orange-500/[0.03]",
      icon: "✗", titleColor: "text-orange-400",
      title: `RL Agent underperformed static strategies · RL Agent 跑輸靜態策略`,
      en: `RL Agent Sharpe ${rlM.sharpe.toFixed(3)} vs best baseline (${bestBaseline.label}) ${bestBaseline.sharpe.toFixed(3)} — a −${gap} gap. The linear REINFORCE policy (120 epochs, ${trainYears}-year rolling window) captures directional factor signals but lacks the non-linear capacity to out-time a static MVO portfolio. Switching to a deeper policy network or adding a recurrent state would likely close this gap.`,
      zh: `RL Agent Sharpe ${rlM.sharpe.toFixed(3)}，落後於最佳基準（${bestBaseline.label}）${bestBaseline.sharpe.toFixed(3)}，差距 −${gap}。線性 REINFORCE 策略（120 輪，${trainYears} 年滾動訓練窗口）能捕捉因子的方向性信號，但缺乏非線性容量以超越靜態 MVO 組合。引入更深的策略網絡或遞歸狀態可望縮小此差距。`,
    };
  })();

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
        <div className="rounded-lg bg-slate-700/30 p-3 mb-4 overflow-x-auto">
          <p className="text-xs text-slate-400 mb-2">
            Portfolio Value History (base = $10,000) · 組合價值歷史走勢
          </p>
          <EquityCurveSvg equity={equity} visible={visible} />
        </div>
      ) : (
        <div className="rounded-lg bg-slate-700/30 p-6 text-center text-gray-500 text-xs mb-4">
          No equity data available
        </div>
      )}

      {/* metrics table */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 uppercase font-bold mb-2">
          Strategy Comparison / 策略對比
          <span className="ml-2 text-gray-600 normal-case font-normal">· out-of-sample {testStart && `${testStart} → ${testEnd}`}</span>
        </div>
        <div className="overflow-x-auto">
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
      </div>

      {/* RL agent weight chart */}
      {weights.length > 1 && visible.rl && (
        <div className="mb-5">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            RL Agent Monthly Allocation / 月度倉位配比
          </div>
          <div className="rounded-lg bg-slate-700/30 p-3">
            <div className="flex gap-3 text-xs text-gray-400 mb-1.5">
              <span style={{ color: COLORS.btc }}>■ BTC</span>
              <span style={{ color: "#627eea" }}>■ ETH</span>
              <span style={{ color: "#9945ff" }}>■ SOL</span>
            </div>
            <WeightChartSvg weights={weights} />
          </div>
        </div>
      )}

      {/* Dynamic key takeaway — matches PortfolioOptimizationPanel style */}
      {takeaway && (
        <div className={`rounded-lg border ${takeaway.border} ${takeaway.bg} px-4 py-3 text-sm`}>
          <div className={`font-medium mb-2 ${takeaway.titleColor}`}>
            {takeaway.icon} {takeaway.title}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <p className="text-gray-300 text-sm">{takeaway.en}</p>
            <p className="text-gray-500 text-sm">{takeaway.zh}</p>
          </div>
          <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-white/[0.05]">
            Train window: {trainYears}y rolling · State: {factorsUsed}-dim ({Math.round(factorsUsed / 3)} factors × 3 coins) · TC: 10 bps/side
          </p>
        </div>
      )}
    </div>
  );
}
