"use client";

// 這個檔案負責：月份季節性分析面板
// 呈現每個月份的歷史報酬分布（均值、中位數、勝率、樣本數、波動）
// 定位：歷史描述型研究模組，不是預測工具

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

export type MonthSeasonalityRow = {
  symbol: string;
  month: number | null;
  sample_size: number | null;
  mean_return: number | null;
  median_return: number | null;
  win_rate: number | null;
  best_return: number | null;
  worst_return: number | null;
  std_return: number | null;
};

const SYMBOLS = ["BTC", "ETH", "SOL"];

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_BAR_POSITIVE: Record<string, string> = {
  BTC: "#22c55e",
  ETH: "#60a5fa",
  SOL: "#facc15",
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LOW_SAMPLE_THRESHOLD = 7;

function pct(v: number | null, d = 1): string {
  if (v == null || isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(d)}%`;
}

function monthLabel(m: number): string {
  return MONTH_LABELS[m - 1] ?? String(m);
}

type SummaryCards = {
  bestMean: { month: number; value: number } | null;
  highestWR: { month: number; value: number } | null;
  weakestMean: { month: number; value: number } | null;
  highestVol: { month: number; value: number } | null;
};

function computeCards(rows: MonthSeasonalityRow[]): SummaryCards {
  if (rows.length === 0) {
    return { bestMean: null, highestWR: null, weakestMean: null, highestVol: null };
  }

  const valid = rows.filter((r) => r.month != null);

  const bestMean = valid.reduce(
    (best, r) => (r.mean_return != null && (best == null || r.mean_return > best.mean_return!)) ? r : best,
    null as MonthSeasonalityRow | null
  );
  const highestWR = valid.reduce(
    (best, r) => (r.win_rate != null && (best == null || r.win_rate > best.win_rate!)) ? r : best,
    null as MonthSeasonalityRow | null
  );
  const weakestMean = valid.reduce(
    (best, r) => (r.mean_return != null && (best == null || r.mean_return < best.mean_return!)) ? r : best,
    null as MonthSeasonalityRow | null
  );
  const highestVol = valid.reduce(
    (best, r) => (r.std_return != null && (best == null || r.std_return > best.std_return!)) ? r : best,
    null as MonthSeasonalityRow | null
  );

  return {
    bestMean: bestMean ? { month: bestMean.month!, value: bestMean.mean_return! } : null,
    highestWR: highestWR ? { month: highestWR.month!, value: highestWR.win_rate! } : null,
    weakestMean: weakestMean ? { month: weakestMean.month!, value: weakestMean.mean_return! } : null,
    highestVol: highestVol ? { month: highestVol.month!, value: highestVol.std_return! } : null,
  };
}

type Takeaway = {
  enSummary: string;
  zhSummary: string;
  hasEdge: boolean;
  weak: boolean;
  lowN: boolean;
};

function buildTakeaway(sym: string, rows: MonthSeasonalityRow[]): Takeaway | null {
  const currentMonth = new Date().getMonth() + 1; // 1–12
  const row = rows.find((r) => r.month === currentMonth);
  if (!row) return null;

  const n = row.sample_size ?? 0;
  const wr = row.win_rate;
  const median = row.median_return;
  const mLabel = MONTH_LABELS[currentMonth - 1];

  if (n < LOW_SAMPLE_THRESHOLD) {
    return {
      enSummary: `⚠ Too few data points for ${sym} in ${mLabel} (n=${n}) — not enough history to draw conclusions.`,
      zhSummary: `⚠ ${sym} 的 ${mLabel} 歷史樣本不足（n=${n}），無法得出可靠結論。`,
      hasEdge: false, weak: false, lowN: true,
    };
  }
  if (wr != null && median != null && wr >= 0.60 && median >= 0) {
    return {
      enSummary: `✓ Historically strong month — ${sym}'s ${mLabel} has a ${(wr * 100).toFixed(0)}% win rate and ${median >= 0 ? "+" : ""}${(median * 100).toFixed(1)}% median return (n=${n}). Seasonality favours bulls.`,
      zhSummary: `✓ 歷史強勢月份 — ${sym} 的 ${mLabel} 勝率 ${(wr * 100).toFixed(0)}%，中位數回報 ${median >= 0 ? "+" : ""}${(median * 100).toFixed(1)}%（n=${n}）。季節性偏多。`,
      hasEdge: true, weak: false, lowN: false,
    };
  }
  if ((wr != null && wr < 0.45) || (median != null && median < 0)) {
    return {
      enSummary: `✗ Historically weak month — ${sym}'s ${mLabel} has only a ${wr != null ? (wr * 100).toFixed(0) + "%" : "—"} win rate${median != null ? ` and ${(median * 100).toFixed(1)}% median return` : ""} (n=${n}). Seasonality is a headwind.`,
      zhSummary: `✗ 歷史弱勢月份 — ${sym} 的 ${mLabel} 勝率僅 ${wr != null ? (wr * 100).toFixed(0) + "%" : "—"}${median != null ? `，中位數回報 ${(median * 100).toFixed(1)}%` : ""}（n=${n}）。季節性偏空。`,
      hasEdge: false, weak: true, lowN: false,
    };
  }
  return {
    enSummary: `~ Mixed record — ${sym}'s ${mLabel} shows no strong seasonal tendency: ${wr != null ? (wr * 100).toFixed(0) + "%" : "—"} win rate, ${median != null ? (median >= 0 ? "+" : "") + (median * 100).toFixed(1) + "% median" : "—"} (n=${n}).`,
    zhSummary: `~ 歷史表現參差 — ${sym} 的 ${mLabel} 無明顯季節性傾向：勝率 ${wr != null ? (wr * 100).toFixed(0) + "%" : "—"}，中位數 ${median != null ? (median >= 0 ? "+" : "") + (median * 100).toFixed(1) + "%" : "—"}（n=${n}）。`,
    hasEdge: false, weak: false, lowN: false,
  };
}

