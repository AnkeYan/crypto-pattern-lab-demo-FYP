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
  f7_cont: number;
  f8_cont: number;
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
  const [open, setOpen] = useState(false);

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

  const symLabel = selectedSymbol.replace("USDT", "");

  // Dynamic insight
  const insight = (() => {
    if (!latest) return null;
    const rate = latest.daily_avg;
    const negPct = latest.neg_pct_7d;
    const f9 = f9Score ?? 0.5;
    const f14 = f14Score ?? 0.5;

    if (rate > 0.0005 && negPct < 0.2) return {
      border: "border-red-500/30", bg: "bg-red-500/5", icon: "⚠", titleColor: "text-red-400",
      title: "High positive funding — crowded longs · 多頭擁擠，費率偏高",
      en: `${symLabel} funding rate is ${pct(rate)} — elevated positive territory. ${(negPct*100).toFixed(0)}% of the past 7d rates were negative. F9 score = ${(f9*100).toFixed(0)}/100. Historically, high sustained positive rates signal crowded long positioning and often precede pullbacks.`,
      zh: `${symLabel} 資金費率 ${pct(rate)}，處於較高正值區間。過去 7 天中 ${(negPct*100).toFixed(0)}% 為負費率。F9 評分 = ${(f9*100).toFixed(0)}/100。歷史上持續高正費率代表多頭擁擠，往往是回調的前兆。`,
    };
    if (rate < -0.0003 || negPct > 0.6) return {
      border: "border-green-500/30", bg: "bg-green-500/5", icon: "✓", titleColor: "text-green-400",
      title: "Negative / low funding — short squeeze potential · 空頭溢價，反彈潛力",
      en: `${symLabel} funding rate is ${pct(rate)}. ${(negPct*100).toFixed(0)}% of the past 7d rates were negative — shorts are paying longs. F9 score = ${(f9*100).toFixed(0)}/100. Negative funding historically correlates with oversold setups and potential short-squeeze bounces.`,
      zh: `${symLabel} 資金費率 ${pct(rate)}。過去 7 天中 ${(negPct*100).toFixed(0)}% 為負費率——空頭在付費給多頭。F9 評分 = ${(f9*100).toFixed(0)}/100。負費率歷史上與超賣設置和潛在空頭回補反彈相關。`,
    };
    if (f14 > 0.6) return {
      border: "border-green-500/20", bg: "bg-green-500/[0.03]", icon: "~", titleColor: "text-green-300",
      title: "Funding rate declining — deleveraging signal · 費率下降，去槓桿訊號",
      en: `${symLabel} current rate is ${pct(rate)} but F14 trend score = ${(f14*100).toFixed(0)}/100 indicates the rate is declining. A rapid drop from elevated rates signals active deleveraging — historically this has preceded price bottoms.`,
      zh: `${symLabel} 當前費率 ${pct(rate)}，但 F14 趨勢評分 = ${(f14*100).toFixed(0)}/100，顯示費率正在下降。費率從高位快速下滑是去槓桿訊號，歷史上往往出現在價格底部附近。`,
    };
    return {
      border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
      title: "Neutral funding conditions · 費率中性",
      en: `${symLabel} funding rate is ${pct(rate)} — within neutral range. F9 = ${(f9*100).toFixed(0)}/100, F14 = ${(f14*100).toFixed(0)}/100. No extreme positioning signal at this time.`,
      zh: `${symLabel} 資金費率 ${pct(rate)}，處於中性區間。F9 = ${(f9*100).toFixed(0)}/100，F14 = ${(f14*100).toFixed(0)}/100。目前無極端倉位信號。`,
    };
  })();

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-semibold">F9 + F14 · Funding Rate &amp; Trend</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Perpetual futures funding sentiment · 永續合約資金費率情緒
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
              <p className="text-gray-300 mb-2"><em>The core question: are traders paying a premium to be long — or short?</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">F9 (Funding Rate Level)</strong> — Perpetual futures funding rate is paid every 8 hours by longs to shorts (positive rate) or shorts to longs (negative rate). A high positive rate means the market is crowded with longs — historically a contrarian bearish signal. Negative rates signal excessive short positioning — potential for a short squeeze.</p>
              <p className="text-gray-400 mb-3"><strong className="text-gray-300">F14 (Funding Rate Trend)</strong> — Captures the 7-day change in funding rate direction. A rapid decline from elevated positive rates signals active deleveraging — historically this has preceded price bottoms.</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <strong className="text-gray-300">F9 IC IR = +1.41 (Strong)</strong> — one of the most predictive factors across all 15.</li>
                <li>• <strong className="text-gray-300">F14 IC IR = +1.33 (Strong)</strong> — trend direction adds independent signal beyond the level.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2"><em>核心問題：交易者在為多頭還是空頭倉位付溢價？</em></p>
              <p className="text-gray-400 mb-2"><strong className="text-gray-300">F9（費率水平）</strong>——永續合約每 8 小時收一次資金費，正費率由多頭付給空頭，負費率反之。費率高正值 = 市場多頭擁擠，歷史上是反向看跌信號；負費率 = 空頭過多，有潛在軋空彈升機會。</p>
              <p className="text-gray-400 mb-3"><strong className="text-gray-300">F14（費率趨勢）</strong>——捕捉費率的 7 日變化方向。費率從高位快速下跌 = 主動去槓桿，歷史上往往出現在底部附近。</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <strong className="text-gray-300">F9 IC IR = +1.41（Strong）</strong>——15 個因子中預測力最強的一批。</li>
                <li>• <strong className="text-gray-300">F14 IC IR = +1.33（Strong）</strong>——趨勢方向提供費率水平以外的獨立信號。</li>
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
                : "border-gray-700 text-gray-400 hover:text-gray-200"
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
