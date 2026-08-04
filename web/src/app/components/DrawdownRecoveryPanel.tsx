"use client";

// DrawdownRecoveryPanel — 回撤恢復分析面板
// 價格從滾動高點下跌 X% 後，歷史上需要幾天回到前高（90天內）

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ErrorBar } from "recharts";

export type DrawdownRecoveryRow = {
  symbol: string;
  threshold: number | null;
  n_events: number | null;
  recovered_count: number | null;
  dnr_count: number | null;
  recovery_rate: number | null;
  median_days: number | null;
  mean_days: number | null;
  p25_days: number | null;
  p75_days: number | null;
  max_days: number | null;
};

const SYMBOLS = ["BTC", "ETH", "SOL"];
const THRESHOLDS = [-0.05, -0.10, -0.15, -0.20];
const THR_LABELS: Record<string, string> = {
  "-0.05": "−5%", "-0.1": "−10%", "-0.15": "−15%", "-0.2": "−20%",
};

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_BAR: Record<string, string> = {
  BTC: "#22c55e", ETH: "#60a5fa", SOL: "#facc15",
};

function thrLabel(v: number | null): string {
  if (v == null) return "—";
  return THR_LABELS[String(v)] ?? `${(v * 100).toFixed(0)}%`;
}

function days(v: number | null): string {
  if (v == null || isNaN(v)) return "—";
  return `${v.toFixed(0)}d`;
}

