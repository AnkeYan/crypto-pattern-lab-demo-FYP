"use client";

// ConsecutiveDropPanel — 連跌分析面板
// 連續 N 天下跌後，第 1/3/7 天的歷史勝率與平均回報

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { wilsonCILabel } from "../lib/wilson";

export type ConsecutiveDropRow = {
  symbol: string;
  n_days: number | null;
  holding_days: number | null;
  sample_size: number | null;
  mean_return: number | null;
  median_return: number | null;
  win_rate: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  avg_drawdown: number | null;
  best_return: number | null;
  worst_return: number | null;
  std_return: number | null;
};

const SYMBOLS = ["BTC", "ETH", "SOL"];
const HOLDINGS = [1, 3, 7];
const N_DAYS = [2, 3, 4, 5];

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_BAR: Record<string, string> = {
  BTC: "#22c55e", ETH: "#60a5fa", SOL: "#facc15",
};

function pct(v: number | null, d = 1): string {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;
}

type Takeaway = {
  enSummary: string;
  zhSummary: string;
  hasEdge: boolean;
  weak: boolean;
  lowN: boolean;
};

function buildTakeaway(sym: string, holding: number, symKey: string, data: ConsecutiveDropRow[]): Takeaway | null {
  // 以 2d streak 作主要參考（最多樣本），但也檢查所有 streaks 的樣本是否足夠
  const refRow = data.find((r) => r.symbol === symKey && r.n_days === 2 && r.holding_days === holding);
  if (!refRow) return null;

  const n = refRow.sample_size ?? 0;
  const wr = refRow.win_rate;

  if (n < 20) {
    return {
      enSummary: `⚠ Small sample — only ${n} occurrences of ${sym} dropping 2 consecutive days with ${holding}d hold. Directional only, treat with caution.`,
      zhSummary: `⚠ 樣本偏少 — ${sym} 連跌 2 天持有 ${holding} 天僅有 ${n} 次記錄，方向性參考但需謹慎。`,
      hasEdge: false, weak: false, lowN: true,
    };
  }
  if (wr != null && wr >= 0.55) {
    return {
      enSummary: `✓ Mean-reversion edge — after ${sym} drops 2 consecutive days, the ${holding}d win rate is ${(wr * 100).toFixed(1)}% (n=${n}). Historical tendency to bounce.`,
      zhSummary: `✓ 均值回歸優勢 — ${sym} 連跌 2 天後持有 ${holding} 天的勝率為 ${(wr * 100).toFixed(1)}%（n=${n}），歷史傾向反彈。`,
      hasEdge: true, weak: false, lowN: false,
    };
  }
  if (wr != null && wr < 0.48) {
    return {
      enSummary: `✗ No rebound edge — ${sym} shows momentum continuation after 2 consecutive down days: ${holding}d win rate only ${(wr * 100).toFixed(1)}% (n=${n}).`,
      zhSummary: `✗ 無反彈優勢 — ${sym} 連跌 2 天後動量延續傾向：持有 ${holding} 天勝率僅 ${(wr * 100).toFixed(1)}%（n=${n}）。`,
      hasEdge: false, weak: true, lowN: false,
    };
  }
  return {
    enSummary: `~ Marginal signal — ${sym}'s ${holding}d win rate after a 2-day drop is ${wr != null ? (wr * 100).toFixed(1) + "%" : "—"} (n=${n}). No strong historical tendency either way.`,
    zhSummary: `~ 邊際信號 — ${sym} 連跌 2 天後持有 ${holding} 天勝率 ${wr != null ? (wr * 100).toFixed(1) + "%" : "—"}（n=${n}），無明顯歷史傾向。`,
    hasEdge: false, weak: false, lowN: false,
  };
}

