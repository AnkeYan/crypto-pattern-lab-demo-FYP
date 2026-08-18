"use client";

import { useEffect, useState, useCallback } from "react";

type DomRow = {
  date: string;
  btc_dominance: number;
};

function domSvg(data: DomRow[], width = 560, height = 100): string {
  if (data.length < 2) return "";
  const vals = data.map((d) => d.btc_dominance);
  const minV = Math.max(0, Math.min(...vals) - 2);
  const maxV = Math.min(100, Math.max(...vals) + 2);
  const range = maxV - minV || 1;
  const padL = 8, padR = 8, padT = 8, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const toY = (v: number) => padT + h - ((v - minV) / range) * h;
  const toX = (i: number) => padL + (i / (data.length - 1)) * w;

  const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.btc_dominance).toFixed(1)}`).join(" ");

  // Area
  const areaPoints = `${padL},${padT + h} ${pts} ${padL + w},${padT + h}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<polygon points="${areaPoints}" fill="#f59e0b" opacity="0.15"/>
<polyline points="${pts}" fill="none" stroke="#f59e0b" stroke-width="2"/>
</svg>`;
}

function changeBar7d(data: DomRow[]): string {
  if (data.length < 8) return "";
  const current = data[data.length - 1].btc_dominance;
  const prev7 = data[data.length - 8]?.btc_dominance ?? current;
  const change = current - prev7;
  const absChange = Math.abs(change);
  const barWidth = Math.min(absChange * 15, 80);
  const color = change > 0 ? "#4ade80" : "#f87171";
  const sign = change > 0 ? "+" : "";
  return `<svg width="120" height="20" viewBox="0 0 120 20">
