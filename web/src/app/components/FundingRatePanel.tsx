"use client";

import { useEffect, useState, useCallback } from "react";

type FundingRow = {
  symbol: string;
  date: string;
  daily_avg: number;
  daily_min: number;
  daily_max: number;
  daily_count: number;
  neg_pct_7d: number;
  f9_norm: number;
};

type CalibRow = {
  symbol: string;
  date: string;
  f9_cont: number;
  f14_cont: number;
};

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

const SYMBOL_COLOR: Record<string, { line: string; badge: string }> = {
  BTCUSDT: { line: "#f59e0b", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  ETHUSDT: { line: "#60a5fa", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  SOLUSDT: { line: "#a78bfa", badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

function rateLabel(rate: number) {
  if (rate > 0.0005) return { text: "Strongly Bullish · 高多頭溢價", color: "text-green-400" };
  if (rate > 0) return { text: "Bullish · 輕微多頭溢價", color: "text-green-300" };
  if (rate < -0.0005) return { text: "Strongly Bearish · 高空頭溢價", color: "text-red-400" };
  if (rate < 0) return { text: "Bearish · 輕微空頭溢價", color: "text-red-300" };
  return { text: "Neutral · 市場中性", color: "text-slate-400" };
}

function pct(v: number, d = 4) {
  return `${(v * 100).toFixed(d)}%`;
}

function miniSparkline(
  data: number[],
  width = 180,
  height = 40,
  positiveColor = "#4ade80",
  negativeColor = "#f87171"
): string {
  if (!data.length) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = `<polyline points="${pts.join(" ")}" fill="none" stroke="${
    data[data.length - 1] >= 0 ? positiveColor : negativeColor
  }" stroke-width="1.5"/>`;
  const zeroY = height - ((0 - min) / range) * height;
  const zeroLine =
    min < 0 && max > 0
      ? `<line x1="0" y1="${zeroY.toFixed(1)}" x2="${width}" y2="${zeroY.toFixed(
          1
        )}" stroke="#475569" stroke-width="0.5" stroke-dasharray="3,3"/>`
      : "";
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${zeroLine}${polyline}</svg>`;
}

export default function FundingRatePanel() {
  const [history, setHistory] = useState<FundingRow[]>([]);
  const [calib, setCalib] = useState<CalibRow[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([
        fetch("/api/funding-rate-history").then((r) => r.json()),
        fetch("/api/multifactor-calibration").then((r) => r.json()),
      ]);
      setHistory(h);
      setCalib(c?.rows ?? []);
    } catch {
      setError("Failed to load funding rate data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const symHistory = history
    .filter((r) => r.symbol === selectedSymbol)
    .sort((a, b) => a.date.localeCompare(b.date));

  const symCalib = calib
    .filter((r) => r.symbol === selectedSymbol)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Latest snapshot
  const latest = symHistory[symHistory.length - 1];

  // F9 level and F14 trend from calibration
  const latestCalib = symCalib[symCalib.length - 1];
  const f9Score = latestCalib?.f9_cont ?? null;
  const f14Score = latestCalib?.f14_cont ?? null;

  // Sparklines: last 90 days of raw rate
  const last90 = symHistory.slice(-90).map((r) => r.daily_avg);
  const last30F14 = symCalib.slice(-30).map((r) => r.f14_cont);

  const ratingInfo = latest ? rateLabel(latest.daily_avg) : null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            F9 + F14 · Funding Rate &amp; Trend
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Perpetual futures funding sentiment · 永續合約資金費率情緒
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
          {/* Today's snapshot */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">Latest Rate · 最新費率</p>
              <p className={`text-lg font-mono font-semibold ${ratingInfo?.color}`}>
                {pct(latest.daily_avg)}
              </p>
              <p className={`text-xs mt-0.5 ${ratingInfo?.color}`}>{ratingInfo?.text}</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">7d Neg Rate % · 7日負費率佔比</p>
              <p className="text-lg font-mono font-semibold text-slate-100">
                {(latest.neg_pct_7d * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {latest.neg_pct_7d > 0.5 ? "Bearish pressure · 偏空" : "Bullish pressure · 偏多"}
              </p>
            </div>
            {f9Score !== null && (
              <div className="rounded-lg bg-slate-700/40 p-3">
                <p className="text-xs text-slate-400 mb-1">F9 Score · 費率水平評分</p>
                <p className="text-lg font-mono font-semibold text-slate-100">
                  {(f9Score * 100).toFixed(0)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">0=high rate · 100=low/neg rate</p>
              </div>
            )}
            {f14Score !== null && (
              <div className="rounded-lg bg-slate-700/40 p-3">
                <p className="text-xs text-slate-400 mb-1">F14 Score · 費率趨勢評分</p>
                <p
                  className={`text-lg font-mono font-semibold ${
                    f14Score > 60 ? "text-green-400" : f14Score < 40 ? "text-red-400" : "text-slate-100"
                  }`}
                >
                  {(f14Score * 100).toFixed(0)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {f14Score > 60 ? "↓ Declining · 費率下降趨勢" : f14Score < 40 ? "↑ Rising · 費率上升趨勢" : "→ Flat · 費率平穩"}
                </p>
              </div>
            )}
          </div>

          {/* Sparklines */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-700/30 p-3">
              <p className="text-xs text-slate-400 mb-2">90d Funding Rate History · 90日費率走勢</p>
              <div
                dangerouslySetInnerHTML={{ __html: miniSparkline(last90, 280, 48) }}
              />
            </div>
            <div className="rounded-lg bg-slate-700/30 p-3">
              <p className="text-xs text-slate-400 mb-2">
                30d F14 Trend Score · 30日趨勢分走勢
              </p>
              <div
                dangerouslySetInnerHTML={{
                  __html: miniSparkline(last30F14, 280, 48, "#60a5fa", "#f87171"),
                }}
              />
            </div>
          </div>

          {/* 說明框 */}
          <div className="rounded-lg bg-slate-700/30 border border-slate-600/40 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-medium text-slate-100">📖 How to Read · 怎麼看</p>
            <p>
              <span className="text-slate-400">F9（費率水平）：</span>
              資金費率是多頭每 8 小時付給空頭的費用。費率越高，代表市場越「頂」——大家都看多、追多，歷史上這種時候往往是回調前兆。<br />
              <span className="text-xs text-slate-500">
                F9 (Funding Rate Level): High positive rates = crowded longs → historically precedes pullbacks.
              </span>
            </p>
            <p>
              <span className="text-slate-400">F14（費率趨勢）：</span>
              F9 是「現在費率高不高」，F14 是「費率在往哪個方向走」。費率從高位急速下跌，是多頭平倉訊號，也可能是底部反轉的前兆。<br />
              <span className="text-xs text-slate-500">
                F14 (Funding Trend): Captures 7d change direction. Rapid decline from high rates signals deleveraging.
              </span>
            </p>
            <p>
              <span className="text-slate-400">IC IR：</span>
              F9 IC IR = 1.41（Strong），F14 IC IR = 1.33（Strong）——兩個都是15個因子裡預測力最強的一批。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
