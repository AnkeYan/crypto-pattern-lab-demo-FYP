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

export default function VolumeMomentumPanel() {
  const [calib, setCalib] = useState<CalibRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const vmLabel = latest ? volMomLabel(latest.f7_cont, latest.f8_cont) : null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            F7 + F8 · Volume &amp; Price Momentum
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Volume surge × directional momentum · 成交量衝刺 × 方向動量
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

          {/* 說明框 */}
          <div className="rounded-lg bg-slate-700/30 border border-slate-600/40 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-medium text-slate-100">📖 How to Read · 怎麼看</p>
            <p>
              <span className="text-slate-400">F7（成交量）：</span>
              量是「市場信心的溫度計」。量放大而且是上漲的那種，是最健康的強勢信號；量放大而且是下跌的那種，要小心恐慌盤。
              <br />
              <span className="text-xs text-slate-500">
                F7: Volume surge score. High score = volume above recent average. Requires direction check (F8) to interpret.
              </span>
            </p>
            <p>
              <span className="text-slate-400">F8（動量）：</span>
              7 日和 14 日滾動回報的方向。連續幾天陽線、回報偏正，F8 分數就高；反之則低。
              <br />
              <span className="text-xs text-slate-500">
                F8: Price momentum (7d / 14d rolling returns). High = sustained upward price action.
              </span>
            </p>
            <p>
              <span className="text-slate-400">怎麼配合用：</span>
              F7 高 + F8 高 = 量升價漲，最理想。F7 高 + F8 低 = 大量拋售，警惕。F7 低 + F8 高 = 低量慢漲，不穩定。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