export default function MonthSeasonalityPanel({ data }: { data: MonthSeasonalityRow[] }) {
  const [sym, setSym] = useState("BTC");
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;
  const rows = data
    .filter((r) => r.symbol === symKey)
    .sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
  const cards = computeCards(rows);
  const takeaway = buildTakeaway(sym, rows);

  const chartData = rows.map((r) => ({
    label: monthLabel(r.month ?? 0),
    mean_return: r.mean_return != null ? parseFloat((r.mean_return * 100).toFixed(2)) : null,
    sample_size: r.sample_size,
    median_return: r.median_return,
    win_rate: r.win_rate,
    best_return: r.best_return,
    worst_return: r.worst_return,
    std_return: r.std_return,
  }));

  const positiveColor = SYMBOL_BAR_POSITIVE[sym];

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Month Seasonality</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            月份季節性分析 · Historical monthly return distributions
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">What is this panel?</strong> For each calendar month (Jan–Dec), we collect every historical occurrence of that month and calculate the return. For example, October has 12 rows of data — one for each year from 2014 to 2025. This panel averages those rows to answer: <em className="text-gray-400">"Has October historically been a good month for BTC?"</em>
              </p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">What is Win Rate here?</strong> It&apos;s the percentage of years where that month closed <em>higher</em> than it opened. October&apos;s 75% Win Rate means: out of 12 Octobers in history, 9 of them ended up positive. It is <em>not</em> related to RSI or any signal — it simply asks "did this month go up or down?"
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">Mean vs Median</strong>: the mean (average) can be distorted by one extreme year — e.g., if BTC went up 200% in one October, the mean looks great even if most Octobers were flat. The median (middle value) is more representative of a typical outcome.<br />
                <strong className="text-gray-300">Sample size (n)</strong>: BTC only has data from 2014, so each month has at most 11–12 yearly observations. That&apos;s a small sample — treat this as historical context, not a reliable prediction.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">這個 panel 在做什麼？</strong> 把每個月份（1月–12月）歷史上每一年的表現收集起來，計算回報。例如 10 月有 12 筆數據——對應 2014 年至 2025 年每一個 10 月。這個 panel 把這些數據平均起來，回答一個問題：<em className="text-gray-400">「歷史上 10 月對 BTC 來說是好月份嗎？」</em>
              </p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">這裡的 Win Rate 是什麼？</strong> 是指該月份在歷史上「收漲」的年份比例。10 月 Win Rate 75% 的意思是：12 個歷史 10 月裡，有 9 個月份收盤比月初高。這跟 RSI 或任何信號無關——純粹就是問「這個月漲還是跌」。
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">均值 vs 中位數</strong>：均值容易被極端年份拉偏——如果某年 10 月暴漲 200%，均值就會很好看，但其實其他大部分年份都是平的。中位數（排序後的中間值）更能反映典型情況。<br />
                <strong className="text-gray-300">樣本數（n）</strong>：BTC 數據從 2014 年才有，所以每個月份最多只有 11–12 年的觀測值，樣本較少。這裡的結果是歷史描述，不代表今年必然重演。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-700 mt-4 mb-5">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Best Month</p>
          <p className="text-base font-bold text-green-400">
            {cards.bestMean ? monthLabel(cards.bestMean.month) : "—"}
          </p>
          <p className="text-xs text-green-300 mt-0.5">
            Mean {cards.bestMean ? pct(cards.bestMean.value) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">by mean return</p>
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Highest Win Rate</p>
          <p className="text-base font-bold text-cyan-400">
            {cards.highestWR ? monthLabel(cards.highestWR.month) : "—"}
          </p>
          <p className="text-xs text-cyan-300 mt-0.5">
            {cards.highestWR ? pct(cards.highestWR.value, 0) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">% months closed positive</p>
        </div>

        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Weakest Month</p>
          <p className="text-base font-bold text-red-400">
            {cards.weakestMean ? monthLabel(cards.weakestMean.month) : "—"}
          </p>
          <p className="text-xs text-red-300 mt-0.5">
            Mean {cards.weakestMean ? pct(cards.weakestMean.value) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">by mean return</p>
        </div>

        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Most Volatile</p>
          <p className="text-base font-bold text-yellow-400">
            {cards.highestVol ? monthLabel(cards.highestVol.month) : "—"}
          </p>
          <p className="text-xs text-yellow-300 mt-0.5">
            Std {cards.highestVol ? pct(cards.highestVol.value) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">by return std dev</p>
        </div>
      </div>

      {/* Key Takeaway */}
      {takeaway && (
        <div className={`mb-5 px-4 py-3 rounded-lg border text-sm leading-relaxed ${
          takeaway.lowN
            ? "border-yellow-500/30 bg-yellow-500/5"
            : takeaway.hasEdge
              ? "border-green-500/30 bg-green-500/5"
              : takeaway.weak
                ? "border-red-500/20 bg-red-500/5"
                : "border-gray-700 bg-white/[0.03]"
        }`}>
          <p className={`font-medium mb-1 ${
            takeaway.lowN ? "text-yellow-300" : takeaway.hasEdge ? "text-green-300" : takeaway.weak ? "text-red-300" : "text-gray-300"
          }`}>{takeaway.enSummary}</p>
          <p className="text-gray-500 text-sm">{takeaway.zhSummary}</p>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-3">Mean Monthly Return · 平均月報酬</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={0} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  minWidth: "200px",
                }}
                labelStyle={{ color: "#f9fafb", fontWeight: 600, marginBottom: "4px" }}
                formatter={(value, _name, props) => {
                  const r = props.payload;
                  return [
                    <span key="detail" className="block">
                      <span style={{ display: "block", color: "#6b7280" }}>n = {r.sample_size}</span>
                      <span style={{ display: "block", color: "#e5e7eb" }}>Mean: {pct((value as number) / 100)}</span>
                      <span style={{ display: "block", color: "#d1d5db" }}>Median: {pct(r.median_return)}</span>
                      <span style={{ display: "block", color: "#d1d5db" }}>Win Rate: {pct(r.win_rate, 0)}</span>
                      <span style={{ display: "block", color: "#4ade80" }}>Best: {pct(r.best_return)}</span>
                      <span style={{ display: "block", color: "#f87171" }}>Worst: {pct(r.worst_return)}</span>
                    </span>,
                    "",
                  ];
                }}
              />
              <Bar dataKey="mean_return" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.mean_return == null
                        ? "#374151"
                        : entry.mean_return >= 0
                          ? positiveColor
                          : "#f87171"
                    }
                    fillOpacity={(entry.sample_size ?? 0) < LOW_SAMPLE_THRESHOLD ? 0.45 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-1">
            Faded bar = n &lt; {LOW_SAMPLE_THRESHOLD} · Hover for full stats
          </p>
        </div>

        <div className="xl:w-[460px] flex-shrink-0 overflow-x-auto">
          <p className="text-xs text-gray-400 mb-3">Monthly Return Detail · 月份詳細統計</p>
          <table className="text-xs text-left border-collapse w-full">
            <thead className="text-gray-500 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Month</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">n</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Mean</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Median</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Win Rate</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Best</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Worst</th>
                <th className="pb-2 font-medium whitespace-nowrap">Std</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lowSample = (r.sample_size ?? 0) < LOW_SAMPLE_THRESHOLD;
                return (
                  <tr key={r.month} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="py-2.5 pr-3 text-gray-200 font-medium whitespace-nowrap">
                      {monthLabel(r.month ?? 0)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={lowSample ? "text-yellow-400" : "text-gray-400"}>
                        {r.sample_size ?? "—"}
                        {lowSample && <span className="ml-0.5 text-xs">⚠</span>}
                      </span>
                    </td>
                    <td className={`py-2.5 pr-3 font-medium whitespace-nowrap ${
                      r.mean_return == null ? "text-gray-600" : r.mean_return >= 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {pct(r.mean_return)}
                    </td>
                    <td className={`py-2.5 pr-3 whitespace-nowrap ${
                      r.median_return == null ? "text-gray-600" : r.median_return >= 0 ? "text-green-300" : "text-red-300"
                    }`}>
                      {pct(r.median_return)}
                    </td>
                    <td className={`py-2.5 pr-3 whitespace-nowrap ${
                      r.win_rate == null ? "text-gray-600" : r.win_rate >= 0.6 ? "text-green-400" : r.win_rate >= 0.5 ? "text-gray-300" : "text-red-400"
                    }`}>
                      {r.win_rate != null ? `${(r.win_rate * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-green-300/70 whitespace-nowrap">{pct(r.best_return)}</td>
                    <td className="py-2.5 pr-3 text-red-300/70 whitespace-nowrap">{pct(r.worst_return)}</td>
                    <td className="py-2.5 text-gray-400 whitespace-nowrap">{pct(r.std_return)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.some((r) => (r.sample_size ?? 0) < LOW_SAMPLE_THRESHOLD) && (
            <p className="text-yellow-400/70 text-xs mt-2 flex items-center gap-1">
              <span>⚠</span>
              <span>Rows with n &lt; {LOW_SAMPLE_THRESHOLD} have limited statistical reliability.</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-800 rounded-lg bg-gray-800/30 px-4 py-3 -mx-0">
        <p className="text-xs text-gray-400 leading-relaxed">
          <span className="text-yellow-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          Historical only — past monthly patterns do not guarantee future results. Each month has only 5–9 yearly observations; a single outlier year can significantly shift the mean. Always read mean alongside median and win rate. 季節性分析屬歷史描述，不構成交易預測。每個月份觀測值僅 5–9 年，均值易被少數極端月份主導，請搭配中位數與勝率一起閱讀。
        </p>
      </div>
    </div>
  );
}
