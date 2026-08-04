"use client";

// 這個檔案負責：完整表格（5免費欄 + 7 Pro欄）+ Win Rate Chart + 模糊遮罩 + fixed tooltip（中英文）

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { wilsonCILabel } from "../lib/wilson";
import { useTier, hasAccess } from "../lib/useTier";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer, Legend
} from "recharts";

type PatternResult = {
  symbol: string;
  threshold: number;
  holding_days: number;
  sample_size: number;
  mean_return: number;
  median_return: number;
  win_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  skewness: number;
  kurtosis: number;
  max_drawdown: number;
  avg_drawdown: number;
};

// ── 欄位說明資料（中英文雙語）────────────────────────────────────────────────
const COL_INFO: Record<string, {
  label: string; zh: string;
  en: string; en_interpret: string;
  zh_explain: string; zh_interpret: string;
}> = {
  threshold: {
    label: "Threshold", zh: "觸發門檻",
    en: "The minimum single-day price drop required to trigger a buy signal.",
    en_interpret: "-3% means: only enter a trade after the asset drops 3% or more in one day. A larger threshold (e.g. -7%) captures rarer but more extreme drop events — fewer samples, but potentially stronger signals.",
    zh_explain: "觸發買入訊號所需的單日最低跌幅。",
    zh_interpret: "-3% 代表：只有當資產單日下跌 3% 或以上，才視為符合條件的入場訊號。門檻越大（如 -7%），代表事件越罕見，樣本數越少，但每次信號可能更具意義。",
  },
  hold: {
    label: "Holding Period", zh: "持有期",
    en: "How many days you hold the position after entering the trade.",
    en_interpret: "1d = exit the next trading day. 3d / 7d = hold longer. Longer holding periods reduce noise from daily fluctuations but increase your exposure to broader market moves.",
    zh_explain: "入場後持有倉位的天數。",
    zh_interpret: "1d = 次日收市平倉。3d / 7d = 持有更長。持有期越長，能過濾短期雜訊，但同時增加對大市整體波動的暴露風險。",
  },
  samples: {
    label: "Samples", zh: "樣本數量",
    en: "Number of historical events that matched this pattern. BTC/ETH data goes back to Aug 2017 (~3,200 days); SOL to Sep 2020 (~2,100 days).",
    en_interpret: "More samples = more statistically reliable results. Fewer than 30 samples should be treated with caution — the pattern may have worked by chance, not by design.",
    zh_explain: "符合此模式的歷史事件次數。BTC/ETH 數據從 2017年8月起（約3,200天）；SOL 從 2020年9月起（約2,100天）。",
    zh_interpret: "樣本越多，統計結果越可靠。少於 30 個樣本的結果需謹慎解讀——可能只是偶然巧合，而非可重複的規律。",
  },
  mean_return: {
    label: "Mean Return", zh: "平均回報率",
    en: "The average return across all trades triggered by this pattern.",
    en_interpret: "Positive = profitable on average. Always read alongside Win Rate: a high Mean Return with low Win Rate means a few big wins offset many small losses (high variance strategy).",
    zh_explain: "所有符合此模式的交易的平均回報率。",
    zh_interpret: "正數 = 平均來說有利可圖。必須結合勝率一起看：高平均回報配低勝率，代表策略依賴少數幾次大贏來彌補多次小輸，風險較高。",
  },
  win_rate: {
    label: "Win Rate", zh: "勝率",
    en: "The percentage of trades that ended with a positive return (return > 0).",
    en_interpret: "50% = no statistical edge (coin flip). ≥55% suggests a real pattern. A high Win Rate with negative Mean Return means many small wins and occasional large losses — still a losing strategy.",
    zh_explain: "所有交易中，最終錄得正回報（回報率 > 0）的比例。",
    zh_interpret: "50% = 沒有統計優勢（等同擲硬幣）。≥55% 才代表有可能存在真實規律。高勝率配負平均回報，代表多次小贏但偶爾出現大損，整體仍是虧損策略。",
  },
  median_return: {
    label: "Median Return", zh: "中位數回報",
    en: "The middle value of all trade returns — half of trades returned more, half returned less.",
    en_interpret: "More robust than Mean Return because it is not distorted by extreme outliers. If Median is much lower than Mean, a few large wins are inflating the average — the typical trade may be less impressive.",
    zh_explain: "所有交易回報的中間值——一半交易回報高於此值，一半低於此值。",
    zh_interpret: "比平均回報更穩健，因為不受極端值影響。若中位數遠低於平均值，代表少數幾次大贏拉高了平均，典型交易的實際表現可能並不亮眼。",
  },
  sharpe_ratio: {
    label: "Sharpe Ratio", zh: "夏普比率",
    en: "Return per unit of total risk (standard deviation). Measures whether the returns justify the volatility.",
    en_interpret: ">1.0 is generally considered good. >2.0 is excellent. A high Sharpe means you are getting meaningful returns without taking excessive risk. Compare with Sortino: if Sortino >> Sharpe, the volatility is mostly upside (good).",
    zh_explain: "每承擔一單位總風險（標準差）所獲得的回報。衡量回報是否值得承擔波動風險。",
    zh_interpret: ">1.0 通常視為良好，>2.0 為優秀。高夏普比率代表在不承擔過大風險的情況下獲得可觀回報。與 Sortino 比較：若 Sortino 遠高於 Sharpe，代表波動主要來自上漲（正面訊號）。",
  },
  sortino_ratio: {
    label: "Sortino Ratio", zh: "索提諾比率",
    en: "Like Sharpe, but only penalises downside volatility (losses), not upside volatility (gains).",
    en_interpret: "A better measure for asymmetric strategies. If Sortino > Sharpe, it means volatility is skewed upward — the big moves are mostly wins, not losses. Prefer Sortino when evaluating strategies with irregular but positive outliers.",
    zh_explain: "類似夏普比率，但只懲罰下行波動（虧損），不懲罰上行波動（獲利）。",
    zh_interpret: "對不對稱策略更合適的衡量指標。若 Sortino > Sharpe，代表波動偏向上行——大幅波動主要來自盈利而非虧損。評估有正向異常值的策略時，優先參考 Sortino。",
  },
  skewness: {
    label: "Skewness", zh: "偏度",
    en: "Measures the asymmetry of the return distribution. Positive = more frequent small losses but occasional large gains. Negative = more frequent small gains but occasional large losses.",
    en_interpret: "Positive skewness is generally preferred — you lose small often but win big occasionally. Most crypto patterns show positive skew after large drops. Negative skew strategies (many small wins, rare large losses) are dangerous because the losses can wipe out months of gains.",
    zh_explain: "衡量回報分布的不對稱性。正偏 = 多次小虧但偶有大贏；負偏 = 多次小贏但偶有大虧。",
    zh_interpret: "正偏度通常更受歡迎——頻繁小虧但偶爾大贏。大跌後的加密貨幣模式通常呈正偏。負偏策略（多次小贏，偶爾大虧）很危險，一次大損可能抹去數月的積累。",
  },
  kurtosis: {
    label: "Kurtosis", zh: "峰度",
    en: "Measures the 'fat-tailedness' of the return distribution. High kurtosis = extreme events (very large gains or losses) occur more often than a normal distribution would predict.",
    en_interpret: "Crypto returns typically have high kurtosis (fat tails). In practice: high kurtosis means your risk models may underestimate the probability of extreme moves. Use alongside Max Drawdown to understand tail risk.",
    zh_explain: "衡量回報分布的「厚尾」程度。高峰度 = 極端事件（極大漲跌）出現的頻率高於正態分布的預測。",
    zh_interpret: "加密貨幣回報通常具有高峰度（厚尾）。實際含義：高峰度代表風險模型可能低估極端行情的概率。應結合最大回撤一起理解尾部風險。",
  },
  max_drawdown: {
    label: "Max Drawdown", zh: "最大回撤",
    en: "The largest peak-to-trough loss observed across all trades in this pattern — the worst single trade outcome.",
    en_interpret: "Critical for position sizing. Even a strategy with 65% win rate can have a -40% max drawdown — you must survive that loss to capture the long-term edge. Always ask: can I psychologically and financially handle this worst case?",
    zh_explain: "此模式所有交易中觀察到的最大單筆虧損——即最差的一次交易結果。",
    zh_interpret: "對倉位管理至關重要。即使是勝率 65% 的策略，也可能出現 -40% 的最大回撤——你必須能承受這次損失才能獲取長期優勢。始終要問：我能在心理和資金上承受這個最壞情況嗎？",
  },
  avg_drawdown: {
    label: "Avg Drawdown", zh: "平均回撤",
    en: "The average loss across all losing trades in this pattern.",
    en_interpret: "More representative of the typical downside than Max Drawdown. If Avg Drawdown is small but Max Drawdown is large, most trades are manageable but a rare extreme event dominates the risk profile.",
    zh_explain: "此模式所有虧損交易的平均損失幅度。",
    zh_interpret: "比最大回撤更能代表典型的下行風險。若平均回撤小但最大回撤大，代表大多數交易可控，但少數極端事件主導了整體風險。",
  },
};

