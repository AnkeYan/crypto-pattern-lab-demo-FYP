"use client";

import { useEffect, useState, useCallback } from "react";

type CalibRow = {
  symbol: string;
  date: string;
  f7_cont: number;
  f8_cont: number;
  f7_norm: number;
  f8_norm: number;
};

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const SYMBOL_COLOR: Record<string, { line: string; badge: string }> = {
  BTCUSDT: { line: "#f59e0b", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  ETHUSDT: { line: "#60a5fa", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  SOLUSDT: { line: "#a78bfa", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

function volMomLabel(f7: number, f8: number) {
  const highVol = f7 > 0.6;
  const bullMom = f8 > 0.6;
  const bearMom = f8 < 0.4;

  if (highVol && bullMom) return { text: "Strong bullish surge · 量升價漲", color: "text-green-400" };
  if (highVol && bearMom) return { text: "High-vol sell-off · 量升價跌（注意）", color: "text-red-400" };
  if (!highVol && bullMom) return { text: "Low-vol grind up · 低量慢漲", color: "text-green-300" };
  if (!highVol && bearMom) return { text: "Low-vol drift down · 低量慢跌", color: "text-red-300" };
  return { text: "Neutral · 中性", color: "text-slate-400" };
}

function dualLineSvg(
  data90: CalibRow[],
  f7Key: "f7_cont",
  f8Key: "f8_cont",
  width = 560,
  height = 80,
  color7 = "#f59e0b",
  color8 = "#60a5fa"
): string {
  if (data90.length < 2) return "";
  const padL = 8, padR = 8, padT = 8, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const toY = (v: number) => padT + h - v * h;
  const toX = (i: number) => padL + (i / (data90.length - 1)) * w;

  const pts7 = data90.map((d, i) => `${toX(i).toFixed(1)},${toY(d[f7Key]).toFixed(1)}`).join(" ");
  const pts8 = data90.map((d, i) => `${toX(i).toFixed(1)},${toY(d[f8Key]).toFixed(1)}`).join(" ");

  // Midline
  const midY = toY(0.5);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<line x1="${padL}" y1="${midY.toFixed(1)}" x2="${padL + w}" y2="${midY.toFixed(1)}" stroke="#475569" stroke-width="0.5" stroke-dasharray="3,3"/>
<polyline points="${pts7}" fill="none" stroke="${color7}" stroke-width="1.5" opacity="0.9"/>
<polyline points="${pts8}" fill="none" stroke="${color8}" stroke-width="1.5" opacity="0.9"/>
</svg>`;
}

// ── 動態解說 ──────────────────────────────────────────────────────────────────
function buildInsight(sym: string, f7: number, f8: number) {
  const symLabel = sym.replace("USDT", "");
  const highVol = f7 > 0.6;
  const lowVol  = f7 < 0.4;
  const bullMom = f8 > 0.6;
  const bearMom = f8 < 0.4;

  if (highVol && bullMom) return {
    border: "border-green-500/30", bg: "bg-green-500/5", icon: "✓", titleColor: "text-green-400",
    title: "Strong bullish surge · 量升價漲",
    en: `${symLabel} is showing high volume (F7=${(f7*100).toFixed(0)}) with positive price momentum (F8=${(f8*100).toFixed(0)}). Volume is confirming the price move — this is the strongest bullish setup in this framework. Historically, volume-confirmed rallies tend to have follow-through.`,
    zh: `${symLabel} 目前成交量放大（F7=${(f7*100).toFixed(0)}），同時價格動量向上（F8=${(f8*100).toFixed(0)}）。量配合價，是最理想的強勢信號。歷史上量價齊升的反彈往往有延續性。`,
  };
  if (highVol && bearMom) return {
    border: "border-red-500/30", bg: "bg-red-500/5", icon: "⚠", titleColor: "text-red-400",
    title: "High-vol sell-off · 量升價跌（留意）",
    en: `${symLabel} is showing high volume (F7=${(f7*100).toFixed(0)}) but negative price momentum (F8=${(f8*100).toFixed(0)}). Large volume on a down move signals active selling pressure — not a favourable entry environment.`,
    zh: `${symLabel} 成交量放大（F7=${(f7*100).toFixed(0)}），但價格動量向下（F8=${(f8*100).toFixed(0)}）。大量下跌代表有主動拋售，不是理想進場環境，要小心。`,
  };
  if (!highVol && !lowVol && bullMom) return {
    border: "border-green-500/20", bg: "bg-green-500/[0.03]", icon: "~", titleColor: "text-green-300",
    title: "Low-vol grind up · 低量慢漲",
    en: `${symLabel} has bullish momentum (F8=${(f8*100).toFixed(0)}) but volume is not elevated (F7=${(f7*100).toFixed(0)}). Price is rising without strong conviction — the move may lack staying power without volume confirmation.`,
    zh: `${symLabel} 動量偏正（F8=${(f8*100).toFixed(0)}），但成交量未有放大（F7=${(f7*100).toFixed(0)}）。低量慢漲缺乏市場信心支撐，持續性存疑，需等量能配合。`,
  };
  if (!highVol && !lowVol && bearMom) return {
    border: "border-red-500/20", bg: "bg-red-500/[0.03]", icon: "~", titleColor: "text-red-300",
    title: "Low-vol drift down · 低量慢跌",
    en: `${symLabel} has bearish momentum (F8=${(f8*100).toFixed(0)}) on low volume (F7=${(f7*100).toFixed(0)}). This is a slow drift lower — less alarming than a high-vol sell-off, but momentum is still unfavourable.`,
    zh: `${symLabel} 動量偏負（F8=${(f8*100).toFixed(0)}），成交量也未有放大（F7=${(f7*100).toFixed(0)}）。屬於低量慢跌，不如大量拋售那麼急，但動量仍然不利。`,
  };
  return {
    border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
    title: "Neutral · 中性",
    en: `${symLabel} shows neutral conditions — volume (F7=${(f7*100).toFixed(0)}) and momentum (F8=${(f8*100).toFixed(0)}) are both in the mid-range. No strong directional signal from this factor pair at the moment.`,
    zh: `${symLabel} 目前成交量（F7=${(f7*100).toFixed(0)}）和動量（F8=${(f8*100).toFixed(0)}）均處於中性區間，沒有明確的方向性信號。`,
  };
}

export default function VolumeMomentumPanel() {
  const [calib, setCalib] = useState<CalibRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await fetch("/api/multifactor-calibration").then((r) => r.json());
      const rows: CalibRow[] = (resp?.rows ?? []).map((r: Record<string, unknown>) => ({
        symbol: r.symbol,
        date: r.date,
        f7_cont: Number(r.f7_cont),
        f8_cont: Number(r.f8_cont),
        f7_norm: Number(r.f7_norm),
        f8_norm: Number(r.f8_norm),
      }));
      setCalib(rows);
    } catch {
      setError("Failed to load calibration data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const symData = calib
    .filter((r) => r.symbol === selectedSymbol)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = symData[symData.length - 1];
  const last90 = symData.slice(-90);

  const vmLabel  = latest ? volMomLabel(latest.f7_cont, latest.f8_cont) : null;
  const insight  = latest ? buildInsight(selectedSymbol, latest.f7_cont, latest.f8_cont) : null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            F7 + F8 · Volume &amp; Price Momentum
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Volume surge × directional momentum · 成交量衝刺 × 方向動量
          </p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap ml-4 mt-1">
          {open ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {/* Explainer */}
      {open && (
        <div className="mb-4 mt-3 rounded-lg border border-gray-800 bg-white/[0.03] p-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: is volume confirming the price direction — or are they diverging?</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-gray-300">F7 (Volume Surge)</strong> measures whether today&apos;s volume is elevated relative to the recent average. High volume means more market participants are active — but volume alone is neutral until you pair it with direction.
              </p>
              <p className="text-gray-400 mb-3">
                <strong className="text-gray-300">F8 (Price Momentum)</strong> captures the 7d and 14d rolling return direction. A high score means sustained upward price action; a low score means sustained downward drift.
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">The four combinations</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <span className="text-green-400 font-medium">F7↑ + F8↑</span> — Volume-confirmed rally. Strongest bullish signal.</li>
                <li>• <span className="text-red-400 font-medium">F7↑ + F8↓</span> — High-volume sell-off. Active distribution — caution.</li>
                <li>• <span className="text-green-300 font-medium">F7↓ + F8↑</span> — Low-vol grind up. Rising price without conviction.</li>
                <li>• <span className="text-red-300 font-medium">F7↓ + F8↓</span> — Low-vol drift down. Slow bleed, less alarming.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：成交量有沒有配合價格方向？還是量價背離？</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-gray-300">F7（成交量衝刺）</strong>衡量今日成交量相對近期均值是否放大。量大代表市場參與者增加——但量本身是中性的，要配合方向才能解讀。
              </p>
              <p className="text-gray-400 mb-3">
                <strong className="text-gray-300">F8（價格動量）</strong>反映 7 日和 14 日滾動回報的方向。分數高代表持續上漲；分數低代表持續下跌。
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">四種組合解讀</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <span className="text-green-400 font-medium">F7↑ + F8↑</span> — 量升價漲，最理想的強勢信號</li>
                <li>• <span className="text-red-400 font-medium">F7↑ + F8↓</span> — 大量下跌，主動拋售，小心</li>
                <li>• <span className="text-green-300 font-medium">F7↓ + F8↑</span> — 低量慢漲，缺乏信心支撐</li>
                <li>• <span className="text-red-300 font-medium">F7↓ + F8↓</span> — 低量慢跌，較溫和但方向不利</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Symbol tabs */}
      <div className="flex gap-1.5 mt-3 mb-4">
        {SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedSymbol(s)}
            className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${
              selectedSymbol === s
                ? SYMBOL_COLOR[s].badge + " border-current"
                : "border-slate-600 text-slate-400 hover:text-slate-200"
            }`}
          >
            {s.replace("USDT", "")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm py-4">{error}</p>
      ) : !latest ? (
        <p className="text-slate-400 text-sm py-4">No data available.</p>
      ) : (
        <div className="space-y-4">
          {/* Snapshot */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">F7 Score · 成交量評分</p>
              <p className="text-2xl font-mono font-bold text-yellow-400">
                {(latest.f7_cont * 100).toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {latest.f7_cont > 0.6 ? "High volume · 成交量放大" : latest.f7_cont < 0.4 ? "Low volume · 成交量萎縮" : "Normal · 正常"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">F8 Score · 動量評分</p>
              <p className={`text-2xl font-mono font-bold ${latest.f8_cont > 0.6 ? "text-green-400" : latest.f8_cont < 0.4 ? "text-red-400" : "text-slate-100"}`}>
                {(latest.f8_cont * 100).toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {latest.f8_cont > 0.6 ? "Bullish momentum · 上漲動量" : latest.f8_cont < 0.4 ? "Bearish momentum · 下跌動量" : "Neutral · 中性"}
              </p>
            </div>
            <div className={`rounded-lg bg-slate-700/40 p-3 col-span-2`}>
              <p className="text-xs text-slate-400 mb-1">Combined Signal · 組合信號</p>
              <p className={`text-base font-semibold mt-1 ${vmLabel?.color}`}>{vmLabel?.text}</p>
              <p className="text-xs text-slate-400 mt-0.5">F7 × F8 combined interpretation</p>
            </div>
          </div>

          {/* Dual line chart */}
          <div className="rounded-lg bg-slate-700/30 p-3 overflow-x-auto">
            <div className="flex items-center gap-4 mb-2">
              <p className="text-xs text-slate-400">90d Trend · 90日走勢</p>
              <span className="flex items-center gap-1 text-xs text-yellow-400">
                <span className="w-4 h-0.5 bg-yellow-400 inline-block" /> F7 Volume
              </span>
              <span className="flex items-center gap-1 text-xs text-blue-400">
                <span className="w-4 h-0.5 bg-blue-400 inline-block" /> F8 Momentum
              </span>
            </div>
            <div
              dangerouslySetInnerHTML={{
                __html: dualLineSvg(last90, "f7_cont", "f8_cont", 560, 80),
              }}
            />
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
