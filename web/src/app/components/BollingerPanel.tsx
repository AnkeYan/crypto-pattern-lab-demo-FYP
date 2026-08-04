"use client";

// 這個檔案負責：Bollinger Band 突破下軌後的統計分析面板
// 篩選器：幣種 × window × k
// 內容：統計表（免費 + PRO 欄）+ Win Rate 橫向 bar chart

import { useState } from "react";
import { wilsonCILabel } from "../lib/wilson";
import { useTier, hasAccess } from "../lib/useTier";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

type BollingerRow = {
  symbol: string;
  window: number | null;
  k: number | null;
  holding_days: number | null;
  sample_size: number | null;
  mean_return: number | null;
  median_return: number | null;
  win_rate: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  skewness: number | null;
  kurtosis: number | null;
  max_drawdown: number | null;
  avg_drawdown: number | null;
};

// ── 常數 ──────────────────────────────────────────────────────────────────────
const SYMBOLS  = ["BTC", "ETH", "SOL"];
const WINDOWS  = [10, 20];
const KS       = [2.0, 2.5];
const HOLDINGS = [1, 3, 7];
const LOW_SAMPLE_THRESHOLD = 30;

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_BAR_COLOR: Record<string, string> = {
  BTC: "#22c55e",
  ETH: "#60a5fa",
  SOL: "#facc15",
};

const PRO_COLS = [
  { key: "sharpe_ratio",  label: "Sharpe",   zh: "夏普比率" },
  { key: "sortino_ratio", label: "Sortino",  zh: "索提諾比率" },
  { key: "skewness",      label: "Skewness", zh: "偏度" },
  { key: "max_drawdown",  label: "Max DD",   zh: "最大回撤" },
  { key: "avg_drawdown",  label: "Avg DD",   zh: "平均回撤" },
];