// ── Pro 欄位定義 ──────────────────────────────────────────────────────────────
const PRO_COLS = [
  { key: "median_return", label: "Median Return", zh: "中位數回報" },
  { key: "sharpe_ratio",  label: "Sharpe Ratio",  zh: "夏普比率" },
  { key: "sortino_ratio", label: "Sortino Ratio", zh: "索提諾比率" },
  { key: "skewness",      label: "Skewness",      zh: "偏度" },
  { key: "kurtosis",      label: "Kurtosis",      zh: "峰度" },
  { key: "max_drawdown",  label: "Max Drawdown",  zh: "最大回撤" },
  { key: "avg_drawdown",  label: "Avg Drawdown",  zh: "平均回撤" },
];

// ── 幣種設定 ──────────────────────────────────────────────────────────────────
const SYMBOLS = ["BTC", "ETH", "SOL"];
const SYMBOL_ACTIVE_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};

// ── Chart 設定 ────────────────────────────────────────────────────────────────
const CHART_COLORS = { BTCUSDT: "#22c55e", ETHUSDT: "#60a5fa", SOLUSDT: "#facc15" };
const THRESHOLDS = [-0.03, -0.05, -0.07];
const THRESHOLD_LABELS: Record<string, string> = {
  "-0.03": "Threshold −3%",
  "-0.05": "Threshold −5%",
  "-0.07": "Threshold −7%",
};