export default function DrawdownRecoveryPanel({ data }: { data: DrawdownRecoveryRow[] }) {
  const [sym, setSym] = useState("BTC");
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;
  const color  = SYMBOL_BAR[sym];

  const rows = THRESHOLDS.map((thr) =>
    data.find((r) => r.symbol === symKey && r.threshold === thr) ?? null
  );

  const chartData = rows.map((row, i) => ({
    label: thrLabel(THRESHOLDS[i]),
    median: row?.median_days ?? null,
    p25: row?.p25_days ?? null,
    p75: row?.p75_days ?? null,
    recovery_rate: row?.recovery_rate != null ? parseFloat((row.recovery_rate * 100).toFixed(1)) : null,
    n_events: row?.n_events ?? 0,
    recovered: row?.recovered_count ?? 0,
    dnr: row?.dnr_count ?? 0,
  }));

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Drawdown Recovery Analysis</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            回撤恢復分析 · After X% drawdown from 60d high, how long to recover? (90d window)
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
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed space-y-4">

          {/* 核心問題 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em className="text-gray-200">After BTC drops 10% from its recent peak — how fast does it historically bounce back?</em>
              </p>
              <p className="text-gray-400 leading-relaxed">
                This panel scans history for every time a coin fell at least X% from its <strong className="text-white">60-day rolling high</strong> (the highest price in the past 60 days).
                It then asks: did the price return to that prior peak within 90 days? If yes, how many days did it take?
              </p>
              <p className="text-gray-400 leading-relaxed mt-2">
                Think of it as a <strong className="text-white">bounce-back speed test</strong> — not a guarantee. A 44% recovery rate means: in 44% of historical cases, the price did recover within 90 days. The other 56% either took longer, or didn&apos;t recover at all during a bear market.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em className="text-gray-200">BTC 從近期高點跌了 10% 後，歷史上多快能反彈回來？</em>
              </p>
              <p className="text-gray-400 leading-relaxed">
                這個 panel 掃描歷史，找出每一次幣價從 <strong className="text-white">60 天滾動高點</strong>（過去 60 天的最高價）下跌至少 X% 的事件，然後問：價格在 90 天內回到了那個高點嗎？如果有，花了幾天？
              </p>
              <p className="text-gray-400 leading-relaxed mt-2">
                把它想成一個<strong className="text-white">反彈速度測試</strong>，不是保證。44% 恢復率的意思是：歷史上有 44% 的下跌事件在 90 天內回到了前高。另外 56% 要嘛花更長時間，要嘛在熊市期間根本沒回來。
              </p>
            </div>
          </div>

          {/* 名詞解釋折疊 */}
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Term glossary · 名詞解釋</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm leading-relaxed">
              <div><span className="text-white font-medium">Drawdown −X%</span><span className="text-gray-400"> — Price fell at least X% from the 60-day rolling high. −5% means a 5% dip; −20% is a major crash. | 從過去 60 天最高價下跌至少 X%。</span></div>
              <div><span className="text-white font-medium">60-day rolling high</span><span className="text-gray-400"> — The highest closing price in the past 60 days. Used as the "peak" baseline for each event. | 過去 60 天的最高收盤價，作為每次事件的「前高」基準。</span></div>
              <div><span className="text-white font-medium">Events</span><span className="text-gray-400"> — Number of distinct drawdown episodes found. A 14-day minimum gap prevents the same drop being counted twice. | 找到的獨立回撤事件數，間距至少 14 天避免重複計算。</span></div>
              <div><span className="text-white font-medium">Recovery Rate</span><span className="text-gray-400"> — % of events where price returned to the prior peak within 90 days. Not a prediction — a historical frequency. | 90 天內回到前高的事件比例，是歷史頻率而非保證。</span></div>
              <div><span className="text-white font-medium">Median Days</span><span className="text-gray-400"> — For events that did recover, the middle value of recovery time. Half took less, half took more. Ignores DNR events. | 有恢復事件的中位天數，一半更快、一半更慢，不含 DNR 事件。</span></div>
              <div><span className="text-white font-medium">P25–P75</span><span className="text-gray-400"> — The middle 50% range of recovery days. e.g. 16d–54d means 50% of recoveries happened between day 16 and day 54. | 恢復天數的中間 50% 範圍，例如 16d–54d 代表有一半的恢復落在第 16 至 54 天之間。</span></div>
              <div><span className="text-white font-medium">DNR (Did Not Recover)</span><span className="text-gray-400"> — The number of events (not a %) where price did not return to prior peak within 90 days. e.g. DNR 124 out of 255 events = 49% took longer than 90 days. Many eventually did recover — just slower. | 顯示的是事件「次數」，不是百分比。例如 255 次事件中 DNR 124，代表有 124 次在 90 天內未回到前高（不等於永遠回不來，很多只是更慢）。</span></div>
              <div><span className="text-white font-medium">90-day cap</span><span className="text-gray-400"> — The observation window. Chosen to balance sample size vs. relevance. Bear markets can extend well beyond 90 days. | 觀察窗口設為 90 天，熊市可能遠超此範圍。</span></div>
            </div>
          </div>

          <p className="text-xs text-yellow-400/80 border-t border-white/[0.05] pt-3">
            ⚠ This measures <strong>recovery speed</strong>, not certainty. DNR events often recovered eventually — just outside the 90-day window. During sustained bear markets, even −5% drawdowns can take 6–12+ months to recover.
            本指標衡量恢復速度，不代表最終結果。熊市期間即使 −5% 的回撤也可能需要 6–12 個月以上才能回到前高。
          </p>
        </div>
      )}

      {/* Symbol tabs */}
      <div className="flex gap-1 border-b border-gray-700 mt-4 mb-5">
        {SYMBOLS.map((s) => (
          <button key={s} onClick={() => setSym(s)}
            className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              sym === s ? SYMBOL_BORDER[s] : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>{s}</button>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Chart: median recovery days */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 mb-3">Median Recovery Days by Drawdown Depth · 各回撤深度的中位恢復天數</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}d`} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value, _name, props) => {
                  const r = props.payload;
                  if (r.median == null) return ["—", ""];
                  return [
                    `Median: ${r.median}d | P25: ${r.p25 ?? "—"}d | P75: ${r.p75 ?? "—"}d\nRecovery rate: ${r.recovery_rate ?? "—"}% (${r.recovered}/${r.n_events})`,
                    "",
                  ];
                }}
              />
              <Bar dataKey="median" name="Median Recovery Days" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={color} fillOpacity={entry.median != null ? 1 : 0.2} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-500 mt-1">Hover for P25/P75 range and recovery rate · 僅統計 90 天內有恢復的事件</p>
        </div>

        {/* Detail table */}
        <div className="xl:w-[460px] flex-shrink-0">
          <p className="text-sm text-gray-400 mb-3">Recovery Statistics by Drawdown Threshold · 回撤恢復詳細統計</p>
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-gray-500 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-3 font-medium">Drawdown</th>
                <th className="pb-2 pr-3 font-medium">Events</th>
                <th className="pb-2 pr-3 font-medium">Recovery Rate</th>
                <th className="pb-2 pr-3 font-medium">Median</th>
                <th className="pb-2 pr-3 font-medium">P25–P75</th>
                <th className="pb-2 font-medium">DNR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                if (!row) return null;
                const rr = row.recovery_rate;
                return (
                  <tr key={i} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="py-2.5 pr-3 font-semibold text-gray-200">{thrLabel(row.threshold)}</td>
                    <td className="py-2.5 pr-3 text-gray-400">{row.n_events ?? "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`font-semibold ${
                        rr == null ? "text-gray-600"
                          : rr >= 0.5 ? "text-green-400" : rr >= 0.3 ? "text-yellow-400" : "text-red-400"
                      }`}>
                        {rr != null ? `${(rr * 100).toFixed(0)}%` : "—"}
                      </span>
                      <span className="text-gray-600 ml-1 text-xs">
                        ({row.recovered_count ?? "—"}/{row.n_events ?? "—"})
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-300 font-medium">{days(row.median_days)}</td>
                    <td className="py-2.5 pr-3 text-gray-500">
                      {row.p25_days != null && row.p75_days != null
                        ? `${days(row.p25_days)}–${days(row.p75_days)}`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-red-400/70">{row.dnr_count ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-sm text-gray-500 mt-2">
            DNR = Did Not Recover within 90 days · Recovery rate does not mean &quot;will always recover&quot;
          </p>
        </div>
      </div>

      {/* 動態 Key Takeaway */}
      {(() => {
        const row10 = rows[1]; // −10% threshold
        const row20 = rows[3]; // −20% threshold
        if (!row10) return null;
        const rr = row10.recovery_rate ?? 0;
        const med = row10.median_days;
        const dnr = row10.dnr_count ?? 0;
        const n   = row10.n_events ?? 0;
        const hasEdge = rr >= 0.5;
        const lowN    = n < 20;
        const borderCls = lowN
          ? "border-yellow-500/30 bg-yellow-500/5"
          : hasEdge
          ? "border-green-500/30 bg-green-500/5"
          : "border-red-500/20 bg-red-500/5";
        const icon = lowN ? "⚠" : hasEdge ? "✓" : "✗";
        const iconCls = lowN ? "text-yellow-400" : hasEdge ? "text-green-400" : "text-red-400";
        const rr20 = row20?.recovery_rate;
        return (
          <div className={`mt-5 rounded-lg border px-4 py-3 ${borderCls}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Takeaway · 數據解讀</p>
            <p className="text-sm text-gray-200 leading-relaxed">
              <span className={`font-bold mr-1 ${iconCls}`}>{icon}</span>
              {lowN
                ? `Only ${n} historical −10% drawdown events found for ${sym} — sample too small for strong conclusions.`
                : hasEdge
                ? `${sym} has historically recovered from −10% drawdowns within 90 days in ${(rr * 100).toFixed(0)}% of cases${med != null ? `, with a median recovery time of ${med.toFixed(0)} days` : ""}. ${dnr} events did not recover within 90 days.`
                : `${sym}'s −10% drawdown recovery rate is only ${(rr * 100).toFixed(0)}% within 90 days — recovery is not the historical norm at this depth.`
              }
              {rr20 != null && ` Deeper −20% drawdowns recovered ${(rr20 * 100).toFixed(0)}% of the time — ${rr20 >= 0.4 ? "still meaningful, but significantly slower" : "rarely recovered within 90 days"}.`}
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">
              {lowN
                ? `${sym} 歷史上只找到 ${n} 次 −10% 回撤事件，樣本太少，結論參考價值有限。`
                : hasEdge
                ? `${sym} 歷史上從 −10% 回撤中，有 ${(rr * 100).toFixed(0)}% 的機率在 90 天內回到前高${med != null ? `，中位恢復時間為 ${med.toFixed(0)} 天` : ""}。有 ${dnr} 次未能在 90 天內恢復。`
                : `${sym} 的 −10% 回撤 90 天恢復率只有 ${(rr * 100).toFixed(0)}%，歷史上這個深度的回撤大多數沒有快速反彈。`
              }
              {rr20 != null && ` 更深的 −20% 回撤恢復率為 ${(rr20 * 100).toFixed(0)}%——${rr20 >= 0.4 ? "仍有意義，但速度明顯更慢" : "90 天內幾乎難以回到前高"}。`}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
