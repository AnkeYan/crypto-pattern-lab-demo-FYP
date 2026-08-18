"use client";

import { useEffect, useState, useCallback } from "react";

type MvrvRow = {
  symbol: string;
  date: string;
  mvrv: number;
  f13_norm: number;
};

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const SYMBOL_COLOR: Record<string, { line: string; badge: string }> = {
  BTCUSDT: { line: "#f59e0b", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  ETHUSDT: { line: "#60a5fa", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  SOLUSDT: { line: "#a78bfa", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

function mvrvLabel(v: number) {
  if (v > 3.5) return { text: "Overheated · 市場過熱", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" };
  if (v > 2.5) return { text: "Elevated · 偏高估值", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" };
  if (v > 1.0) return { text: "Fair Value · 合理估值", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" };
  return { text: "Undervalued · 低估（底部區域）", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" };
}

// Draw SVG line chart with zone shading
function mvrvSvgChart(data: MvrvRow[], width = 560, height = 140): string {
  if (data.length < 2) return "";
  const values = data.map((d) => d.mvrv);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 4);
  const range = maxV - minV || 1;
  const padL = 8, padR = 8, padT = 8, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const toY = (v: number) => padT + h - ((v - minV) / range) * h;
  const toX = (i: number) => padL + (i / (data.length - 1)) * w;

  // Zone shading
  const y35 = toY(3.5);
  const y10 = toY(1.0);

  const zones = [
    `<rect x="${padL}" y="${padT}" width="${w}" height="${Math.max(0, y35 - padT)}" fill="#ef4444" opacity="0.08"/>`,
    `<rect x="${padL}" y="${y10}" width="${w}" height="${Math.max(0, padT + h - y10)}" fill="#3b82f6" opacity="0.08"/>`,
  ];

  // Reference lines
  const refLines = [3.5, 1.0].map((ref) => {
    const ry = toY(ref);
    const col = ref === 3.5 ? "#ef4444" : "#3b82f6";
    return `<line x1="${padL}" y1="${ry.toFixed(1)}" x2="${padL + w}" y2="${ry.toFixed(1)}" stroke="${col}" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.6"/>
<text x="${padL + w + 2}" y="${(ry + 4).toFixed(1)}" font-size="9" fill="${col}" opacity="0.7">${ref}</text>`;
  });

  // Line path
  const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.mvrv).toFixed(1)}`).join(" ");
  const linePath = `<polyline points="${pts}" fill="none" stroke="#f59e0b" stroke-width="1.5"/>`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${zones.join("")}${refLines.join("")}${linePath}</svg>`;
}

export default function MvrvPanel() {
  const [data, setData] = useState<MvrvRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetch("/api/mvrv-history").then((r) => r.json());
      setData(rows);
    } catch {
      setError("Failed to load MVRV data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const symData = data
    .filter((r) => r.symbol === selectedSymbol)
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = symData[symData.length - 1];
  const label = latest ? mvrvLabel(latest.mvrv) : null;

  // Score history: last 90 rows
  const scoreHistory = symData.slice(-90);

  const symLabel = selectedSymbol.replace("USDT", "");

  // Dynamic insight
  const insight = (() => {
    if (!latest) return null;
    const mvrv = latest.mvrv;
    const f13 = latest.f13_norm;

    if (mvrv > 3.5) return {
      border: "border-red-500/30", bg: "bg-red-500/5", icon: "⚠", titleColor: "text-red-400",
      title: "MVRV overheated — profit-taking zone · MVRV 過熱，獲利了結壓力大",
      en: `${symLabel} MVRV = ${mvrv.toFixed(2)} — in the overheated zone (> 3.5). The average holder is sitting on significant unrealised profit, creating strong profit-taking pressure. F13 score = ${(f13*100).toFixed(0)}/100. Historically, MVRV > 3.5 has preceded major market tops.`,
      zh: `${symLabel} MVRV = ${mvrv.toFixed(2)}，處於過熱區間（> 3.5）。市場持有者平均帳面利潤豐厚，獲利了結壓力大。F13 評分 = ${(f13*100).toFixed(0)}/100。歷史上 MVRV > 3.5 往往在大頂附近出現。`,
    };
    if (mvrv > 2.5) return {
      border: "border-orange-500/20", bg: "bg-orange-500/[0.03]", icon: "~", titleColor: "text-orange-400",
      title: "MVRV elevated — caution zone · MVRV 偏高，注意頂部風險",
      en: `${symLabel} MVRV = ${mvrv.toFixed(2)} — elevated but not yet extreme. F13 score = ${(f13*100).toFixed(0)}/100. The market is in profit but below the overheated threshold. Monitor for further expansion toward 3.5.`,
      zh: `${symLabel} MVRV = ${mvrv.toFixed(2)}，偏高但尚未極端。F13 評分 = ${(f13*100).toFixed(0)}/100。市場整體有利潤但未到過熱門檻。留意是否繼續向 3.5 擴張。`,
    };
    if (mvrv < 1.0) return {
      border: "border-blue-500/30", bg: "bg-blue-500/5", icon: "✓", titleColor: "text-blue-400",
      title: "MVRV below 1 — deep value / capitulation zone · MVRV 低於 1，深度底部",
      en: `${symLabel} MVRV = ${mvrv.toFixed(2)} — below 1.0, meaning the average holder is at a loss. F13 score = ${(f13*100).toFixed(0)}/100. Historically, MVRV < 1 has been a reliable long-term bottom signal. This is where patient capital accumulates.`,
      zh: `${symLabel} MVRV = ${mvrv.toFixed(2)}，低於 1.0，市場平均持有者處於虧損狀態。F13 評分 = ${(f13*100).toFixed(0)}/100。歷史上 MVRV < 1 是可靠的長期底部信號，是耐心資本的積累區域。`,
    };
    return {
      border: "border-green-500/20", bg: "bg-green-500/[0.03]", icon: "~", titleColor: "text-green-400",
      title: "MVRV fair value — healthy zone · MVRV 合理估值區間",
      en: `${symLabel} MVRV = ${mvrv.toFixed(2)} — in the fair value zone (1.0–2.5). The market is healthy: holders have moderate unrealised gains but no extreme profit-taking pressure. F13 score = ${(f13*100).toFixed(0)}/100.`,
      zh: `${symLabel} MVRV = ${mvrv.toFixed(2)}，處於合理估值區間（1.0–2.5）。市場健康：持有者有適度帳面利潤但無極端獲利了結壓力。F13 評分 = ${(f13*100).toFixed(0)}/100。`,
    };
  })();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">F13 · MVRV Valuation</h2>
          <p className="text-gray-500 text-sm mt-0.5">Market Value / Realized Value · 市值相對已實現價值</p>
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
              <p className="text-gray-300 mb-2"><em>The core question: is the average crypto holder in profit or at a loss — and by how much?</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">MVRV</strong> = Market Cap ÷ Realised Cap. Realised Cap values each coin at the price it last moved on-chain — a proxy for the market's aggregate cost basis. MVRV = 2 means the average holder has 2x unrealised profit.</p>
              <ul className="space-y-1 text-xs text-gray-400 mt-2">
                <li>• <strong className="text-red-400">&gt; 3.5</strong> — Overheated. Strong profit-taking pressure. Historically near market tops.</li>
                <li>• <strong className="text-orange-400">2.5–3.5</strong> — Elevated. Watch for distribution.</li>
                <li>• <strong className="text-green-400">1.0–2.5</strong> — Fair value. Healthy market.</li>
                <li>• <strong className="text-blue-400">&lt; 1.0</strong> — Below cost basis. Capitulation / bottom zone.</li>
                <li>• <strong className="text-gray-300">F13 IC IR = +1.76 (Strongest factor)</strong> — top predictor across all 15 factors.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2"><em>核心問題：市場平均持有者在盈利還是虧損？盈虧幅度多大？</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">MVRV</strong> = 市值 ÷ 已實現市值。已實現市值以每個幣種最後一次在鏈上移動時的價格計算——代表市場的平均持倉成本。MVRV = 2 代表平均持有者有 2 倍帳面利潤。</p>
              <ul className="space-y-1 text-xs text-gray-400 mt-2">
                <li>• <strong className="text-red-400">&gt; 3.5</strong> — 過熱。獲利了結壓力大，歷史上接近市場頂部。</li>
                <li>• <strong className="text-orange-400">2.5–3.5</strong> — 偏高，留意派發跡象。</li>
                <li>• <strong className="text-green-400">1.0–2.5</strong> — 合理估值，市場健康。</li>
                <li>• <strong className="text-blue-400">&lt; 1.0</strong> — 低於持倉成本，恐慌拋售/底部區域。</li>
                <li>• <strong className="text-gray-300">F13 IC IR = +1.76（最強因子）</strong>——15 個因子中預測力最高。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Symbol tabs */}
      <div className="flex gap-1.5 mt-3 mb-4">
        {SYMBOLS.map((s) => (
          <button key={s} onClick={() => setSelectedSymbol(s)}
            className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors ${
              selectedSymbol === s ? SYMBOL_COLOR[s].badge + " border-current" : "border-gray-700 text-gray-400 hover:text-gray-200"
            }`}>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className={`rounded-lg border p-3 ${label?.bg}`}>
              <p className="text-xs text-slate-400 mb-1">Current MVRV · 當前 MVRV</p>
              <p className={`text-2xl font-mono font-bold ${label?.color}`}>
                {latest.mvrv.toFixed(2)}
              </p>
              <p className={`text-xs mt-0.5 ${label?.color}`}>{label?.text}</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">F13 Score · 評分</p>
              <p className="text-2xl font-mono font-bold text-slate-100">
                {(latest.f13_norm * 100).toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">0=overheated · 100=deep value</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">IC IR · 預測力</p>
              <p className="text-2xl font-mono font-bold text-green-400">1.76</p>
              <p className="text-xs text-slate-400 mt-0.5">Strongest factor · 15個因子最強</p>
            </div>
          </div>

          {/* Zone legend */}
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40 inline-block" />
              <span className="text-slate-400">MVRV &gt; 3.5 Overheated zone</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/40 inline-block" />
              <span className="text-slate-400">MVRV &lt; 1.0 Bottom zone</span>
            </span>
          </div>

          {/* Full history chart */}
          <div className="rounded-lg bg-slate-700/30 p-3 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-2">
              MVRV History · 歷史走勢
              {selectedSymbol === "SOLUSDT" && (
                <span className="ml-2 text-slate-500">（SOL 無 MVRV 數據，使用 BTC 代理）</span>
              )}
            </p>
            <div
              dangerouslySetInnerHTML={{
                __html: mvrvSvgChart(symData, 560, 140),
              }}
            />
          </div>

          {/* F13 score last 90d */}
          <div className="rounded-lg bg-slate-700/30 p-3">
            <p className="text-xs text-slate-400 mb-2">F13 Score (last 90d) · 近90日評分走勢</p>
            <div
              dangerouslySetInnerHTML={{
                __html: (() => {
                  const vals = scoreHistory.map((d) => d.f13_norm);
                  if (!vals.length) return "";
                  const min = 0, max = 1, w = 560, h = 40;
                  const pts = vals.map((v, i) =>
                    `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - v * h).toFixed(1)}`
                  ).join(" ");
                  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="#f59e0b" stroke-width="1.5"/></svg>`;
                })(),
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
          {selectedSymbol === "SOLUSDT" && (
            <p className="text-xs text-gray-700 mt-1">⚠️ SOL 無獨立 MVRV 數據，以 BTC MVRV 作代理使用。</p>
          )}
        </div>
      )}
    </div>
  );
}
