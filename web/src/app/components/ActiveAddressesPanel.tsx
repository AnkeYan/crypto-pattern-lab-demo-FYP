"use client";

import { useEffect, useState, useCallback } from "react";

type AddrRow = {
  date: string;
  addr_count: number;
  ma30: number;
  ratio: number;
  f11_norm: number;
};

// Macro annotation events
const EVENTS: { date: string; label: string }[] = [
  { date: "2020-11-01", label: "Bull run start" },
  { date: "2021-04-14", label: "ATH Apr'21" },
  { date: "2022-06-01", label: "Bear market" },
  { date: "2023-01-01", label: "Recovery" },
  { date: "2024-03-01", label: "Halving rally" },
];

function addrSvg(data: AddrRow[], width = 560, height = 140): string {
  if (data.length < 2) return "";
  const addrVals = data.map((d) => d.addr_count);
  const maVals = data.map((d) => d.ma30);
  const allVals = [...addrVals, ...maVals].filter((v) => !isNaN(v) && v > 0);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const padL = 8, padR = 60, padT = 12, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const toY = (v: number) => padT + h - ((v - minV) / range) * h;
  const toX = (i: number) => padL + (i / (data.length - 1)) * w;

  // Daily bars (light)
  const barW = Math.max(1, w / data.length - 0.5);
  const bars = data
    .map((d, i) => {
      if (!d.addr_count || isNaN(d.addr_count)) return "";
      const x = toX(i) - barW / 2;
      const y = toY(d.addr_count);
      const bh = padT + h - y;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="#f59e0b" opacity="0.25"/>`;
    })
    .join("");

  // MA30 line
  const maPts = data
    .filter((d) => !isNaN(d.ma30) && d.ma30 > 0)
    .map((d, _i, arr) => {
      const origIdx = data.indexOf(d);
      return `${toX(origIdx).toFixed(1)},${toY(d.ma30).toFixed(1)}`;
    })
    .join(" ");

  // Annotations
  const annotations = EVENTS.flatMap(({ date, label }) => {
    const idx = data.findIndex((r) => r.date >= date);
    if (idx < 0) return [];
    const x = toX(idx);
    return [
      `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${padT + h}" stroke="#94a3b8" stroke-width="0.7" stroke-dasharray="3,3" opacity="0.4"/>`,
      `<text x="${(x + 2).toFixed(1)}" y="${padT + 10}" font-size="7" fill="#94a3b8" opacity="0.6">${label}</text>`,
    ];
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${bars}
<polyline points="${maPts}" fill="none" stroke="#f59e0b" stroke-width="2"/>
${annotations.join("")}
</svg>`;
}

export default function ActiveAddressesPanel() {
  const [data, setData] = useState<AddrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRecent, setShowRecent] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetch("/api/active-addresses-history").then((r) => r.json());
      setData(rows.sort((a: AddrRow, b: AddrRow) => a.date.localeCompare(b.date)));
    } catch {
      setError("Failed to load active addresses data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latest = data[data.length - 1];
  const displayData = showRecent ? data.slice(-365) : data;

  const ratioLabel =
    !latest ? null
    : latest.ratio > 1.1 ? { text: "Above average · 高於均值", color: "text-green-400" }
    : latest.ratio < 0.9 ? { text: "Below average · 低於均值", color: "text-red-400" }
    : { text: "Near average · 接近均值", color: "text-slate-300" };

  // Dynamic insight
  const insight = (() => {
    if (!latest) return null;
    const ratio = latest.ratio;
    const addr = latest.addr_count;
    const f11 = latest.f11_norm;

    if (ratio > 1.2) return {
      border: "border-green-500/30", bg: "bg-green-500/5", icon: "✓", titleColor: "text-green-400",
      title: "Active addresses above average — on-chain activity rising · 活躍地址高於均值",
      en: `BTC active addresses today: ${addr.toLocaleString()}, which is ${ratio.toFixed(2)}x the 30-day average — significantly above normal. F11 score = ${(f11*100).toFixed(0)}/100. Rising on-chain activity suggests real user engagement and potential capital inflow.`,
      zh: `BTC 今日活躍地址 ${addr.toLocaleString()}，是 30 日均值的 ${ratio.toFixed(2)} 倍——明顯高於正常水平。F11 評分 = ${(f11*100).toFixed(0)}/100。鏈上活動增加代表真實用戶參與度上升，可能預示資金流入。`,
    };
    if (ratio < 0.8) return {
      border: "border-red-500/20", bg: "bg-red-500/[0.03]", icon: "~", titleColor: "text-red-300",
      title: "Active addresses below average — on-chain activity quiet · 活躍地址低於均值",
      en: `BTC active addresses today: ${addr.toLocaleString()}, only ${ratio.toFixed(2)}x the 30-day average. F11 score = ${(f11*100).toFixed(0)}/100. Below-average activity may signal reduced participation or accumulation phase.`,
      zh: `BTC 今日活躍地址 ${addr.toLocaleString()}，只有 30 日均值的 ${ratio.toFixed(2)} 倍。F11 評分 = ${(f11*100).toFixed(0)}/100。活躍度低於均值可能代表參與度下降或進入積累階段。`,
    };
    return {
      border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
      title: "Active addresses near average · 活躍地址接近均值",
      en: `BTC active addresses today: ${addr.toLocaleString()} (${ratio.toFixed(2)}x 30d MA). F11 score = ${(f11*100).toFixed(0)}/100. On-chain activity is within normal range — no extreme signal.`,
      zh: `BTC 今日活躍地址 ${addr.toLocaleString()}（30 日均值的 ${ratio.toFixed(2)} 倍）。F11 評分 = ${(f11*100).toFixed(0)}/100。鏈上活動在正常範圍內，無極端信號。`,
    };
  })();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">F11 · Active Addresses (BTC)</h2>
          <p className="text-gray-500 text-sm mt-0.5">On-chain unique addresses per day · 每日鏈上活躍地址數</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <button onClick={() => setShowRecent((v) => !v)} className="px-2 py-0.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-gray-200 transition-colors">
            {showRecent ? "All History" : "Last 1Y"}
          </button>
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
              <p className="text-gray-300 mb-2"><em>The core question: how many unique Bitcoin addresses are actively transacting today — and is that above or below normal?</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">Active Addresses</strong> count the number of unique Bitcoin addresses that sent or received BTC in a given day. This is a direct measure of real network usage — unaffected by price speculation.</p>
              <p className="text-gray-400 mb-3">The <strong className="text-gray-300">MA30 Ratio</strong> compares today's count to the 30-day average. A ratio above 1.1 suggests above-average on-chain activity; below 0.9 suggests below-average.</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <strong className="text-gray-300">F11 Score</strong> — normalized ratio. Near 50 = average activity, high score = quiet (inverted: quiet = potentially oversold).</li>
                <li>• <strong className="text-gray-300">BTC only</strong> — ETH/SOL do not have equivalent on-chain address data from Blockchain.com.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2"><em>核心問題：今日有多少個比特幣地址在活躍交易？高於還是低於正常水平？</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">活躍地址數</strong>統計當天有發送或接收比特幣的唯一地址數量。這是衡量真實網絡使用量最直接的指標——不受價格投機影響。</p>
              <p className="text-gray-400 mb-3"><strong className="text-gray-300">MA30 比率</strong>是今日地址數與 30 日均值的比較。比率 &gt; 1.1 = 鏈上活動高於平均；&lt; 0.9 = 低於平均。</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <strong className="text-gray-300">F11 評分</strong>——標準化比率。接近 50 = 正常活動；高分 = 偏靜（取反：活動越靜 = 可能超賣）。</li>
                <li>• <strong className="text-gray-300">僅限 BTC</strong>——ETH/SOL 沒有 Blockchain.com 的對等鏈上地址數據。</li>
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
              <p className="text-xs text-slate-400 mb-1">Latest Daily · 最新活躍地址</p>
              <p className="text-xl font-mono font-bold text-slate-100">
                {latest.addr_count.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">unique addresses</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">MA30 Ratio · vs 30日均值</p>
              <p className={`text-xl font-mono font-bold ${ratioLabel?.color}`}>
                {latest.ratio.toFixed(2)}x
              </p>
              <p className={`text-xs mt-0.5 ${ratioLabel?.color}`}>{ratioLabel?.text}</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">F11 Score · 評分</p>
              <p className="text-xl font-mono font-bold text-slate-100">
                {(latest.f11_norm * 100).toFixed(0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">0=very busy · 100=very quiet</p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg bg-slate-700/30 p-3 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-2">
              Active Addresses History · 歷史走勢（bar = daily, line = MA30）
            </p>
            <div dangerouslySetInnerHTML={{ __html: addrSvg(displayData, 560, 140) }} />
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