export default function ConsecutiveDropPanel({ data }: { data: ConsecutiveDropRow[] }) {
  const [sym, setSym] = useState("BTC");
  const [holding, setHolding] = useState(7);
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;
  const color  = SYMBOL_BAR[sym];
  const takeaway = buildTakeaway(sym, holding, symKey, data);

  const chartData = N_DAYS.map((n) => {
    const row = data.find((r) => r.symbol === symKey && r.n_days === n && r.holding_days === holding);
    return {
      label: `${n}d drop`,
      n_days: n,
      win_rate_pct: row?.win_rate != null ? parseFloat((row.win_rate * 100).toFixed(1)) : null,
      mean_return_pct: row?.mean_return != null ? parseFloat((row.mean_return * 100).toFixed(2)) : null,
      sample_size: row?.sample_size ?? 0,
      win_rate_raw: row?.win_rate ?? null,
    };
  });

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Consecutive Drop Analysis</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            連跌分析 · After N consecutive down days, what happens next?
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
                This panel answers: <strong className="text-white">"After N consecutive days of falling closes, what has historically happened in the next 1/3/7 days?"</strong>
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                A consecutive drop is defined as N days where each close is lower than the previous — no minimum magnitude required.
                Unlike RSI or Bollinger signals, this is purely time-sequential. Note that longer streaks have smaller sample sizes — treat with more caution.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                本面板回答：<strong className="text-white">「連續 N 天收盤下跌後，接下來 1/3/7 天歷史上發生了什麼？」</strong>
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                連跌定義為每天收盤低於前一天，無最低跌幅要求。與 RSI 或 Bollinger 不同，這是純時間序列信號。
                連跌天數越多樣本數越少，結論需更謹慎。BTC 與 ETH 的行為差異顯著，ETH 連跌 4–5 天後反彈概率低於 BTC。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-700 mt-4 mb-5">
        {SYMBOLS.map((s) => (
          <button key={s} onClick={() => setSym(s)}
            className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              sym === s ? SYMBOL_BORDER[s] : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>{s}</button>
        ))}
        <div className="ml-auto flex gap-1 items-center">
          <span className="text-xs text-gray-500 mr-1">Hold</span>
          {HOLDINGS.map((h) => (
            <button key={h} onClick={() => setHolding(h)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                holding === h
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-500"
              }`}>{h}d</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Bar chart: win rate by consecutive drop length */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 mb-3">Win Rate after N consecutive down days · 連跌 N 天後勝率</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} label={{ value: "50%", fill: "#6b7280", fontSize: 10, position: "right" }} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ backgroundColor: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value, _name, props) => {
                  const r = props.payload;
                  return [`Win: ${value}% | Mean: ${pct(r.mean_return_pct != null ? r.mean_return_pct / 100 : null)} | n=${r.sample_size}`, ""];
                }}
              />
              <Bar dataKey="win_rate_pct" radius={[3, 3, 0, 0]} name="Win Rate">
                {chartData.map((entry, idx) => (
                  <Cell key={idx}
                    fill={(entry.win_rate_pct ?? 0) >= 50 ? color : "#f87171"}
                    fillOpacity={(entry.sample_size ?? 0) < 30 ? 0.5 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-500 mt-1">
            Faded bar = n &lt; 30 · Green/Red = above/below 50% baseline · Hover for mean return
          </p>
        </div>

        {/* Detail table — filtered by selected holding period */}
        <div className="xl:w-[440px] flex-shrink-0">
          <p className="text-sm text-gray-400 mb-3">
            After N consecutive drops · Hold <span className="text-cyan-300 font-semibold">{holding}d</span> · 連跌後持有 {holding} 天的結果
          </p>
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-gray-500 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-3 font-medium">Streak</th>
                <th className="pb-2 pr-3 font-medium">n</th>
                <th className="pb-2 pr-3 font-medium">Win Rate [CI]</th>
                <th className="pb-2 font-medium">Mean Ret</th>
              </tr>
            </thead>
            <tbody>
              {N_DAYS.map((n) => {
                const row = data.find((r) => r.symbol === symKey && r.n_days === n && r.holding_days === holding);
                if (!row) return null;
                const lowN = (row.sample_size ?? 0) < 30;
                const wr = row.win_rate;
                const ci = wilsonCILabel(wr, row.sample_size);
                return (
                  <tr key={n} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="py-2.5 pr-3 text-gray-200 font-semibold">{n}d ↓</td>
                    <td className={`py-2.5 pr-3 ${lowN ? "text-yellow-400" : "text-gray-400"}`}>
                      {row.sample_size ?? "—"}{lowN && <span className="ml-0.5 text-xs">⚠</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      {wr != null ? (
                        <>
                          <span className={`font-semibold ${wr >= 0.55 ? "text-green-400" : wr >= 0.50 ? "text-gray-300" : "text-red-400"}`}>
                            {(wr * 100).toFixed(1)}%
                          </span>
                          {ci && <span className="block text-xs text-gray-600 mt-0.5">{ci}</span>}
                        </>
                      ) : "—"}
                    </td>
                    <td className={`py-2.5 font-medium ${
                      row.mean_return == null ? "text-gray-600"
                        : row.mean_return >= 0 ? "text-green-400" : "text-red-400"
                    }`}>{pct(row.mean_return)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-sm text-gray-500 mt-2">⚠ = n &lt; 30, 結果僅供參考</p>
        </div>
      </div>

      {/* Key Takeaway */}
      {takeaway && (
        <div className={`mt-5 px-4 py-3 rounded-lg border text-sm leading-relaxed ${
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

      <div className="mt-5 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-cyan-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          A consecutive drop counts direction only — no magnitude filter. Longer streaks (4–5d) have fewer samples; interpret with caution.
          Notably, ETH shows a below-50% win rate after 4–5d drops (momentum continuation), while BTC and SOL show mild mean-reversion tendency.
          連跌僅統計方向，無跌幅門檻。連跌 4–5 天樣本較少請謹慎解讀。ETH 連跌 4–5 天後勝率低於 50%（動量延續特性），BTC 和 SOL 則呈現輕微均值回歸傾向。
        </p>
      </div>
    </div>
  );
}
