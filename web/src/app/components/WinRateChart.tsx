

// 這個檔案負責：把 Win Rate 數據轉成分組 Bar Chart，按幣種區分顏色


"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend
} from "recharts";

type PatternResult = {
  symbol: string;
  threshold: number;
  holding_days: number;
  win_rate: number;
};

const COLORS = {
  BTCUSDT: "#22c55e",
  ETHUSDT: "#60a5fa",
  SOLUSDT: "#facc15",
};

const THRESHOLDS = [-0.03, -0.05, -0.07];
const THRESHOLD_LABELS: Record<string, string> = {
  "-0.03": "Threshold -3%",
  "-0.05": "Threshold -5%",
  "-0.07": "Threshold -7%",
};

export default function WinRateChart({ data }: { data: PatternResult[] }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-lg font-semibold">Win Rate by Drop Threshold</h2>
          <p className="text-gray-500 text-sm mt-0.5">跌幅觸發後各持倉天數的歷史勝率</p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {/* ── 說明框 ── */}
      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                This chart shows the historical <strong className="text-white">Win Rate</strong> after BTC / ETH / SOL dropped more than a set threshold in a single day.
                Win Rate = % of cases where price was <strong className="text-white">higher</strong> after 1 / 3 / 7 days.
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">Threshold</strong>: the minimum single-day drop to trigger the pattern (e.g. −5% means the asset fell ≥ 5% that day).{" "}
                <strong className="text-gray-300">Dashed line at 55%</strong>: a common benchmark — above this suggests a historically positive bias worth noting.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                這張圖顯示當 BTC / ETH / SOL 單日跌幅超過設定門檻後，持有 1 / 3 / 7 天的歷史<strong className="text-white">勝率</strong>。
                勝率 = 買入後第 N 天收盤價高於買入價的比例。
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">門檻（Threshold）</strong>：觸發條件，例如 −5% 代表當天跌幅 ≥ 5%。
                <strong className="text-gray-300">虛線 55%</strong>：參考基準線，高於此線代表歷史上存在正向偏向，值得關注。
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-600 text-xs mb-6">Dashed line = 55% reference threshold</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {THRESHOLDS.map((threshold) => {
          const filtered = data.filter((r) => r.threshold === threshold);
          const chartData = [1, 3, 7].map((days) => {
            const row: Record<string, number | string> = { days: `${days}d` };
            ["BTCUSDT", "ETHUSDT", "SOLUSDT"].forEach((symbol) => {
              const match = filtered.find(
                (r) => r.symbol === symbol && r.holding_days === days
              );
              row[symbol] = match ? parseFloat((match.win_rate * 100).toFixed(1)) : 0;
            });
            return row;
          });

          return (
            <div key={threshold}>
              <p className="text-gray-400 text-sm text-center mb-2">
                {THRESHOLD_LABELS[String(threshold) as keyof typeof THRESHOLD_LABELS]}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="days" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis domain={[40, 90]} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, ""]}
                    contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                    labelStyle={{ color: "#f9fafb" }}
                  />
                  <ReferenceLine y={55} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.4} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v.replace("USDT", "")} />
                  <Bar dataKey="BTCUSDT" fill={COLORS.BTCUSDT} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ETHUSDT" fill={COLORS.ETHUSDT} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="SOLUSDT" fill={COLORS.SOLUSDT} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}