"use client";

import { useEffect, useState, useCallback } from "react";

type TurbRow = {
  date: string;
  turbulence_raw: number;
  turbulence_norm: number;
  turbulence_level: string;
};

// Major market crash events for annotation
const CRASH_EVENTS: { date: string; label: string }[] = [
  { date: "2021-05-19", label: "May 2021 Crash" },
  { date: "2022-05-12", label: "LUNA Collapse" },
  { date: "2022-11-09", label: "FTX Collapse" },
  { date: "2023-03-10", label: "SVB Crisis" },
  { date: "2024-08-05", label: "Aug 2024 Flash Crash" },
];

function levelColor(level: string): { dot: string; text: string; badge: string } {
  switch (level) {
    case "extreme":
      return { dot: "#ef4444", text: "text-red-400", badge: "bg-red-500/20 text-red-300 border-red-500/30" };
    case "high":
      return { dot: "#f97316", text: "text-orange-400", badge: "bg-orange-500/20 text-orange-300 border-orange-500/30" };
    case "moderate":
      return { dot: "#eab308", text: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
    default:
      return { dot: "#4ade80", text: "text-green-400", badge: "bg-green-500/20 text-green-300 border-green-500/30" };
  }
}

function turbulenceSvg(
  data: TurbRow[],
  width = 560,
  height = 140
): string {
  if (data.length < 2) return "";
  const values = data.map((d) => d.turbulence_norm);
  const padL = 8, padR = 60, padT = 12, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const toY = (v: number) => padT + h - v * h;
  const toX = (i: number) => padL + (i / (data.length - 1)) * w;

  // Area fill
  const areaPoints =
    `${padL},${padT + h} ` +
    data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.turbulence_norm).toFixed(1)}`).join(" ") +
    ` ${padL + w},${padT + h}`;

  // Line
  const linePts = data
    .map((d, i) => `${toX(i).toFixed(1)},${toY(d.turbulence_norm).toFixed(1)}`)
    .join(" ");

  // Crash annotations
  const annotations = CRASH_EVENTS.flatMap(({ date, label }) => {
    const idx = data.findIndex((r) => r.date >= date);
    if (idx < 0) return [];
    const x = toX(idx);
    return [
      `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + h}" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.5"/>`,
      `<text x="${(x + 2).toFixed(1)}" y="${padT + 10}" font-size="7.5" fill="#f87171" opacity="0.7">${label}</text>`,
    ];
  });

  // Threshold lines
  const thresholds = [
    { v: 0.7, label: "High", color: "#f97316" },
    { v: 0.9, label: "Extreme", color: "#ef4444" },
  ].map(({ v, label: lbl, color }) => {
    const ty = toY(v);
    return `<line x1="${padL}" y1="${ty.toFixed(1)}" x2="${padL + w}" y2="${ty.toFixed(1)}" stroke="${color}" stroke-width="0.6" stroke-dasharray="4,3" opacity="0.5"/>
<text x="${padL + w + 2}" y="${(ty + 4).toFixed(1)}" font-size="8" fill="${color}" opacity="0.6">${lbl}</text>`;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<polygon points="${areaPoints}" fill="#ef4444" opacity="0.12"/>
<polyline points="${linePts}" fill="none" stroke="#f87171" stroke-width="1.5"/>
${thresholds.join("")}
${annotations.join("")}
</svg>`;
}