// ── 輔助函數 ──────────────────────────────────────────────────────────────────
function pct(v: number | null, decimals = 2) {
  if (v === null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}
function fmt(v: number | null, decimals = 3) {
  if (v === null || isNaN(v)) return "—";
  return v.toFixed(decimals);
}

// ── 動態 Key Takeaway 生成 ────────────────────────────────────────────────────
function buildTakeaway(sym: string, win: number, k: number, rows: BollingerRow[]) {
  if (rows.length === 0) return null;

  const row7 = rows.find((r) => r.holding_days === 7);
  const row3 = rows.find((r) => r.holding_days === 3);
  const row1 = rows.find((r) => r.holding_days === 1);

  const allRows = [row1, row3, row7].filter(Boolean) as BollingerRow[];
  const bestRow = allRows.reduce((best, r) =>
    (r.win_rate ?? 0) > (best.win_rate ?? 0) ? r : best
  , allRows[0]);

  const best7dWr = row7?.win_rate ?? null;
  const bestWr   = bestRow?.win_rate ?? null;
  const bestHold = bestRow?.holding_days ?? null;
  const n7       = row7?.sample_size ?? 0;
  const lowN     = n7 < LOW_SAMPLE_THRESHOLD;
  const wideK    = k >= 2.5;

  const hasEdge = (best7dWr ?? 0) >= 0.55;
  const weak7d  = best7dWr != null && best7dWr < 0.52;

  const kNote = wideK
    ? `2.5σ band is wider, triggering fewer but more extreme signals.`
    : `2.0σ band triggers more frequently but with a lower extreme-move filter.`;
  const kNoteZh = wideK
    ? `2.5σ 帶寬更寬，信號更少但更極端。`
    : `2.0σ 帶寬較窄，信號頻率較高但過濾門檻較低。`;

  // ── 英文摘要 ──
  let enSummary = "";
  if (lowN) {
    enSummary = `Only ${n7 || "few"} signals found for 7-day holds — BB(${win}, ${k}σ) rarely triggers on ${sym}. ${kNote} Results are directional hints only.`;
  } else if (hasEdge) {
    enSummary = `BB(${win}, ${k}σ) on ${sym} shows a historical edge: 7-day win rate is ${pct(best7dWr, 1)}, above the 55% threshold. ${kNote}`;
    if (bestHold === 7) {
      enSummary += ` Holding 7 days gives the best outcome — shorter holds show weaker or no edge.`;
    } else {
      enSummary += ` The best holding period is ${bestHold}d (${pct(bestWr, 1)}) — not necessarily the longest.`;
    }
  } else if (weak7d) {
    enSummary = `BB(${win}, ${k}σ) on ${sym} shows no consistent edge — 7-day win rate is only ${pct(best7dWr, 1)}, below 55%. ${kNote} Consider combining with RSI or Fear & Greed for confirmation.`;
  } else {
    enSummary = `BB(${win}, ${k}σ) on ${sym}: 7-day win rate is ${pct(best7dWr, 1)} — marginal. ${kNote} Use alongside other indicators for confirmation.`;
  }

  // ── 中文摘要 ──
  let zhSummary = "";
  if (lowN) {
    zhSummary = `7 天持有只有 ${n7 || "少量"} 個信號——BB(${win}, ${k}σ) 在 ${sym} 上極少觸發。${kNoteZh}結果僅供方向參考。`;
  } else if (hasEdge) {
    zhSummary = `${sym} BB(${win}, ${k}σ) 有歷史統計優勢：7 天勝率 ${pct(best7dWr, 1)}，超過 55% 門檻。${kNoteZh}`;
    if (bestHold === 7) {
      zhSummary += `持有 7 天效果最佳，1 天和 3 天的優勢較弱。`;
    } else {
      zhSummary += `最佳持有期為 ${bestHold} 天（勝率 ${pct(bestWr, 1)}），未必是最長持有。`;
    }
  } else if (weak7d) {
    zhSummary = `${sym} BB(${win}, ${k}σ) 沒有一致性優勢——7 天勝率只有 ${pct(best7dWr, 1)}，低於 55%。${kNoteZh}建議配合 RSI 或 Fear & Greed 一起判斷。`;
  } else {
    zhSummary = `${sym} BB(${win}, ${k}σ)：7 天勝率 ${pct(best7dWr, 1)}——邊緣水平。${kNoteZh}建議配合其他指標確認方向。`;
  }

  return { enSummary, zhSummary, hasEdge, weak7d, lowN };
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function BollingerPanel({ data }: { data: BollingerRow[] }) {
  const userTier      = useTier();
  const isProUnlocked = hasAccess(userTier, "pro");
  const [sym,    setSym]    = useState("BTC");
  const [window, setWindow] = useState(20);
  const [k,      setK]      = useState(2.0);
  const [showInfo, setShowInfo] = useState(false);

  // 篩出當前選擇的行
  const filtered = data.filter(
    (r) =>
      r.symbol === `${sym}USDT` &&
      r.window === window &&
      r.k === k
  );
  const takeaway = buildTakeaway(sym, window, k, filtered);

  // 圖表資料：三個 holding period 的 win rate
  const chartData = HOLDINGS.map((h) => {
    const row = filtered.find((r) => r.holding_days === h);
    return {
      label: `${h}d`,
      win_rate: row?.win_rate != null ? parseFloat((row.win_rate * 100).toFixed(1)) : null,
      low_sample: (row?.sample_size ?? 0) < LOW_SAMPLE_THRESHOLD,
    };
  });

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug">Bollinger Band<br className="sm:hidden" /> Breakout Analysis</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            布林帶下軌突破後的統計表現分析
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0 mt-0.5"
        >
          {showInfo ? "▾" : "▸"} How does this work?
        </button>
      </div>

      {/* ── 說明框（可折疊）── */}
      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">What is a Bollinger Band?</strong> Imagine drawing an "envelope" around a coin's recent price. The middle line is the average price over the last N days. The upper and lower bands sit at a distance above and below that average — determined by how volatile the price has been recently.
                When the price <strong className="text-white">falls below the lower band</strong>, it means the price has dropped unusually far compared to recent history. That's the signal this panel tracks.
              </p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">What is this panel asking?</strong><br />
                <em className="text-gray-400">"Every time BTC's price crashed below its Bollinger lower band in history — what percentage of the time was the price higher 1 / 3 / 7 days later?"</em><br />
                The <strong className="text-white">Samples</strong> column = how many times this happened. The <strong className="text-white">Win Rate</strong> = how often the price recovered afterwards.
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">Window (10d / 20d)</strong>: how many recent days are used to draw the band. 20d is standard.<br />
                <strong className="text-gray-300">Band (2σ / 2.5σ)</strong>: how wide the envelope is. Think of it as a sensitivity dial — 2σ fires more often (price only needs to drop a little outside the band), while 2.5σ only fires during more extreme crashes. Fewer signals, but each one is a bigger drop.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">布林帶是什麼？</strong> 想像在幣價周圍畫一個「信封」。中間那條線是過去 N 天的平均價格。上下兩條帶線則按照近期的波動幅度，往上下各延伸一段距離。
                當價格<strong className="text-white">跌破下方的帶線</strong>，代表這次跌幅比近期歷史異常地大——這就是這個 panel 追蹤的信號。
              </p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">這個 panel 在問什麼問題？</strong><br />
                <em className="text-gray-400">「歷史上，每次 BTC 價格跌破布林帶下軌，之後 1天 / 3天 / 7天後，有多少次是漲回來的？」</em><br />
                <strong className="text-white">Samples</strong> 欄 = 歷史上出現過幾次這種信號；<strong className="text-white">Win Rate</strong> = 這些次數裡，之後價格回升的比例。
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">Window（10天 / 20天）</strong>：用多少天的價格來畫帶線。20天是標準設定。<br />
                <strong className="text-gray-300">Band（2σ / 2.5σ）</strong>：帶線的寬窄，可以理解為靈敏度。2σ 較窄，稍微跌出帶線就觸發信號，頻率高；2.5σ 較寬，只有跌得更誇張才會觸發，信號少但每次都是更大的崩跌。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 篩選器列 ── */}
      <div className="flex flex-wrap items-center gap-4 mt-4 mb-6">

        {/* 幣種 tabs */}
        <div className="flex gap-1 border-b border-gray-700">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSym(s)}
              className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                sym === s ? SYMBOL_BORDER[s] : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Window 選擇 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Window</span>
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  window === w
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>

        {/* k 選擇 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Band</span>
          <div className="flex gap-1">
            {KS.map((kv) => (
              <button
                key={kv}
                onClick={() => setK(kv)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  k === kv
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {kv}σ
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ── 當前條件說明 ── */}
      <div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">every time {sym}&apos;s price crashed below its BB({window}, {k}σ) lower band</span>
        <span className="text-gray-400"> in history — how often was the price </span>
        <span className="text-white font-medium">higher 1 / 3 / 7 days later?</span>
        <span className="text-gray-500 ml-2 text-xs">
          ({filtered[0]?.sample_size != null ? `${filtered[0].sample_size} signals found` : "loading..."})
        </span>
        <span className="block mt-1 text-gray-500 text-sm">
          顯示：歷史上每次 {sym} 價格跌破布林帶({window}天, {k}σ)下軌，之後 1天 / 3天 / 7天後，有多少次是漲回來的？
        </span>
      </div>

      {/* ── 上半：統計表 + Win Rate 圖 side by side ── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* 左側：統計表 */}
        <div className="flex-1 overflow-x-auto">
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="pb-3 pr-6 font-medium whitespace-nowrap" style={{ minWidth: "60px" }}>Hold</th>
                <th className="pb-3 pr-6 font-medium whitespace-nowrap" style={{ minWidth: "80px" }}>Samples</th>
                <th className="pb-3 pr-6 font-medium whitespace-nowrap" style={{ minWidth: "110px" }}>Mean Return</th>
                <th className="pb-3 pr-6 font-medium whitespace-nowrap" style={{ minWidth: "90px" }}>Win Rate</th>
                {PRO_COLS.map((col) => (
                  <th key={col.key} className="pb-3 pr-6 font-medium whitespace-nowrap text-gray-500" style={{ minWidth: "90px" }}>
                    {col.label}
                    <span className="ml-1 inline-flex items-center bg-green-500/20 text-green-400 text-xs font-bold px-1 py-px rounded-full leading-none border border-green-500/30">
                      PRO
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOLDINGS.map((h) => {
                const row = filtered.find((r) => r.holding_days === h);
                const lowSample = (row?.sample_size ?? 0) < LOW_SAMPLE_THRESHOLD;
                return (
                  <tr key={h} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-4 pr-6 text-gray-300">{h}d</td>
                    <td className="py-4 pr-6">
                      <span className={lowSample ? "text-yellow-400" : "text-gray-400"}>
                        {row?.sample_size ?? "—"}
                        {lowSample && <span className="ml-1 text-xs">⚠</span>}
                      </span>
                    </td>
                    <td className="py-4 pr-6">
                      {row?.mean_return != null ? (
                        <span className={row.mean_return >= 0 ? "text-green-400" : "text-red-400"}>
                          {pct(row.mean_return)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-4 pr-6">
                      {row?.win_rate != null ? (
                        <>
                          <span className={`font-semibold ${row.win_rate >= 0.55 ? "text-green-400" : "text-gray-300"}`}>
                            {pct(row.win_rate, 1)}
                          </span>
                          {(() => {
                            const ci = wilsonCILabel(row.win_rate, row.sample_size ?? null);
                            return ci ? (
                              <span className="block text-xs text-gray-600 mt-0.5">{ci}</span>
                            ) : null;
                          })()}
                        </>
                      ) : "—"}
                    </td>
                    {/* PRO 欄：已解鎖顯示真實數字，未解鎖顯示模糊色塊 */}
                    {PRO_COLS.map((col) => (
                      <td key={col.key} className="py-4 pr-6">
                        {isProUnlocked ? (
                          <span className={
                            col.key === "max_drawdown" || col.key === "avg_drawdown"
                              ? "text-red-400"
                              : "text-gray-300"
                          }>
                            {col.key === "max_drawdown" || col.key === "avg_drawdown"
                              ? `${((row?.[col.key as keyof BollingerRow] as number ?? 0) * 100).toFixed(2)}%`
                              : (row?.[col.key as keyof BollingerRow] as number | null)?.toFixed(3) ?? "—"
                            }
                          </span>
                        ) : (
                          <span
                            className="inline-block rounded-sm select-none"
                            style={{ width: "56px", height: "13px", background: "rgba(75,85,99,0.6)", filter: "blur(5px)" }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Low sample 注釋 */}
          {filtered.some((r) => (r.sample_size ?? 0) < LOW_SAMPLE_THRESHOLD) && (
            <p className="text-yellow-400/70 text-xs mt-3 flex items-center gap-1">
              <span>⚠</span>
              <span>Rows with fewer than {LOW_SAMPLE_THRESHOLD} samples have limited statistical reliability.</span>
            </p>
          )}
        </div>

        {/* 右側：Win Rate Bar Chart */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <p className="text-xs text-gray-400 mb-3 text-center">Win Rate by Holding Period</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis
                domain={[30, 100]}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Win Rate"]}
                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                labelStyle={{ color: "#f9fafb" }}
              />
              <ReferenceLine y={55} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.35} />
              <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.low_sample ? "#6b7280" : SYMBOL_BAR_COLOR[sym]}
                    fillOpacity={entry.win_rate == null ? 0 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-gray-500 mt-1">
            Dashed line = 55% edge threshold · Grey bar = low sample
          </p>
        </div>

      </div>

      {/* ── Key Takeaway ── */}
      {takeaway && (
        <div className={`mt-5 rounded-lg border p-4 text-sm leading-relaxed ${
          takeaway.lowN
            ? "border-yellow-500/30 bg-yellow-500/5"
            : takeaway.hasEdge
            ? "border-green-500/30 bg-green-500/5"
            : takeaway.weak7d
            ? "border-red-500/20 bg-red-500/5"
            : "border-gray-700 bg-white/[0.03]"
        }`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
            takeaway.lowN ? "text-yellow-400" : takeaway.hasEdge ? "text-green-400" : takeaway.weak7d ? "text-red-400" : "text-gray-400"
          }`}>
            {takeaway.lowN ? "⚠ Low sample" : takeaway.hasEdge ? "✓ Signal has edge" : takeaway.weak7d ? "✗ No consistent edge" : "~ Marginal signal"}
            {" · "}
            <span className="text-gray-500 normal-case font-normal">
              BB({window}, {k}σ) · {sym}
            </span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">English</p>
              <p className="text-gray-300">{takeaway.enSummary}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">中文</p>
              <p className="text-gray-300">{takeaway.zhSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 底部：升級 CTA ── */}
      <div className="flex items-center pt-5 mt-2 border-t border-gray-800 gap-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-green-400">Green</span>
          <span className="text-gray-500">= above threshold</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-yellow-400">⚠</span>
          <span className="text-gray-500">= n &lt; {LOW_SAMPLE_THRESHOLD}, interpret with caution</span>
        </div>
      </div>

    </div>
  );
}
