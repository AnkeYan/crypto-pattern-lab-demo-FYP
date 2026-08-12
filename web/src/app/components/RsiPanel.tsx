"use client";

// 這個檔案負責：RSI 超賣信號後的統計分析面板
// 信號：RSI-N 跌破 30（超賣）或 20（極端超賣）後，分析持有 1d/3d/7d 的回報
// 特別展示：不同幣種間的信號質量差異

import { useState } from "react";
import { wilsonCILabel } from "../lib/wilson";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

type RsiRow = {
  symbol: string;
  rsi_window: number | null;
  rsi_threshold: number | null;
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
const SYMBOLS     = ["BTC", "ETH", "SOL"];
const WINDOWS     = [7, 14];
const THRESHOLDS  = [30, 20];
const HOLDINGS    = [1, 3, 7];
const LOW_SAMPLE  = 20;

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

// ── 輔助 ──────────────────────────────────────────────────────────────────────
function pct(v: number | null, d = 2) {
  if (v == null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(d)}%`;
}

// ── 動態 Key Takeaway 生成 ────────────────────────────────────────────────────
function buildTakeaway(sym: string, rsiWin: number, rsiThr: number, rows: RsiRow[]) {
  if (rows.length === 0) return null;

  // 找出三個 holding period 各自的 7d row（或全部）
  const row7 = rows.find((r) => r.holding_days === 7);
  const row3 = rows.find((r) => r.holding_days === 3);
  const row1 = rows.find((r) => r.holding_days === 1);

  // 找出勝率最高的 holding period
  const allRows = [row1, row3, row7].filter(Boolean) as RsiRow[];
  const bestRow = allRows.reduce((best, r) =>
    (r.win_rate ?? 0) > (best.win_rate ?? 0) ? r : best
  , allRows[0]);

  const best7dWr = row7?.win_rate ?? null;
  const bestWr   = bestRow?.win_rate ?? null;
  const bestHold = bestRow?.holding_days ?? null;
  const n        = bestRow?.sample_size ?? null;
  const lowN     = (row7?.sample_size ?? 0) < 20;

  // 判斷整體信號質量
  const hasEdge  = (best7dWr ?? 0) >= 0.55;
  const weak7d   = best7dWr != null && best7dWr < 0.52;
  const extreme  = rsiThr === 20;

  // ── 英文摘要 ──
  let enSummary = "";
  if (lowN) {
    enSummary = `Only ${n ?? "few"} signals found — RSI < ${rsiThr} rarely triggers on ${sym}. Results below are statistically weak; treat as directional hints only.`;
  } else if (hasEdge) {
    enSummary = `RSI-${rsiWin} < ${rsiThr} on ${sym} shows a historical edge: 7-day win rate is ${pct(best7dWr, 1)}, above the 55% threshold. `;
    if (bestHold === 7) {
      enSummary += `Holding 7 days gives the best outcome — shorter holds (1d, 3d) show weaker or no edge.`;
    } else {
      enSummary += `The best holding period is ${bestHold}d (${pct(bestWr, 1)} win rate) — not necessarily the longest.`;
    }
    if (extreme) enSummary += ` Extreme oversold (RSI < 20) amplifies the signal but occurs very rarely.`;
  } else if (weak7d) {
    enSummary = `RSI-${rsiWin} < ${rsiThr} on ${sym} shows no consistent edge — 7-day win rate is only ${pct(best7dWr, 1)}, below the 55% threshold. `;
    enSummary += `This signal alone is insufficient on ${sym}; consider combining with other factors (e.g., Fear & Greed, Bollinger).`;
  } else {
    enSummary = `RSI-${rsiWin} < ${rsiThr} on ${sym}: 7-day win rate is ${pct(best7dWr, 1)} — marginal. `;
    enSummary += `The signal is inconclusive on its own; use alongside other indicators for confirmation.`;
  }

  // ── 中文摘要 ──
  let zhSummary = "";
  if (lowN) {
    zhSummary = `只有 ${n ?? "少量"} 個信號——RSI < ${rsiThr} 在 ${sym} 上極少觸發，統計可靠性低，僅供方向參考。`;
  } else if (hasEdge) {
    zhSummary = `${sym} RSI-${rsiWin} < ${rsiThr} 有歷史統計優勢：7 天勝率 ${pct(best7dWr, 1)}，超過 55% 門檻。`;
    if (bestHold === 7) {
      zhSummary += `持有 7 天效果最佳，1 天和 3 天的優勢明顯較弱。`;
    } else {
      zhSummary += `最佳持有期為 ${bestHold} 天（勝率 ${pct(bestWr, 1)}），未必是最長持有。`;
    }
    if (extreme) zhSummary += `極端超賣（RSI < 20）信號更強，但觸發極少。`;
  } else if (weak7d) {
    zhSummary = `${sym} RSI-${rsiWin} < ${rsiThr} 沒有一致性優勢——7 天勝率只有 ${pct(best7dWr, 1)}，低於 55% 門檻。`;
    zhSummary += `此信號單獨使用不足夠，建議配合其他因子（如 Fear & Greed、Bollinger Band）一起判斷。`;
  } else {
    zhSummary = `${sym} RSI-${rsiWin} < ${rsiThr}：7 天勝率 ${pct(best7dWr, 1)}——邊緣水平，信號不夠明確。`;
    zhSummary += `建議配合其他指標確認方向。`;
  }

  return { enSummary, zhSummary, hasEdge, weak7d, lowN, n, best7dWr };
}

// ── 三幣種對比圖：同一參數下 BTC/ETH/SOL 的 7d win rate ─────────────────────
function CrossSymbolChart({
  data,
  rsiWindow,
  rsiThreshold,
}: {
  data: RsiRow[];
  rsiWindow: number;
  rsiThreshold: number;
}) {
  const chartData = HOLDINGS.map((h) => {
    const entry: Record<string, number | string | null> = { label: `${h}d` };
    SYMBOLS.forEach((s) => {
      const row = data.find(
        (r) =>
          r.symbol === `${s}USDT` &&
          r.rsi_window === rsiWindow &&
          r.rsi_threshold === rsiThreshold &&
          r.holding_days === h
      );
      entry[s] = row?.win_rate != null
        ? parseFloat((row.win_rate * 100).toFixed(1))
        : null;
    });
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} />
        <YAxis domain={[30, 90]} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          formatter={(v, name) => [`${v}%`, name]}
          contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
          labelStyle={{ color: "#f9fafb" }}
        />
        <ReferenceLine y={55} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.35} />
        {SYMBOLS.map((s) => (
          <Bar key={s} dataKey={s} fill={SYMBOL_BAR_COLOR[s]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function RsiPanel({ data }: { data: RsiRow[] }) {
  const isProUnlocked = true;
  const [sym,       setSym]       = useState("BTC");
  const [rsiWin,    setRsiWin]    = useState(14);
  const [rsiThr,    setRsiThr]    = useState(30);
  const [showInfo,  setShowInfo]  = useState(false);
  const [showCross, setShowCross] = useState(false);

  const symKey   = `${sym}USDT`;
  const filtered = data.filter(
    (r) => r.symbol === symKey && r.rsi_window === rsiWin && r.rsi_threshold === rsiThr
  );
  const takeaway = buildTakeaway(sym, rsiWin, rsiThr, filtered);

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug">RSI Oversold<br className="sm:hidden" /> Signal Analysis</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            RSI 超賣信號後的統計回報分析
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0 mt-0.5"
        >
          {showInfo ? "▾" : "▸"} What is RSI?
        </button>
      </div>

      {/* ── 說明框 ── */}
      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">What is RSI?</strong> Think of it as a "how badly has this dropped?" score, ranging from 0 to 100.
                The lower the score, the more beaten-down the asset is. When RSI falls <strong className="text-white">below 30</strong>, it means the price has dropped hard and fast — traders call this "oversold".
                When RSI falls below <strong className="text-white">20</strong>, it's even more extreme — a rare panic-level drop.
              </p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">What is this panel asking?</strong><br />
                <em className="text-gray-400">"Every time BTC's RSI dropped below 30 in history — what percentage of the time was the price higher 1 day / 3 days / 7 days later?"</em><br />
                That's exactly what the table below shows. The <strong className="text-white">Signals</strong> column tells you how many times this happened historically. The <strong className="text-white">Win Rate</strong> tells you how often the price went up afterwards.
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">Window (7d / 14d)</strong>: RSI is calculated using the last N days of price moves. 14d is the standard (used by TradingView). 7d is more hair-trigger — it fires more often but is noisier.<br />
                <strong className="text-gray-300">RSI below 30 / 20</strong>: How deep a drop qualifies as a signal. Below 20 is rarer but more extreme — each signal represents a serious crash.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">RSI 是什麼？</strong> 把它想成「這個幣跌得有多慘」的分數，範圍 0–100，分數越低代表跌得越慘。
                當 RSI 跌破 <strong className="text-white">30</strong>，代表價格跌得又快又猛，交易員稱之為「超賣」。
                跌破 <strong className="text-white">20</strong> 更極端——是那種罕見的恐慌性崩跌。
              </p>
              <p className="text-gray-300 mb-3">
                <strong className="text-white">這個 panel 在問什麼問題？</strong><br />
                <em className="text-gray-400">「歷史上，每次 BTC 的 RSI 跌破 30，之後 1天 / 3天 / 7天後，有多少次是漲的？」</em><br />
                這正是下面表格顯示的內容。<strong className="text-white">Signals</strong> 欄 = 歷史上出現過幾次這種信號；<strong className="text-white">Win Rate</strong> = 這些次數裡，之後上漲的比例。
              </p>
              <p className="text-gray-400">
                <strong className="text-gray-300">Window（7天 / 14天）</strong>：RSI 用過去 N 天的漲跌來計算。14天是標準（TradingView 預設），7天更敏感，信號更頻繁但噪音也更多。<br />
                <strong className="text-gray-300">RSI below 30 / 20</strong>：設定「跌到多低才算信號」。20 比 30 更罕見，但每次觸發都代表跌得很嚴重。
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
            <button key={s} onClick={() => setSym(s)}
              className={`px-3 py-1.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                sym === s ? SYMBOL_BORDER[s] : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {/* RSI 窗口 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Window</span>
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button key={w} onClick={() => setRsiWin(w)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  rsiWin === w
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        {/* RSI 門檻 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">RSI below</span>
          <div className="flex gap-1">
            {THRESHOLDS.map((t) => (
              <button key={t} onClick={() => setRsiThr(t)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  rsiThr === t
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 當前條件說明 ── */}
      <div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">every time {sym}&apos;s RSI-{rsiWin} dropped below {rsiThr}</span>
        <span className="text-gray-400"> in history — how often was the price </span>
        <span className="text-white font-medium">higher 1 / 3 / 7 days later?</span>
        <span className="text-gray-500 ml-2 text-xs">
          ({filtered[0]?.sample_size != null ? `${filtered[0].sample_size} signals found` : "loading..."})
        </span>
        <span className="block mt-1 text-gray-500 text-sm">
          顯示：歷史上每次 {sym} RSI-{rsiWin} 跌破 {rsiThr}，之後 1天 / 3天 / 7天後，有多少次是漲的？
        </span>
      </div>

      {/* ── 主體：統計表 + 圖 ── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* 左：統計表 */}
        <div className="flex-1 overflow-x-auto">
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="pb-3 pr-6 font-medium whitespace-nowrap" style={{ minWidth: "60px" }}>Hold</th>
                <th className="pb-3 pr-6 font-medium whitespace-nowrap" style={{ minWidth: "80px" }}>Signals</th>
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
                const low = (row?.sample_size ?? 0) < LOW_SAMPLE;
                return (
                  <tr key={h} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-4 pr-6 text-gray-300">{h}d</td>
                    <td className="py-4 pr-6">
                      <span className={low ? "text-yellow-400" : "text-gray-400"}>
                        {row?.sample_size ?? "—"}{low && <span className="ml-1 text-xs">⚠</span>}
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
                    {PRO_COLS.map((col) => (
                      <td key={col.key} className="py-4 pr-6">
                        {isProUnlocked ? (
                          <span className={
                            col.key === "max_drawdown" || col.key === "avg_drawdown"
                              ? "text-red-400"
                              : "text-gray-300"
                          }>
                            {col.key === "max_drawdown" || col.key === "avg_drawdown"
                              ? `${((row?.[col.key as keyof RsiRow] as number ?? 0) * 100).toFixed(2)}%`
                              : (row?.[col.key as keyof RsiRow] as number | null)?.toFixed(3) ?? "—"
                            }
                          </span>
                        ) : (
                          <span className="inline-block rounded-sm select-none"
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

          {filtered.some((r) => (r.sample_size ?? 0) < LOW_SAMPLE) && (
            <p className="text-yellow-400/70 text-xs mt-3 flex items-center gap-1">
              <span>⚠</span>
              <span>Fewer than {LOW_SAMPLE} signals — interpret with caution. Extreme oversold (RSI &lt; 20) naturally triggers rarely.</span>
            </p>
          )}
        </div>

        {/* 右：Win Rate chart */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <p className="text-xs text-gray-400 mb-3 text-center">Win Rate by Holding Period</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={HOLDINGS.map((h) => {
                const row = filtered.find((r) => r.holding_days === h);
                return {
                  label: `${h}d`,
                  win_rate: row?.win_rate != null ? parseFloat((row.win_rate * 100).toFixed(1)) : null,
                  low: (row?.sample_size ?? 0) < LOW_SAMPLE,
                };
              })}
              margin={{ top: 4, right: 8, left: -14, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis domain={[30, 90]} tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`, "Win Rate"]}
                contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                labelStyle={{ color: "#f9fafb" }} />
              <ReferenceLine y={55} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.35} />
              <Bar dataKey="win_rate" radius={[4, 4, 0, 0]}>
                {HOLDINGS.map((h, idx) => {
                  const row = filtered.find((r) => r.holding_days === h);
                  const low = (row?.sample_size ?? 0) < LOW_SAMPLE;
                  return <Cell key={idx} fill={low ? "#6b7280" : SYMBOL_BAR_COLOR[sym]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-gray-500 mt-1">
            Dashed = 55% edge threshold
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
              RSI-{rsiWin} &lt; {rsiThr} · {sym}
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

      {/* ── 三幣種對比折疊區 ── */}
      <div className="mt-6 border-t border-gray-800 pt-5">
        <button
          onClick={() => setShowCross((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          {showCross ? "▾" : "▸"} Compare BTC / ETH / SOL side by side · 三幣種對比
        </button>

        {showCross && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-3 text-center">
              Win Rate by holding period · RSI-{rsiWin} &lt; {rsiThr} · All three coins
            </p>
            <CrossSymbolChart data={data} rsiWindow={rsiWin} rsiThreshold={rsiThr} />
            <p className="text-center text-xs text-gray-500 mt-1">
              Dashed = 55% edge threshold · Green = BTC · Blue = ETH · Yellow = SOL
            </p>
          </div>
        )}
      </div>

      {/* ── 底部 CTA ── */}
      <div className="flex items-center pt-5 mt-2 border-t border-gray-800 gap-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-green-400">Green</span>
          <span className="text-gray-500">= win rate ≥ 55%</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-yellow-400">⚠</span>
          <span className="text-gray-500">= n &lt; {LOW_SAMPLE} signals</span>
        </div>
      </div>
    </div>
  );
}
