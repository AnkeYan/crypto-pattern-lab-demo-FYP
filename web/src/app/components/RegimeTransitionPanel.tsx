"use client";

// RegimeTransitionPanel — Markov Chain regime transition probabilities
// 顯示市場狀態轉換概率、平均持續天數、當前 streak

import { useState } from "react";

export type RegimeTransitionRow = {
  symbol: string;
  from_regime: string;
  to_regime: string;
  count: number | null;
  probability: number | null;
  extra: string | null;
};

const SYMBOLS = ["BTC", "ETH", "SOL"];

const REGIME_COLOR: Record<string, { text: string; bg: string; border: string; label: string }> = {
  bull:     { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  label: "Bull"     },
  bear:     { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    label: "Bear"     },
  sideways: { text: "text-gray-300",   bg: "bg-gray-500/10",   border: "border-gray-500/30",   label: "Sideways" },
  unknown:  { text: "text-gray-500",   bg: "bg-gray-800",      border: "border-gray-700",      label: "Unknown"  },
};

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};

function parseExtra(extra: string | null): string[] {
  if (!extra) return [];
  return extra.split("|");
}

function pctLabel(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(0)}%`;
}

function ProbBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(value * 100).toFixed(1)}%`, background: color }}
        />
      </div>
      <span className="text-xs tabular-nums w-9 text-right text-gray-300">
        {pctLabel(value)}
      </span>
    </div>
  );
}

