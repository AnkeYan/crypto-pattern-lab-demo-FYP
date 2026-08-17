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

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">F12 · Market Turbulence Index</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Mahalanobis distance across BTC/ETH/SOL · 三幣種馬氏距離
          </p>
        </div>
        {latest && (
          <span className={`px-2.5 py-1 text-xs rounded border font-medium ${lc?.badge}`}>
            {latest.turbulence_level.charAt(0).toUpperCase() + latest.turbulence_level.slice(1)}
          </span>
        )}
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

          {/* 說明框 */}
          <div className="rounded-lg bg-slate-700/30 border border-slate-600/40 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-medium text-slate-100">📖 How to Read · 怎麼看</p>
            <p>
              Turbulence Index 是「異常同步移動偵測器」——它量的不是單個幣種波動有多大，而是 BTC/ETH/SOL 三個幣種有沒有同時往不尋常的方向大幅移動。
              <br />
              <span className="text-xs text-slate-500">
                Turbulence Index (Kritzman & Li, 2010) measures Mahalanobis distance of multi-asset returns. High = unusual joint movement across BTC/ETH/SOL.
              </span>
            </p>
            <p>
              <span className="text-slate-400">為什麼有用：</span>
              Luna 崩塌、FTX 暴雷、SVB 危機這些系統性事件，都會讓三個幣種同時大幅移動，Turbulence 會突然爆升。F12 = 1 - turbulence（取反），平靜市場得高分，適合配合 RSI 超賣信號使用。
            </p>
            <p className="text-xs text-slate-500">
              ⚠️ 數據從 2021-05-20 起，需要 BTC/ETH/SOL 三幣種同時有數據才能計算協方差矩陣。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