type TooltipState = { key: string; x: number; y: number } | null;

const FREE_COL_W = 100;
const PRO_COL_W  = 110;

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function ResultsTable({ data }: { data: PatternResult[] }) {
  const userTier      = useTier();
  const isProUnlocked = hasAccess(userTier, "pro");
  const searchParams  = useSearchParams();
  const symbolFromUrl = searchParams.get("symbol")?.toUpperCase();
  const initialTab = SYMBOLS.includes(symbolFromUrl ?? "") ? symbolFromUrl! : "BTC";

  const [activeTab, setActiveTab]   = useState(initialTab);
  const [view, setView]             = useState<"table" | "chart">("table");
  const [showInfo, setShowInfo]     = useState(false);
  const [tooltip, setTooltip]       = useState<TooltipState>(null);
  const tableWrapRef                = useRef<HTMLDivElement>(null);

  const filtered = data.filter((r) => r.symbol === `${activeTab}USDT`);

  function showTooltip(key: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const tooltipWidth = Math.min(620, window.innerWidth * 0.90);
    const x = rect.left + tooltipWidth > window.innerWidth - 16
      ? Math.max(8, window.innerWidth - tooltipWidth - 16)
      : rect.left;
    setTooltip({ key, x, y: rect.bottom + 8 });
  }
  function hideTooltip() { setTooltip(null); }

  const tooltipInfo = tooltip ? COL_INFO[tooltip.key] : null;

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug">Pattern Analysis<br className="sm:hidden" /> Results</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {view === "table"
              ? <>Hover over <span className="text-gray-300">ⓘ</span> next to any column header to see a full explanation.</>
              : "Win Rate comparison across all 3 thresholds · BTC / ETH / SOL · Dashed line = 55%"}
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0 mt-0.5"
        >
          {showInfo ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {/* ── 說明框 ── */}
      {showInfo && (
        <div className="mt-3 mb-4 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">Table view</strong>: detailed statistics for one coin — Threshold, Holding Period, Samples, Mean Return, Win Rate, and Pro metrics (Sharpe, Sortino, Drawdown etc.).
              </p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">Chart view</strong>: Win Rate comparison across BTC / ETH / SOL for each threshold and holding period. Win Rate = % of cases where price was higher after N days.
                Dashed line at 55% is a common statistical significance benchmark.
              </p>
              <p className="text-gray-300">
                <strong className="text-white">[51%–61%] below Win Rate</strong>: Wilson 95% Confidence Interval — the range where the true win rate likely falls given the sample size.
                A narrow range (e.g. ±3%) means the estimate is reliable. A wide range (e.g. ±20%) means too few samples to trust the number.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">表格模式</strong>：單一幣種的詳細統計數據——門檻、持倉天數、樣本數、平均回報、勝率，以及 Pro 指標（夏普、索提諾、回撤等）。
              </p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">圖表模式</strong>：三幣種在各跌幅門檻和持倉天數下的勝率對比。勝率 = 買入後第 N 天收盤價高於買入價的比例。虛線 55% 為統計顯著性參考基準。
              </p>
              <p className="text-gray-300">
                <strong className="text-white">勝率下方的灰色 [51%–61%]</strong>：威爾遜 95% 置信區間——基於樣本數量，真實勝率有 95% 機率落在此範圍內。
                區間越窄（如 ±3%）代表估計越可靠；區間越寬（如 ±20%）代表樣本太少，數字參考價值有限。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab + View Toggle ── */}
      <div className="mt-4 mb-5">
        {/* 第一行：幣種 Tab + Table/Chart toggle（桌面同行，手機同行但 toggle 靠右） */}
        <div className="flex items-center justify-between border-b border-gray-700">
          {/* 幣種 Tab（Chart 模式下變灰） */}
          <div className={`flex gap-1 ${view === "chart" ? "opacity-40 pointer-events-none" : ""}`}>
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                onClick={() => setActiveTab(sym)}
                className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  activeTab === sym
                    ? SYMBOL_ACTIVE_BORDER[sym]
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {sym}
              </button>
            ))}
          </div>

          {/* Table / Chart toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 flex-shrink-0 mb-1">
            <button
              onClick={() => setView("table")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                view === "table" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              📋 Table
            </button>
            <button
              onClick={() => setView("chart")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                view === "chart" ? "bg-gray-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              📊 Chart
            </button>
          </div>
        </div>
      </div>

      {/* ── Table View ─────────────────────────────────────────────────── */}
      {view === "table" && (
        <>
          <div ref={tableWrapRef} className="overflow-x-auto mb-4 -mx-1 px-1">
            <table className="text-sm text-left border-collapse">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  {(["threshold", "hold", "samples", "mean_return", "win_rate"] as const).map((key, idx) => (
                    <th key={key} className="pb-3 pr-8 font-medium whitespace-nowrap"
                      style={{
                        minWidth: `${FREE_COL_W}px`,
                        ...(idx === 0 ? { position: "sticky", left: 0, zIndex: 10, background: "#111827" } : {}),
                      }}>
                      {COL_INFO[key].label}
                      <span
                        className="ml-1.5 text-xs text-gray-600 hover:text-gray-300 cursor-default transition-colors"
                        onMouseEnter={(e) => showTooltip(key, e)}
                        onMouseLeave={hideTooltip}
                      >ⓘ</span>
                    </th>
                  ))}
                  {PRO_COLS.map((col) => (
                    <th key={col.key} className="pb-3 pr-8 font-medium whitespace-nowrap"
                      style={{ minWidth: `${PRO_COL_W}px` }}>
                      {col.label}
                      {COL_INFO[col.key] && (
                        <span
                          className="ml-1.5 text-xs text-gray-600 hover:text-gray-300 cursor-default transition-colors"
                          onMouseEnter={(e) => showTooltip(col.key, e)}
                          onMouseLeave={hideTooltip}
                        >ⓘ</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const isGroupStart = i % 3 === 0;
                  return (
                    <tr key={i}
                      className={`border-b border-gray-800 hover:bg-gray-800/30 ${
                        isGroupStart && i !== 0 ? "border-t border-t-gray-700" : ""
                      }`}
                    >
                      <td className="py-6 pr-8" style={{ minWidth: `${FREE_COL_W}px`, position: "sticky", left: 0, zIndex: 1, background: "#111827" }}>
                        <span className="font-mono font-semibold text-white">
                          {isGroupStart ? `${(row.threshold * 100).toFixed(0)}%` : ""}
                        </span>
                      </td>
                      <td className="py-6 pr-8 text-gray-300" style={{ minWidth: `${FREE_COL_W}px` }}>{row.holding_days}d</td>
                      <td className="py-6 pr-8 text-gray-400" style={{ minWidth: `${FREE_COL_W}px` }}>{row.sample_size}</td>
                      <td className="py-6 pr-8" style={{ minWidth: `${FREE_COL_W}px` }}>
                        <span className={row.mean_return >= 0 ? "text-green-400" : "text-red-400"}>
                          {(row.mean_return * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-6 pr-8" style={{ minWidth: `${FREE_COL_W}px` }}>
                        <span className={`font-semibold ${row.win_rate >= 0.55 ? "text-green-400" : "text-gray-300"}`}>
                          {(row.win_rate * 100).toFixed(1)}%
                        </span>
                        {(() => {
                          const ci = wilsonCILabel(row.win_rate, row.sample_size);
                          return ci ? (
                            <span className="block text-xs text-gray-600 font-normal mt-0.5">{ci}</span>
                          ) : null;
                        })()}
                      </td>
                      {PRO_COLS.map((col) => (
                        <td key={col.key} className="py-6 pr-8" style={{ minWidth: `${PRO_COL_W}px` }}>
                          {isProUnlocked ? (
                            <span className={
                              col.key === "max_drawdown" || col.key === "avg_drawdown"
                                ? "text-red-400"
                                : col.key === "median_return"
                                ? ((row[col.key as keyof PatternResult] as number) >= 0 ? "text-green-400" : "text-red-400")
                                : "text-gray-300"
                            }>
                              {col.key === "median_return" || col.key === "max_drawdown" || col.key === "avg_drawdown"
                                ? `${((row[col.key as keyof PatternResult] as number) * 100).toFixed(2)}%`
                                : (row[col.key as keyof PatternResult] as number).toFixed(3)
                              }
                            </span>
                          ) : (
                            <span
                              className="inline-block rounded-sm select-none"
                              style={{ width: "64px", height: "14px", background: "rgba(75,85,99,0.6)", filter: "blur(5px)" }}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 底部圖例 */}
          <div className="flex flex-wrap items-center pt-4 border-t border-gray-800 gap-3">
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="font-semibold" style={{ color: "#4ade80" }}>Green</span>
              <span className="text-gray-500">= above threshold</span>
            </div>
            <div className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="font-semibold" style={{ color: "#f87171" }}>Red</span>
              <span className="text-gray-500">= negative / risk value</span>
            </div>
          </div>
        </>
      )}

      {/* ── Chart View ─────────────────────────────────────────────────── */}
      {view === "chart" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
          {THRESHOLDS.map((threshold) => {
            const chartData = [1, 3, 7].map((days) => {
              const row: Record<string, number | string> = { days: `${days}d` };
              ["BTCUSDT", "ETHUSDT", "SOLUSDT"].forEach((symbol) => {
                const match = data.find((r) => r.symbol === symbol && r.threshold === threshold && r.holding_days === days);
                row[symbol] = match ? parseFloat((match.win_rate * 100).toFixed(1)) : 0;
              });
              return row;
            });
            return (
              <div key={threshold}>
                <p className="text-gray-400 text-sm text-center mb-2">
                  {THRESHOLD_LABELS[String(threshold)]}
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="days" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                    <YAxis domain={[40, 90]} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip
                      formatter={(value) => [`${value}%`, ""]}
                      contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                      labelStyle={{ color: "#f9fafb" }}
                    />
                    <ReferenceLine y={55} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(v) => v.replace("USDT", "")} />
                    <Bar dataKey="BTCUSDT" fill={CHART_COLORS.BTCUSDT} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ETHUSDT" fill={CHART_COLORS.ETHUSDT} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="SOLUSDT" fill={CHART_COLORS.SOLUSDT} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tooltip（fixed 定位，白底）──────────── */}
      {tooltipInfo && tooltip && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, width: "min(620px, 90vw)" }}
        >
          <div className="px-6 pt-5 pb-3 border-b border-gray-100">
            <p className="text-gray-900 font-bold text-base">{tooltipInfo.label}</p>
            <p className="text-gray-400 text-sm mt-0.5">{tooltipInfo.zh}</p>
          </div>
          <div className="flex divide-x divide-gray-100">
            <div className="flex-1 px-6 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-800 text-sm leading-relaxed mb-2">{tooltipInfo.en}</p>
              <p className="text-green-600 text-sm leading-relaxed">{tooltipInfo.en_interpret}</p>
            </div>
            <div className="flex-1 px-6 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-800 text-sm leading-relaxed mb-2">{tooltipInfo.zh_explain}</p>
              <p className="text-green-600 text-sm leading-relaxed">{tooltipInfo.zh_interpret}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