export default function TurbulencePanel() {
  const [data, setData] = useState<TurbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetch("/api/turbulence-history").then((r) => r.json());
      setData(rows.sort((a: TurbRow, b: TurbRow) => a.date.localeCompare(b.date)));
    } catch {
      setError("Failed to load turbulence data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latest = data[data.length - 1];
  const lc = latest ? levelColor(latest.turbulence_level) : null;

  // Dynamic insight
  const insight = (() => {
    if (!latest) return null;
    const norm = latest.turbulence_norm;
    const level = latest.turbulence_level;
    const f12calm = (1 - norm) * 100;

    if (level === "extreme") return {
      border: "border-red-500/30", bg: "bg-red-500/5", icon: "⚠", titleColor: "text-red-400",
      title: "Extreme turbulence — systemic stress detected · 極端市場動盪，系統性壓力",
      en: `Market turbulence is at extreme levels (norm = ${(norm*100).toFixed(0)}/100, F12 calm score = ${f12calm.toFixed(0)}/100). BTC, ETH, and SOL are making unusually correlated large joint moves — a pattern historically associated with systemic events (e.g. exchange collapses, macro shocks). Exercise caution with new positions.`,
      zh: `市場動盪達到極端水平（norm = ${(norm*100).toFixed(0)}/100，F12 平靜評分 = ${f12calm.toFixed(0)}/100）。BTC、ETH、SOL 三個幣種正在發生異常同步大幅移動——歷史上這種模式與系統性事件相關（如交易所崩塌、宏觀衝擊）。新倉位需謹慎。`,
    };
    if (level === "high") return {
      border: "border-orange-500/20", bg: "bg-orange-500/[0.03]", icon: "~", titleColor: "text-orange-400",
      title: "High turbulence — elevated joint volatility · 高度動盪，多幣種同步波動",
      en: `Market turbulence is elevated (norm = ${(norm*100).toFixed(0)}/100, F12 calm = ${f12calm.toFixed(0)}/100). Three-coin joint returns are abnormally correlated. Not yet extreme, but volatility clusters — the probability of large moves in the next few days is above average.`,
      zh: `市場動盪偏高（norm = ${(norm*100).toFixed(0)}/100，F12 平靜評分 = ${f12calm.toFixed(0)}/100）。三幣種聯動回報異常相關。尚未達極端，但波動率有聚集效應——未來幾天大幅移動的概率高於平均。`,
    };
    if (norm < 0.3) return {
      border: "border-green-500/30", bg: "bg-green-500/5", icon: "✓", titleColor: "text-green-400",
      title: "Market calm — low turbulence, good backdrop for signals · 市場平靜，有利信號背景",
      en: `Market turbulence is low (norm = ${(norm*100).toFixed(0)}/100, F12 calm = ${f12calm.toFixed(0)}/100). The three-coin joint movement is within normal historical range. Low turbulence periods are typically more favourable for technical signals like RSI and Bollinger to work as expected.`,
      zh: `市場動盪很低（norm = ${(norm*100).toFixed(0)}/100，F12 平靜評分 = ${f12calm.toFixed(0)}/100）。三幣種聯動在歷史正常範圍內。低動盪時期技術信號（RSI、布林帶）的有效性通常更高。`,
    };
    return {
      border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
      title: "Moderate turbulence · 中等動盪水平",
      en: `Market turbulence is at a moderate level (norm = ${(norm*100).toFixed(0)}/100, F12 calm = ${f12calm.toFixed(0)}/100). Three-coin joint volatility is above low but not alarming. No extreme stress signal.`,
      zh: `市場動盪處於中等水平（norm = ${(norm*100).toFixed(0)}/100，F12 平靜評分 = ${f12calm.toFixed(0)}/100）。三幣種聯動波動高於低位但不構成警報。無極端壓力信號。`,
    };
  })();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">F12 · Market Turbulence Index</h2>
          <p className="text-gray-500 text-sm mt-0.5">Mahalanobis distance across BTC/ETH/SOL · 三幣種馬氏距離</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {latest && <span className={`px-2 py-0.5 text-xs rounded border font-medium ${lc?.badge}`}>{latest.turbulence_level.charAt(0).toUpperCase() + latest.turbulence_level.slice(1)}</span>}
          <button onClick={() => setOpen(o => !o)} className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap">
            {open ? "▾" : "▸"} How to read this?
          </button>
        </div>
      </div>

      {/* Explainer */}
      {open && (
        <div className="mb-4 mt-3 rounded-lg border border-gray-800 bg-white/[0.03] p-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2"><em>The core question: are BTC, ETH, and SOL moving together in an unusual way?</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">Turbulence Index</strong> (Kritzman &amp; Li, 2010) measures the Mahalanobis distance of the joint daily returns of BTC, ETH, and SOL from their historical mean. It captures not just how much each coin moves, but whether the combination is statistically abnormal.</p>
              <p className="text-gray-400 mb-3">High turbulence = the three coins are making unusually large, correlated moves simultaneously — a hallmark of systemic stress events (Luna collapse, FTX, SVB).</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <strong className="text-gray-300">F12 = 1 − turbulence</strong> (inverted) — calm market gets high score.</li>
                <li>• Use alongside RSI: oversold RSI during low turbulence is a stronger setup than during high turbulence.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2"><em>核心問題：BTC、ETH、SOL 三個幣種有沒有同時發生異常的聯動移動？</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">Turbulence Index</strong>（Kritzman &amp; Li，2010）量的是 BTC/ETH/SOL 三幣種日回報組合偏離歷史均值的馬氏距離。它不只看單個幣種波動多大，而是看三個幣種「組合起來」是否統計上異常。</p>
              <p className="text-gray-400 mb-3">高動盪 = 三個幣種同時發生大幅異常聯動——這是系統性壓力事件的特徵（Luna 崩塌、FTX 暴雷、SVB 危機）。</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <strong className="text-gray-300">F12 = 1 − 動盪指數</strong>（取反）——市場越平靜，評分越高。</li>
                <li>• 配合 RSI 使用：低動盪時 RSI 超賣比高動盪時更可靠。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm py-4">{error}</p>
      ) : !latest ? (
        <p className="text-slate-400 text-sm py-4">No data available.</p>
      ) : (
        <div className="space-y-4">
          {/* Snapshot */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-lg border p-3 ${lc?.badge}`}>
              <p className="text-xs text-slate-400 mb-1">Current Level · 當前水平</p>
              <p className={`text-2xl font-mono font-bold ${lc?.text}`}>
                {(latest.turbulence_norm * 100).toFixed(0)}
              </p>
              <p className={`text-xs mt-0.5 ${lc?.text}`}>
                {latest.turbulence_level.charAt(0).toUpperCase() + latest.turbulence_level.slice(1)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">Raw Score · 原始分</p>
              <p className="text-2xl font-mono font-bold text-slate-100">
                {latest.turbulence_raw.toFixed(1)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Mahalanobis distance</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">F12 Score · 評分（取反）</p>
              <p className="text-2xl font-mono font-bold text-slate-100">
                {((1 - latest.turbulence_norm) * 100).toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">100=calm · 0=extreme stress</p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg bg-slate-700/30 p-3 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-2">
              Turbulence History (2021–) · 歷史走勢（重大事件標記）
            </p>
            <div dangerouslySetInnerHTML={{ __html: turbulenceSvg(data, 560, 140) }} />
          </div>

          {/* Dynamic insight */}
          {insight && (
            <div className={`rounded-lg border ${insight.border} ${insight.bg} px-4 py-3 text-sm`}>
              <div className={`font-medium mb-2 ${insight.titleColor}`}>{insight.icon} {insight.title}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <p className="text-gray-300 text-sm">{insight.en}</p>
                <p className="text-gray-500 text-sm">{insight.zh}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