<rect x="0" y="6" width="${barWidth.toFixed(1)}" height="8" fill="${color}" rx="2" opacity="0.8"/>
<text x="${barWidth + 4}" y="14" font-size="10" fill="${color}">${sign}${change.toFixed(2)}%</text>
</svg>`;
}

export default function BtcDominancePanel() {
  const [data, setData] = useState<DomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetch("/api/btc-dominance-history").then((r) => r.json());
      setData(rows.sort((a: DomRow, b: DomRow) => a.date.localeCompare(b.date)));
    } catch {
      setError("Failed to load BTC dominance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latest = data[data.length - 1];
  const prev7 = data[data.length - 8];
  const change7d = latest && prev7 ? latest.btc_dominance - prev7.btc_dominance : null;

  const domLabel =
    !latest ? null
    : latest.btc_dominance > 60 ? { text: "BTC dominance high · 市場避險", color: "text-green-400" }
    : latest.btc_dominance < 45 ? { text: "Altcoin season · 山寨幣季節", color: "text-purple-400" }
    : { text: "Balanced · 均衡市場", color: "text-slate-300" };

  // Dynamic insight
  const insight = (() => {
    if (!latest || change7d === null) return null;
    const dom = latest.btc_dominance;

    if (dom > 60 && change7d > 0.5) return {
      border: "border-yellow-500/30", bg: "bg-yellow-500/5", icon: "⚠", titleColor: "text-yellow-400",
      title: "BTC dominance high and rising — risk-off · BTC 佔有率高且上升，市場避險",
      en: `BTC dominance is ${dom.toFixed(2)}%, up ${change7d > 0 ? "+" : ""}${change7d.toFixed(2)}pp in 7 days. Capital is rotating into BTC — a risk-off signal. Altcoins (ETH/SOL) typically underperform when BTC dominance is expanding.`,
      zh: `BTC 佔有率 ${dom.toFixed(2)}%，7 日上升 ${change7d > 0 ? "+" : ""}${change7d.toFixed(2)}pp。資金正流向比特幣，屬於避險模式。BTC 佔有率擴張時，山寨幣（ETH/SOL）通常表現落後。`,
    };
    if (dom < 45 && change7d < -0.5) return {
      border: "border-purple-500/30", bg: "bg-purple-500/5", icon: "✓", titleColor: "text-purple-400",
      title: "BTC dominance low and falling — altcoin season signal · 山寨季節信號",
      en: `BTC dominance is ${dom.toFixed(2)}%, down ${change7d.toFixed(2)}pp in 7 days. Capital is rotating into altcoins — conditions favour ETH/SOL outperformance. Historically this pattern precedes altcoin season.`,
      zh: `BTC 佔有率 ${dom.toFixed(2)}%，7 日下降 ${change7d.toFixed(2)}pp。資金輪動至山寨幣，有利於 ETH/SOL 跑贏。歷史上這種模式往往出現在山寨季節之前。`,
    };
    if (change7d > 1) return {
      border: "border-yellow-500/20", bg: "bg-yellow-500/[0.03]", icon: "~", titleColor: "text-yellow-300",
      title: "BTC dominance rising — watch altcoin pressure · 佔有率上升，留意山寨幣壓力",
      en: `BTC dominance is ${dom.toFixed(2)}%, up ${change7d.toFixed(2)}pp this week. A notable rotation into BTC is underway — altcoins may face headwinds until this trend stabilises.`,
      zh: `BTC 佔有率 ${dom.toFixed(2)}%，本週上升 ${change7d.toFixed(2)}pp。市場正在向比特幣輪動，在趨勢穩定前山寨幣可能面臨壓力。`,
    };
    return {
      border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
      title: "BTC dominance stable · 佔有率穩定",
      en: `BTC dominance is ${dom.toFixed(2)}%, 7d change: ${change7d > 0 ? "+" : ""}${change7d.toFixed(2)}pp. No significant rotation signal at this time.`,
      zh: `BTC 佔有率 ${dom.toFixed(2)}%，7 日變化 ${change7d > 0 ? "+" : ""}${change7d.toFixed(2)}pp。目前無明顯輪動信號。`,
    };
  })();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">F15 · BTC Dominance</h2>
          <p className="text-gray-500 text-sm mt-0.5">BTC market cap share · BTC 市場佔有率</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="px-2 py-0.5 text-xs rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 font-medium">Dashboard Only</span>
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
              <p className="text-gray-300 mb-2"><em>The core question: is capital flowing into BTC (risk-off) or rotating into altcoins (risk-on)?</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">BTC Dominance</strong> = BTC market cap ÷ total crypto market cap. When dominance rises, BTC is gaining share — capital is moving defensively. When it falls, altcoins are outperforming — altcoin season conditions.</p>
              <ul className="space-y-1 text-xs text-gray-400 mt-2">
                <li>• <strong className="text-gray-300">&gt; 60%</strong> — High dominance: risk-off, BTC-driven market. ETH/SOL under pressure.</li>
                <li>• <strong className="text-gray-300">45–60%</strong> — Balanced market.</li>
                <li>• <strong className="text-gray-300">&lt; 45%</strong> — Low dominance: altcoin season conditions.</li>
                <li>• <strong className="text-gray-300">F15 is Dashboard only</strong> — only 30 days of data. Will enter XGBoost once 1+ year accumulates.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2"><em>核心問題：資金正在流向比特幣（避險），還是輪動到山寨幣（進攻）？</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">BTC 佔有率</strong> = BTC 市值 ÷ 加密貨幣總市值。佔有率上升 = BTC 在搶走山寨幣的份額，市場偏防守；下降 = 山寨幣跑贏，山寨季節條件成立。</p>
              <ul className="space-y-1 text-xs text-gray-400 mt-2">
                <li>• <strong className="text-gray-300">&gt; 60%</strong> — 高佔有率：避險模式，BTC 主導，ETH/SOL 承壓。</li>
                <li>• <strong className="text-gray-300">45–60%</strong> — 均衡市場。</li>
                <li>• <strong className="text-gray-300">&lt; 45%</strong> — 低佔有率：山寨季節條件成立。</li>
                <li>• <strong className="text-gray-300">F15 只作 Dashboard</strong>——目前只有 30 天數據，數據累積超過 1 年後才加入 XGBoost。</li>
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
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">BTC Dominance · 佔有率</p>
              <p className={`text-2xl font-mono font-bold ${domLabel?.color}`}>
                {latest.btc_dominance.toFixed(2)}%
              </p>
              <p className={`text-xs mt-0.5 ${domLabel?.color}`}>{domLabel?.text}</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">7d Change · 7日變化</p>
              {change7d !== null ? (
                <>
                  <p className={`text-2xl font-mono font-bold ${change7d > 0 ? "text-green-400" : change7d < 0 ? "text-red-400" : "text-slate-300"}`}>
                    {change7d > 0 ? "+" : ""}{change7d.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {change7d > 0.5 ? "↑ Risk-off · 避險" : change7d < -0.5 ? "↓ Risk-on · 偏好風險" : "→ Stable · 穩定"}
                  </p>
                </>
              ) : (
                <p className="text-slate-400 text-sm">—</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">Data Range · 數據範圍</p>
              <p className="text-sm font-mono text-slate-300">30d</p>
              <p className="text-xs text-slate-500 mt-0.5">F15 not in XGBoost</p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg bg-slate-700/30 p-3 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-2">BTC Dominance History (30d) · 30日走勢</p>
            <div dangerouslySetInnerHTML={{ __html: domSvg(data, 560, 100) }} />
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
