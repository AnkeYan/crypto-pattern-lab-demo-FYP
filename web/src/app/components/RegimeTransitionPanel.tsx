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
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                A <strong className="text-white">Markov Chain</strong> models regime switches as memoryless transitions.
                Each time the market left a regime, where did it go next?
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                <strong className="text-gray-300">Transition probability</strong>: historical frequency of each regime-to-regime switch.{" "}
                <strong className="text-gray-300">Avg duration</strong>: how many days each regime typically lasted.{" "}
                <strong className="text-gray-300">Current streak</strong>: how long the current regime has persisted — and the estimated remaining days based on history.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">馬可夫鏈</strong>把市場狀態切換建模為無記憶轉換——每次離開某個狀態，歷史上下一個狀態是什麼？
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                <strong className="text-gray-300">轉換概率</strong>：各 regime 切換的歷史頻率。{" "}
                <strong className="text-gray-300">平均持續天數</strong>：每個 regime 通常持續多久。{" "}
                <strong className="text-gray-300">當前連續天數</strong>：目前 regime 已持續多少天，及基於歷史估算的剩餘天數。
              </p>
            </div>
          </div>
          <p className="text-xs text-blue-400/70 mt-3 border-t border-white/[0.05] pt-3">
            <strong className="text-blue-300/80">Why Bull → Bear = 0%?</strong>{" "}
            The regime rules require Bull → Sideways → Bear. A direct flip is impossible by construction: any day that does not fully meet Bull or Bear criteria registers as Sideways first. This is expected behaviour, not a data error.{" "}
            為何 Bull → Bear = 0%？因為 Regime 規則要求市場必須先經過 Sideways 緩衝帶，直接在 Bull 和 Bear 之間切換在定義上不可能發生，這是預期行為。
          </p>
          <p className="text-xs text-yellow-400/80 mt-1">
            ⚠ Markov assumption: transitions are memoryless. Real markets have momentum and path-dependence. Use as context, not prediction. 馬可夫假設轉換無記憶，實際市場有動量效應，僅供參考。
          </p>
        </div>
      )}

      {/* Symbol tabs */}
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

      <div className="mt-5 pt-4 border-t border-gray-800 bg-gray-800/30 px-4 py-3 rounded-lg -mx-0">
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-purple-400/90 font-semibold">Research note · 研究說明：</span>{" "}
          Regime labels are rule-based (SMA50/200 + 30d momentum). Transition probabilities are historical frequencies, not forecasts. A Markov model assumes each transition is independent of history — suitable for context only. Regime 標籤基於規則分類（SMA50/200 + 30 天動量）。轉換概率為歷史頻率，非預測。馬可夫模型假設轉換互相獨立，僅供背景參考。
        </p>
      </div>
    </div>
  );
}