export default function RegimeTransitionPanel({ data }: { data: RegimeTransitionRow[] }) {
  const [sym, setSym] = useState("BTC");
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;
  const symData = data.filter((r) => r.symbol === symKey);

  // Snapshot row: from_regime === "__snapshot__"
  const snapshot = symData.find((r) => r.from_regime === "__snapshot__");
  const currentRegime = snapshot?.to_regime ?? "unknown";
  const currentStreak = snapshot?.count ?? null;
  const avgRemaining  = snapshot?.probability ?? null;
  const nextProbs     = parseExtra(snapshot?.extra ?? null); // [bull%, bear%, sideways%]

  // Duration rows
  const durations = symData.filter((r) => r.to_regime === "__duration__");

  // Transition matrix rows (exclude meta rows)
  const matrixRows = symData.filter(
    (r) => r.to_regime !== "__duration__" && r.from_regime !== "__snapshot__"
  );

  const REGIMES = ["bull", "bear", "sideways"] as const;

  const BAR_COLORS: Record<string, string> = {
    bull: "#22c55e", bear: "#f87171", sideways: "#9ca3af",
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Regime Transition Probabilities</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            市場狀態轉換概率 · Markov Chain · Historical transition analysis
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: given that the market is currently in a Bull / Bear / Sideways regime, what does history say about how long it typically lasts — and where does it tend to go next?</em>
              </p>
              <p className="text-gray-400 mb-2">
                A <strong className="text-white">Markov Chain</strong> models market regime switches as historical transition frequencies.
                Think of it like a weather forecast based on seasons — if it's currently winter, how many days does winter typically last, and what's the probability it transitions to spring vs. an unusually long freeze?
              </p>
              <p className="text-gray-400 mb-3">
                This is purely based on historical patterns. Real markets have momentum and news-driven breaks — use this as background context, not a prediction.
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What do the terms mean?</p>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-gray-200">Transition probability</strong> — historical frequency of each regime-to-regime switch. e.g. "Bull → Sideways: 100%" means every bull run in history transitioned to Sideways first before Bear.</li>
                <li><strong className="text-gray-200">Avg duration</strong> — how many days each regime typically lasted (median). P25–P75 gives the typical range.</li>
                <li><strong className="text-gray-200">Current streak</strong> — how many days the current regime has been active.</li>
                <li><strong className="text-gray-200">Est. remaining</strong> — estimated remaining days based on historical runs of this length. If streak already exceeds the average, it means this run is already unusually long.</li>
                <li><strong className="text-gray-200">Next regime probabilities</strong> — based on historical transition matrix: given the current regime, how often did each transition occur?</li>
              </ul>
              <p className="text-xs text-blue-400/70 mt-3 pt-2 border-t border-white/[0.05]">
                <strong className="text-blue-300/80">Why is Bull → Bear = 0%?</strong>{" "}
                The regime classifier requires Bull → Sideways → Bear. Any day that doesn't fully qualify as Bull or Bear is labelled Sideways first — making direct Bull/Bear flips impossible by construction. This is expected, not a data error.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：當前市場處於牛市／熊市／橫盤，歷史上這個狀態通常持續多久，接下來最可能轉向哪裡？</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-white">馬可夫鏈</strong>把市場狀態切換建模為歷史轉換頻率。
                就像用季節預測天氣——現在是冬天，冬天通常持續多少天，接下來轉春天的概率是多少？
              </p>
              <p className="text-gray-400 mb-3">
                這純粹基於歷史規律。現實市場有動量效應和突發新聞，僅作背景參考，不是預測。
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">各術語說明</p>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-gray-200">轉換概率</strong> — 各 regime 切換的歷史頻率。例如「Bull → Sideways: 100%」代表歷史上所有牛市都先轉為橫盤才進入熊市。</li>
                <li><strong className="text-gray-200">平均持續天數</strong> — 每個 regime 通常持續多久（中位數）。P25–P75 是典型區間。</li>
                <li><strong className="text-gray-200">當前連續天數</strong> — 目前 regime 已持續了多少天。</li>
                <li><strong className="text-gray-200">估計剩餘天數</strong> — 根據歷史上同等長度的 regime，估算還有多少天。如果當前 streak 已超過平均值，說明這次 regime 已屬異常偏長。</li>
                <li><strong className="text-gray-200">下一狀態概率</strong> — 根據歷史轉換矩陣：當前 regime 結束後，各狀態出現的歷史頻率。</li>
              </ul>
              <p className="text-xs text-yellow-400/80 mt-3 pt-2 border-t border-white/[0.05]">
                ⚠ 馬可夫假設轉換無記憶——實際市場有動量效應和路徑依賴。此工具適合作為背景參考，不適合作為獨立交易信號。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Symbol tabs */}
      <div className="flex gap-1 border-b border-gray-700 mt-4 mb-4">
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

      {/* ── 條件說明行 ── */}
      <div className="mb-5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">{sym}</span>
        <span className="text-gray-400"> market regime history — how long does each state typically last, and where does it tend to transition next?</span>
        <span className="block mt-1 text-gray-500 text-sm">
          顯示：{sym} 市場狀態歷史規律——每個狀態通常持續多久，結束後最常轉向哪裡
        </span>
      </div>

      {/* Current streak snapshot */}
      {snapshot && (
        <div className={`rounded-lg border p-4 mb-5 ${REGIME_COLOR[currentRegime]?.border ?? "border-gray-700"} ${REGIME_COLOR[currentRegime]?.bg ?? "bg-gray-800"}`}>
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Current Regime · 當前狀態</p>
              <p className={`text-xl font-bold ${REGIME_COLOR[currentRegime]?.text ?? "text-gray-300"}`}>
                {REGIME_COLOR[currentRegime]?.label ?? currentRegime}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Streak · 已持續</p>
              <p className="text-xl font-bold text-white">{currentStreak != null ? `${currentStreak}d` : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Est. Remaining · 估計剩餘</p>
              <p className="text-xl font-bold text-white">{avgRemaining != null ? `~${avgRemaining}d` : "—"}</p>
              <p className="text-xs text-gray-500 mt-0.5">based on historical runs ≥ {currentStreak}d</p>
            </div>
            {nextProbs.length === 3 && (
              <div className="flex-1 min-w-[160px]">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Next Regime Probability · 下一狀態概率</p>
                <div className="space-y-1.5">
                  {(["bull", "bear", "sideways"] as const).map((r, i) => (
                    <div key={r} className="flex items-center gap-2">
                      <span className={`text-xs w-16 ${REGIME_COLOR[r].text}`}>{REGIME_COLOR[r].label}</span>
                      <ProbBar value={parseFloat(nextProbs[i] ?? "0")} color={BAR_COLORS[r]} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Transition matrix */}
        <div>
          <p className="text-sm text-gray-400 mb-3">Transition Matrix · 轉換矩陣</p>
          <table className="text-sm text-left border-collapse w-full">
            <thead className="text-gray-500 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-3 font-medium">From → To</th>
                {REGIMES.map((r) => (
                  <th key={r} className={`pb-2 pr-3 font-medium ${REGIME_COLOR[r].text}`}>
                    {REGIME_COLOR[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REGIMES.map((fromR) => (
                <tr key={fromR} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                  <td className={`py-2.5 pr-4 font-semibold whitespace-nowrap ${REGIME_COLOR[fromR].text}`}>
                    {REGIME_COLOR[fromR].label}
                  </td>
                  {REGIMES.map((toR) => {
                    const cell = matrixRows.find(
                      (r) => r.from_regime === fromR && r.to_regime === toR
                    );
                    const p = cell?.probability ?? null;
                    return (
                      <td key={toR} className="py-2.5 pr-3">
                        <span className={`font-medium tabular-nums ${
                          p != null && p >= 0.5 ? REGIME_COLOR[toR].text : "text-gray-400"
                        }`}>
                          {p != null ? `${(p * 100).toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-gray-600 mt-2">Rows sum to 100% · 每行加總為 100%（橫向轉換概率）</p>
        </div>

        {/* Duration stats */}
        <div>
          <p className="text-sm text-gray-400 mb-3">Average Duration per Regime · 各狀態平均持續天數</p>
          <div className="space-y-3">
            {durations.map((row) => {
              const regime = row.from_regime;
              const avgDays = row.probability;
              const extras  = parseExtra(row.extra);
              const p25 = extras[0] ? parseFloat(extras[0]) : null;
              const p75 = extras[1] ? parseFloat(extras[1]) : null;
              const rc  = REGIME_COLOR[regime] ?? REGIME_COLOR.unknown;
              return (
                <div key={regime} className={`rounded-lg border p-3 ${rc.border} ${rc.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm font-semibold ${rc.text}`}>{rc.label}</span>
                    <span className="text-white font-bold text-sm">
                      Avg {avgDays != null ? `${avgDays}d` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>P25: {p25 != null ? `${p25}d` : "—"}</span>
                    <span className="mx-2 text-gray-700">·</span>
                    <span>P75: {p75 != null ? `${p75}d` : "—"}</span>
                    <span className="mx-2 text-gray-700">·</span>
                    <span>{row.count} episodes recorded</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Key Takeaway ── */}
      {snapshot && (() => {
        const regLabel = REGIME_COLOR[currentRegime]?.label ?? currentRegime;
        const regLabelZh = currentRegime === "bull" ? "牛市" : currentRegime === "bear" ? "熊市" : currentRegime === "sideways" ? "橫盤" : "未知";
        const avgDur = durations.find((r) => r.from_regime === currentRegime)?.probability ?? null;
        const alreadyLong = avgDur != null && currentStreak != null && currentStreak > avgDur;

        // 找最可能的下一狀態
        const nextRegimeProbs = nextProbs.length === 3 ? [
          { regime: "bull", prob: parseFloat(nextProbs[0] ?? "0"), label: "Bull" },
          { regime: "bear", prob: parseFloat(nextProbs[1] ?? "0"), label: "Bear" },
          { regime: "sideways", prob: parseFloat(nextProbs[2] ?? "0"), label: "Sideways" },
        ].sort((a, b) => b.prob - a.prob) : [];
        const likelyNext = nextRegimeProbs[0] ?? null;

        let border = "border-gray-700";
        let bg = "bg-white/[0.03]";
        const icon = "~";
        let en = "";
        let zh = "";

        if (currentRegime === "bull") {
          border = "border-green-500/30"; bg = "bg-green-500/5";
          en = `${sym} is currently in a Bull regime${currentStreak != null ? ` (${currentStreak} days)` : ""}${avgDur != null ? `, vs. historical avg of ${avgDur} days` : ""}. ${alreadyLong ? "This run is already longer than average — a transition may be closer than usual." : "Still within the typical duration range."}${likelyNext ? ` Historically, Bull most often transitions to: ${likelyNext.label} (${(likelyNext.prob * 100).toFixed(0)}%).` : ""}`;
          zh = `${sym} 目前處於牛市 Regime${currentStreak != null ? `（已持續 ${currentStreak} 天）` : ""}${avgDur != null ? `，歷史平均持續 ${avgDur} 天` : ""}。${alreadyLong ? "本次已超過歷史平均，轉換可能比通常更近。" : "仍在典型持續範圍內。"}${likelyNext ? `歷史上牛市最常轉向：${likelyNext.label === "Bull" ? "牛市" : likelyNext.label === "Bear" ? "熊市" : "橫盤"}（${(likelyNext.prob * 100).toFixed(0)}%）。` : ""}`;
        } else if (currentRegime === "bear") {
          border = "border-red-500/20"; bg = "bg-red-500/5";
          en = `${sym} is currently in a Bear regime${currentStreak != null ? ` (${currentStreak} days)` : ""}${avgDur != null ? `, vs. historical avg of ${avgDur} days` : ""}. ${alreadyLong ? "This bear run is already unusually long." : "Within the typical duration range."}${likelyNext ? ` Historically, Bear most often transitions to: ${likelyNext.label} (${(likelyNext.prob * 100).toFixed(0)}%).` : ""}`;
          zh = `${sym} 目前處於熊市 Regime${currentStreak != null ? `（已持續 ${currentStreak} 天）` : ""}${avgDur != null ? `，歷史平均持續 ${avgDur} 天` : ""}。${alreadyLong ? "本次熊市持續時間已屬異常偏長。" : "仍在典型持續範圍內。"}${likelyNext ? `歷史上熊市最常轉向：${likelyNext.label === "Bull" ? "牛市" : likelyNext.label === "Bear" ? "熊市" : "橫盤"}（${(likelyNext.prob * 100).toFixed(0)}%）。` : ""}`;
        } else {
          en = `${sym} is currently in a Sideways regime${currentStreak != null ? ` (${currentStreak} days)` : ""}${avgDur != null ? `, vs. historical avg of ${avgDur} days` : ""}. ${alreadyLong ? "This sideways consolidation is already longer than average." : "Within the typical duration range."}${likelyNext ? ` Historically, Sideways most often transitions to: ${likelyNext.label} (${(likelyNext.prob * 100).toFixed(0)}%).` : ""}`;
          zh = `${sym} 目前處於橫盤 Regime${currentStreak != null ? `（已持續 ${currentStreak} 天）` : ""}${avgDur != null ? `，歷史平均持續 ${avgDur} 天` : ""}。${alreadyLong ? "本次橫盤已比歷史平均更長。" : "仍在典型持續範圍內。"}${likelyNext ? `歷史上橫盤最常轉向：${likelyNext.label === "Bull" ? "牛市" : likelyNext.label === "Bear" ? "熊市" : "橫盤"}（${(likelyNext.prob * 100).toFixed(0)}%）。` : ""}`;
        }

        return (
          <div className={`mt-5 rounded-lg border ${border} ${bg} px-4 py-3`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">~ Key Takeaway</p>
            <p className="text-sm text-gray-200 leading-relaxed">{en}</p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">{zh}</p>
          </div>
        );
      })()}

      <div className="mt-4 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-purple-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          Regime labels are rule-based (SMA50/200 + 30d momentum). Transition probabilities are historical frequencies, not forecasts. A Markov model assumes each transition is independent of history — suitable for context only. Regime 標籤基於規則分類（SMA50/200 + 30 天動量）。轉換概率為歷史頻率，非預測。馬可夫模型假設轉換互相獨立，僅供背景參考。
        </p>
      </div>
    </div>
  );
}
