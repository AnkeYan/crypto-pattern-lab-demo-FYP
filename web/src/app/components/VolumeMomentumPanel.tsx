"use client";

// VolumeMomentumPanel — F7 Volume Surge × F8 Price Momentum
// 成交量衝刺 × 方向動量，仿 RollingCorrelationChart 設計：全量數據 + Recharts Brush

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Brush, ResponsiveContainer, Legend,
} from "recharts";

type CalibRow = {
  symbol: string;
  date: string;
  f7_cont: number;
  f8_cont: number;
};

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const SYMBOL_COLOR: Record<string, { badge: string }> = {
  BTCUSDT: { badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  ETHUSDT: { badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  SOLUSDT: { badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

const RANGE_OPTIONS = [
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
  { label: "All", days: 99999 },
];

function calcBrushIndices(total: number, days: number) {
  const startIndex = Math.max(0, total - days - 1);
  return { startIndex, endIndex: total - 1 };
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
    en: `${symLabel} is showing high volume (F7=${(f7*100).toFixed(0)}) with positive price momentum (F8=${(f8*100).toFixed(0)}). Volume is confirming the price move — the strongest bullish setup in this framework. Historically, volume-confirmed rallies tend to have follow-through.`,
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
    zh: `${symLabel} 動量偏正（F8=${(f8*100).toFixed(0)}），但成交量未有放大（F7=${(f7*100).toFixed(0)}）。低量慢漲缺乏市場信心支撐，持續性存疑。`,
  };
  if (!highVol && !lowVol && bearMom) return {
    border: "border-red-500/20", bg: "bg-red-500/[0.03]", icon: "~", titleColor: "text-red-300",
    title: "Low-vol drift down · 低量慢跌",
    en: `${symLabel} has bearish momentum (F8=${(f8*100).toFixed(0)}) on moderate volume (F7=${(f7*100).toFixed(0)}). A slow drift lower — less alarming than a high-vol sell-off, but momentum is still unfavourable.`,
    zh: `${symLabel} 動量偏負（F8=${(f8*100).toFixed(0)}），成交量屬中性（F7=${(f7*100).toFixed(0)}）。屬於低量慢跌，不如大量拋售那麼急，但動量仍然不利。`,
  };
  if (lowVol && bullMom) return {
    border: "border-green-500/20", bg: "bg-green-500/[0.03]", icon: "~", titleColor: "text-green-300",
    title: "Low-vol grind up · 低量慢漲",
    en: `${symLabel} has bullish momentum (F8=${(f8*100).toFixed(0)}) but volume is low (F7=${(f7*100).toFixed(0)}). Rising price without volume conviction — may stall without participation.`,
    zh: `${symLabel} 動量偏正（F8=${(f8*100).toFixed(0)}），但成交量偏低（F7=${(f7*100).toFixed(0)}）。低量慢漲，缺乏信心支撐，需等量能跟上。`,
  };
  if (lowVol && bearMom) return {
    border: "border-red-500/20", bg: "bg-red-500/[0.03]", icon: "~", titleColor: "text-red-300",
    title: "Low-vol drift down · 低量慢跌",
    en: `${symLabel} is drifting lower on low volume (F7=${(f7*100).toFixed(0)}, F8=${(f8*100).toFixed(0)}). Less alarming than a high-vol sell-off, but the path of least resistance is still downward.`,
    zh: `${symLabel} 低量下跌（F7=${(f7*100).toFixed(0)}，F8=${(f8*100).toFixed(0)}）。比大量拋售溫和，但阻力最小的方向仍是向下。`,
  };
  return {
    border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
    title: "Neutral · 中性",
    en: `${symLabel} shows neutral conditions — volume (F7=${(f7*100).toFixed(0)}) and momentum (F8=${(f8*100).toFixed(0)}) are both in the mid-range. No strong directional signal from this factor pair at the moment.`,
    zh: `${symLabel} 目前成交量（F7=${(f7*100).toFixed(0)}）和動量（F8=${(f8*100).toFixed(0)}）均處於中性區間，沒有明確的方向性信號。`,
  };
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function VolMomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const f7 = payload.find(p => p.name === "F7 Volume");
  const f8 = payload.find(p => p.name === "F8 Momentum");
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {f7 && <p style={{ color: f7.color }}>F7 Volume: {(f7.value * 100).toFixed(1)}</p>}
      {f8 && <p style={{ color: f8.color }}>F8 Momentum: {(f8.value * 100).toFixed(1)}</p>}
    </div>
  );
}

// ── BrushTraveller（仿 RollingCorrelationChart）─────────────────────────────
function BrushTraveller({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const cx = x + width / 2;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={3} fill="#374151" stroke="#4B5563" strokeWidth={1} />
      <line x1={cx - 2} y1={y + 4} x2={cx - 2} y2={y + height - 4} stroke="#9CA3AF" strokeWidth={1} />
      <line x1={cx + 2} y1={y + 4} x2={cx + 2} y2={y + height - 4} stroke="#9CA3AF" strokeWidth={1} />
    </g>
  );
}

// ── RangeSelector ─────────────────────────────────────────────────────────────
function RangeSelector({ active, onSelect }: { active: string; onSelect: (label: string) => void }) {
  return (
    <div className="flex gap-1">
      {RANGE_OPTIONS.map(o => (
        <button key={o.label} onClick={() => onSelect(o.label)}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${active === o.label ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VolumeMomentumPanel() {
  const [calib, setCalib]               = useState<CalibRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [open, setOpen]                 = useState(false);
  const [rangeLabel, setRangeLabel]     = useState("1Y");
  const [brush, setBrush]               = useState<{ startIndex: number; endIndex: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch("/api/multifactor-calibration").then((r) => r.json());
      const rows: CalibRow[] = (resp?.rows ?? []).map((r: Record<string, unknown>) => ({
        symbol:  String(r.symbol),
        date:    String(r.date),
        f7_cont: Number(r.f7_cont),
        f8_cont: Number(r.f8_cont),
      }));
      setCalib(rows);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const symData = useMemo(() =>
    calib.filter(r => r.symbol === selectedSymbol).sort((a, b) => a.date.localeCompare(b.date)),
    [calib, selectedSymbol]
  );
  const total  = symData.length;
  const latest = symData[total - 1] ?? null;

  const brushIdx = brush ?? calcBrushIndices(total, RANGE_OPTIONS.find(o => o.label === rangeLabel)?.days ?? 365);

  function handleRange(label: string) {
    setRangeLabel(label);
    setBrush(calcBrushIndices(total, RANGE_OPTIONS.find(o => o.label === label)?.days ?? 365));
  }

  // 觸控板橫滑
  const WHEEL_STEP = 5;
  const chartRef     = useRef<HTMLDivElement>(null);
  const brushIdxRef  = useRef(brushIdx);
  const totalRef     = useRef(total);
  brushIdxRef.current = brushIdx;
  totalRef.current    = total;

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaX === 0) return;
      e.preventDefault();
      const dir = e.deltaX > 0 ? 1 : -1;
      const cur = brushIdxRef.current;
      const windowSize = cur.endIndex - cur.startIndex;
      const newStart = Math.max(0, Math.min(totalRef.current - windowSize - 1, cur.startIndex + dir * WHEEL_STEP));
      setBrush({ startIndex: newStart, endIndex: newStart + windowSize });
      setRangeLabel("");
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const insight = latest ? buildInsight(selectedSymbol, latest.f7_cont, latest.f8_cont) : null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">F7 + F8 · Volume &amp; Price Momentum</h2>
          <p className="text-gray-500 text-sm mt-0.5">
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
        {SYMBOLS.map(s => (
          <button key={s} onClick={() => { setSelectedSymbol(s); setBrush(null); setRangeLabel("1Y"); }}
            className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${
              selectedSymbol === s
                ? SYMBOL_COLOR[s].badge + " border-current"
                : "border-gray-700 text-gray-400 hover:text-gray-200"
            }`}>
            {s.replace("USDT", "")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm py-4">{error}</p>
      ) : !latest ? (
        <p className="text-gray-400 text-sm py-4">No data available.</p>
      ) : (
        <div className="space-y-4">

          {/* Current snapshot cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-800/60 p-3">
              <p className="text-xs text-gray-400 mb-1">F7 Score · 成交量評分</p>
              <p className="text-2xl font-mono font-bold text-yellow-400">
                {(latest.f7_cont * 100).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {latest.f7_cont > 0.6 ? "High volume · 成交量放大" : latest.f7_cont < 0.4 ? "Low volume · 成交量萎縮" : "Normal · 正常"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/60 p-3">
              <p className="text-xs text-gray-400 mb-1">F8 Score · 動量評分</p>
              <p className={`text-2xl font-mono font-bold ${latest.f8_cont > 0.6 ? "text-green-400" : latest.f8_cont < 0.4 ? "text-red-400" : "text-gray-100"}`}>
                {(latest.f8_cont * 100).toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {latest.f8_cont > 0.6 ? "Bullish momentum · 上漲動量" : latest.f8_cont < 0.4 ? "Bearish momentum · 下跌動量" : "Neutral · 中性"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-800/60 p-3 col-span-2">
              <p className="text-xs text-gray-400 mb-1">Combined Signal · 組合信號</p>
              <p className={`text-sm font-semibold mt-1 ${insight?.titleColor}`}>{insight?.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{latest.date}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400">Historical trend · 歷史走勢（0–100 分）</p>
              <RangeSelector active={rangeLabel} onSelect={handleRange} />
            </div>
            <div ref={chartRef}>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={symData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }}
                    tickFormatter={v => v.slice(0, 7)}
                    interval={Math.floor(total / 6)} minTickGap={40} />
                  <YAxis domain={[0, 1]} tickFormatter={v => String(Math.round(v * 100))}
                    tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <Tooltip content={<VolMomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
                  <ReferenceLine y={0.6} stroke="#374151" strokeDasharray="4 2" strokeWidth={0.8} />
                  <ReferenceLine y={0.4} stroke="#374151" strokeDasharray="4 2" strokeWidth={0.8} />
                  <Line type="monotone" dataKey="f7_cont" name="F7 Volume" stroke="#f59e0b"
                    dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="f8_cont" name="F8 Momentum" stroke="#60a5fa"
                    dot={false} strokeWidth={1.5} />
                  <Brush dataKey="date" height={20} stroke="#374151" fill="#111827" travellerWidth={8}
                    traveller={<BrushTraveller x={0} y={0} width={0} height={0} />}
                    startIndex={brushIdx.startIndex} endIndex={brushIdx.endIndex}
                    onChange={range => {
                      if (range && typeof range.startIndex === "number" && typeof range.endIndex === "number") {
                        setBrush({ startIndex: range.startIndex, endIndex: range.endIndex });
                        setRangeLabel("");
                      }
                    }}
                    tickFormatter={v => String(v).slice(0, 7)} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-700 mt-1">
              Dotted lines at 0.4 / 0.6 mark low / high thresholds. Drag Brush or use range buttons to zoom.
              · 虛線為 40 / 60 分界，拖動 Brush 或點按鈕縮放。
            </p>
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
