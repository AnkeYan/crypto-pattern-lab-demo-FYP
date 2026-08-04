"use client";

// HalvingPanel — Bitcoin Halving Cycle Analysis
// n=3 events — 顯示事件對照表，不顯示統計推論

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";

export type HalvingStatsRow = {
  halving_number: number | null;
  date: string;
  btc_price_at_halving: number | null;
  pre_30d_return: number | null;   pre_30d_available: boolean;
  pre_90d_return: number | null;   pre_90d_available: boolean;
  pre_180d_return: number | null;  pre_180d_available: boolean;
  post_30d_return: number | null;  post_30d_available: boolean;
  post_90d_return: number | null;  post_90d_available: boolean;
  post_180d_return: number | null; post_180d_available: boolean;
  post_365d_return: number | null; post_365d_available: boolean;
};

export type HalvingPathRow = {
  halving_number: number | null;
  date: string;
  day_offset: number | null;
  relative_price: number | null;
};

export type HalvingData = {
  stats: HalvingStatsRow[];
  path: HalvingPathRow[];
};

const HALVING_COLORS: Record<number, string> = {
  2: "#9ca3af",   // grey — data incomplete (starts mid-cycle)
  3: "#60a5fa",   // blue
  4: "#22c55e",   // green
};
const HALVING_LABELS: Record<number, string> = {
  2: "Halving #2 (2016) ⚠",
  3: "Halving #3 (2020)",
  4: "Halving #4 (2024)",
};

const PRE_WINDOWS  = [30, 90, 180] as const;
const POST_WINDOWS = [30, 90, 180, 365] as const;

function pct(v: number | null, d = 1): string {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
}
function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Build chart data: merge all 3 halvings into single time-offset axis
function buildChartData(path: HalvingPathRow[], rangeStart: number, rangeEnd: number) {
  const offsets = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => i + rangeStart);
  const halvings = [2, 3, 4];

  return offsets.map((offset) => {
    const point: Record<string, number | null> = { offset };
    for (const h of halvings) {
      const row = path.find((r) => r.halving_number === h && r.day_offset === offset);
      point[`h${h}`] = row?.relative_price ?? null;
    }
    return point;
  });
}

const RANGE_OPTIONS = [
  { label: "±30d",  start: -30,  end: 90  },
  { label: "±90d",  start: -90,  end: 180 },
  { label: "±180d", start: -180, end: 180 },
  { label: "Full",  start: -180, end: 365 },
];

