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

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            F11 · Active Addresses (BTC)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            On-chain unique addresses per day · 每日鏈上活躍地址數
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500">BTC only</span>
          <button
            onClick={() => setShowRecent((v) => !v)}
            className="px-2.5 py-1 text-xs rounded border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {showRecent ? "All History" : "Last 1Y"}
          </button>
        </div>
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

          {/* 說明框 */}
          <div className="rounded-lg bg-slate-700/30 border border-slate-600/40 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-medium text-slate-100">📖 How to Read · 怎麼看</p>
            <p>
              活躍地址數是鏈上最直接的「真實使用量」指標——不是看市場情緒，而是看有多少人在實際用比特幣。地址數超出 30 日均值，代表鏈上活動增加，可能預示資金流入或用戶增長。
              <br />
              <span className="text-xs text-slate-500">
                Active addresses = unique addresses sending/receiving BTC per day. Rising above MA30 signals increased on-chain activity.
              </span>
            </p>
            <p>
              <span className="text-slate-400">F11 評分邏輯：</span>
              ratio（每日地址 ÷ MA30）越高，說明活躍度比近期平均高，但太高反而可能是過熱。F11 評分是把 ratio 轉換成 0–100 的分數，適中的活躍度得高分。
            </p>
            <p className="text-xs text-slate-500">
              ⚠️ 只有 BTC 有活躍地址數據（Blockchain.com）。ETH/SOL 的 F11 在 XGBoost 已排除（固定 0.5 噪音）。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
