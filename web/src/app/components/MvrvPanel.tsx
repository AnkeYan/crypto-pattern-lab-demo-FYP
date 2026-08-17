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

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">F13 · MVRV Valuation</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Market Value / Realized Value · 市值相對已實現價值
          </p>
        </div>
        <div className="flex gap-1.5">
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

          {/* 說明框 */}
          <div className="rounded-lg bg-slate-700/30 border border-slate-600/40 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-medium text-slate-100">📖 How to Read · 怎麼看</p>
            <p>
              MVRV 是「整個市場的持倉成本比較」——MVRV = 市值 ÷ 所有幣的平均持倉成本。
              <br />
              MVRV = 2 代表市場平均有 2 倍帳面利潤，大家有動力獲利了結；MVRV = 0.8 代表多數持倉者在虧損，是典型底部信號。
              <br />
              <span className="text-xs text-slate-500">
                MVRV = Market Cap / Realized Cap. High MVRV = profit-taking pressure. Low MVRV = capitulation / bottom signal.
              </span>
            </p>
            <p>
              <span className="text-slate-400">IC IR = 1.76（最強因子）：</span>
              MVRV 的滯後值（Lag7/Lag14）在 BTC/ETH 的 Walk-Forward 測試裡每次都進 Feature Importance Top-5，是預測 7 日回報最穩定的因子。
            </p>
            <p className="text-xs text-slate-500">
              ⚠️ SOL 無獨立 MVRV 數據，以 BTC MVRV 作代理使用。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