export default function HalvingPanel({ data }: { data: HalvingData }) {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  const { stats, path } = data;
  const range = RANGE_OPTIONS[rangeIdx];
  const chartData = buildChartData(path, range.start, range.end);

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Bitcoin Halving Cycle</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            比特幣減半週期 · Price behaviour around each halving event · n=4 events, no statistics
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
              <p className="text-gray-300 mb-2">
                Each halving cuts Bitcoin&apos;s block reward in half. This panel shows BTC price performance <strong className="text-white">relative to the halving date (= 1.0)</strong> for each of the 4 halvings in our dataset.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                With only 4 events, <strong className="text-red-400">no statistical conclusions can be drawn</strong>. Each cycle operated in completely different macro environments (2016 bull run, 2020 pandemic recovery, 2024 ETF era). The table shows actual returns — not averages or predictions.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                每次減半將 BTC 區塊獎勵減半。本面板顯示各減半日前後的 BTC 價格走勢，<strong className="text-white">以減半當天 = 1.0 標準化</strong>。
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                只有 4 個事件，<strong className="text-red-400">無法進行任何統計推論</strong>。四個週期分別處於不同的宏觀環境（2016 牛市、2020 疫情復甦、2024 ETF 時代）。表格僅顯示實際回報，不代表規律或預測。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-1 items-center mt-4 mb-5">
        <span className="text-xs text-gray-500 mr-1">Range</span>
        {RANGE_OPTIONS.map((opt, i) => (
          <button key={i} onClick={() => setRangeIdx(i)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              rangeIdx === i
                ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                : "border-gray-700 text-gray-400 hover:border-gray-500"
            }`}>{opt.label}</button>
        ))}
      </div>

      {/* Price path chart */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-3">Relative BTC Price (Halving day = 1.0) · 相對價格走勢（減半當天 = 1.0）</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="offset" tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickFormatter={(v) => v === 0 ? "Halving" : `${v > 0 ? "+" : ""}${v}d`}
              interval={Math.floor((range.end - range.start) / 8)}
            />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }}
              tickFormatter={(v) => `${v.toFixed(1)}×`} />
            <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="4 2"
              label={{ value: "Halving", fill: "#6b7280", fontSize: 11, position: "top" }} />
            <ReferenceLine y={1} stroke="#374151" strokeWidth={1} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "13px" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: unknown, name: unknown) => {
                const v = Number(value);
                const h = parseInt(String(name ?? "").replace("h", ""));
                return [`${v.toFixed(3)}× (${((v - 1) * 100).toFixed(1)}%)`, HALVING_LABELS[h] ?? String(name)];
              }}
              labelFormatter={(v) => `Day ${Number(v) > 0 ? "+" : ""}${v} from halving`}
            />
            <Legend formatter={(value) => {
              const h = parseInt(value.replace("h", ""));
              return <span style={{ fontSize: 13, color: HALVING_COLORS[h] }}>{HALVING_LABELS[h]}</span>;
            }} />
            {[2, 3, 4].map((h) => (
              <Line key={h} type="monotone" dataKey={`h${h}`}
                stroke={HALVING_COLORS[h]} dot={false} strokeWidth={h === 4 ? 2 : 1.5}
                strokeOpacity={h === 2 ? 0.5 : 1}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Event comparison table */}
      <div>
        <p className="text-sm text-gray-400 mb-3">Return by Period — Each Event · 各事件各期間實際回報（不是統計平均）</p>
        <div className="overflow-x-auto">
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-gray-500 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-4 font-medium whitespace-nowrap">Event</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Halving Date</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Price</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Pre-30d</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Pre-90d</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Pre-180d</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Post-30d</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Post-90d</th>
                <th className="pb-2 pr-3 font-medium whitespace-nowrap">Post-180d</th>
                <th className="pb-2 font-medium whitespace-nowrap">Post-365d</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => {
                const h = row.halving_number ?? 0;
                return (
                  <tr key={h} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="py-2.5 pr-4">
                      <span style={{ color: HALVING_COLORS[h] }} className="font-semibold">
                        #{h}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-300 font-medium whitespace-nowrap">
                      {fmtPrice(row.btc_price_at_halving)}
                    </td>
                    {PRE_WINDOWS.map((w) => {
                      const ret   = row[`pre_${w}d_return` as keyof typeof row] as number | null;
                      const avail = row[`pre_${w}d_available` as keyof typeof row] as boolean;
                      return (
                        <td key={`pre${w}`} className="py-2.5 pr-3 whitespace-nowrap">
                          {!avail
                            ? <span className="text-gray-600 text-xs">no data</span>
                            : <span className={ret == null ? "text-gray-600" : ret >= 0 ? "text-green-400" : "text-red-400"}>
                                {pct(ret)}
                              </span>}
                        </td>
                      );
                    })}
                    {POST_WINDOWS.map((w) => {
                      const ret   = row[`post_${w}d_return` as keyof typeof row] as number | null;
                      const avail = row[`post_${w}d_available` as keyof typeof row] as boolean;
                      return (
                        <td key={`post${w}`} className="py-2.5 pr-3 whitespace-nowrap">
                          {!avail
                            ? <span className="text-yellow-400/70 text-xs">still ahead</span>
                            : <span className={ret == null ? "text-gray-600" : ret >= 0 ? "text-green-400" : "text-red-400"}>
                                {pct(ret)}
                              </span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Pre-Xd = return from X days before halving to halving day. Post-Xd = return from halving day to X days after.
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg">
        <p className="text-sm text-red-400/80 leading-relaxed">
          <span className="font-semibold">⚠ Critical limitation · 重要限制：</span>{" "}
          Only 4 halving events exist in our dataset. This is <strong>far too few for any statistical inference</strong> — no win rates, no averages, no confidence intervals are shown.
          Each cycle operated under completely different macro conditions. Treat this as a historical reference, not a pattern.
          本數據集只有 4 次減半事件，遠不足以做任何統計推論。不顯示勝率、平均值或信賴區間。每個週期的宏觀環境截然不同，請視為歷史參考，不代表規律。
        </p>
      </div>
    </div>
  );
}
