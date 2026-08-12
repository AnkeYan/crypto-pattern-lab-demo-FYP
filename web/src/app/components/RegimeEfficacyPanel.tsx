"use client";

// RegimeEfficacyPanel — Regime-Conditional Signal Efficacy
// FYP 實證研究：Bull / Sideways / Bear 三種市場狀態下，技術信號的勝率是否有顯著差異？

import { useState } from "react";

export type EfficacyRow = {
  symbol: string;
  signal: string;
  holding_days: string;
  baseline_wr: string;
  baseline_n: string;
  all_wr: string;
  all_n: string;
  bull_wr: string;
  bull_n: string;
  bull_lo: string;
  bull_hi: string;
  bull_edge: string;
  bear_wr: string;
  bear_n: string;
  bear_lo: string;
  bear_hi: string;
  bear_edge: string;
  sideways_wr: string;
  sideways_n: string;
  sideways_lo: string;
  sideways_hi: string;
  sideways_edge: string;
  chi2_pvalue: string;
  significant: string;
  best_regime: string;
  worst_regime: string;
};

const SIGNAL_LABELS: Record<string, { en: string; zh: string }> = {
  rsi:       { en: "RSI Oversold",    zh: "RSI 超賣" },
  bollinger: { en: "Bollinger Band",  zh: "布林帶突破" },
  drop3:     { en: "3-Day Drop",      zh: "連跌 3 天" },
  vol_spike: { en: "Volume Spike",    zh: "成交量放大" },
};

const REGIME_COLORS: Record<string, string> = {
  bull:     "text-green-400",
  bear:     "text-red-400",
  sideways: "text-yellow-400",
};

const REGIME_LABELS: Record<string, string> = {
  bull:     "Bull",
  bear:     "Bear",
  sideways: "Sideways",
};

function pct(v: string | null | undefined): string {
  if (!v || v === "" || v === "nan" || v === "None") return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`;
}

function edge(v: string | null | undefined): string {
  if (!v || v === "" || v === "nan" || v === "None") return "—";
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}pp`;
}

function WinRateCell({ wr, lo, hi, e, n }: { wr: string; lo: string; hi: string; e: string; n: string }) {
  const wrNum = parseFloat(wr);
  const eNum  = parseFloat(e);
  const nNum  = parseInt(n);
  if (isNaN(wrNum) || wr === "nan" || wr === "") return <td className="px-3 py-2 text-center text-gray-600 text-xs">—</td>;

  const color = wrNum >= 0.58 ? "text-green-400" : wrNum >= 0.52 ? "text-yellow-400" : wrNum < 0.45 ? "text-red-400" : "text-gray-300";
  const edgeColor = !isNaN(eNum) ? (eNum > 0.03 ? "text-green-500" : eNum < -0.03 ? "text-red-500" : "text-gray-500") : "text-gray-600";

  return (
    <td className="px-3 py-2 text-center">
      <div className={`text-sm font-medium ${color}`}>{pct(wr)}</div>
      {!isNaN(eNum) && <div className={`text-xs ${edgeColor}`}>{edge(e)}</div>}
      {lo && hi && lo !== "nan" && (
        <div className="text-[10px] text-gray-600">[{pct(lo)}–{pct(hi)}]</div>
      )}
      {nNum > 0 && <div className="text-[10px] text-gray-700">n={nNum}</div>}
    </td>
  );
}

export default function RegimeEfficacyPanel({ data }: { data: EfficacyRow[] }) {
  const [sym, setSym]  = useState("BTCUSDT");
  const [hd, setHd]    = useState("7");
  const [open, setOpen] = useState(false);

  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  const symLabel = sym.replace("USDT", "");

  const rows = data.filter(r => r.symbol === sym && r.holding_days === hd);

  // Key takeaway: 有幾個信號在某個 regime 達到顯著差異
  const sigCount = rows.filter(r => r.significant === "True").length;
  const bestFinds = rows.filter(r => r.significant === "True").map(r => {
    const best = r.best_regime;
    const bestWr = parseFloat(r[`${best}_wr` as keyof EfficacyRow] as string);
    return { signal: SIGNAL_LABELS[r.signal]?.en ?? r.signal, regime: best, wr: bestWr };
  });

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-lg font-semibold">Regime-Conditional Signal Efficacy</h3>
          <p className="text-gray-500 text-sm">市場狀態下的信號有效性 · Do signals work differently in Bull vs Bear vs Sideways?</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap ml-4 mt-1">
          {open ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {/* Explainer */}
      {open && (
        <div className="mb-5 rounded-lg border border-gray-800 bg-white/[0.03] p-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: does an RSI oversold signal work equally well in all market conditions — or does it only work in certain regimes?</em>
              </p>
              <p className="text-gray-400 mb-2">
                The market is divided into three regimes based on trend direction: <strong className="text-green-400">Bull</strong> (uptrend), <strong className="text-red-400">Bear</strong> (downtrend), and <strong className="text-yellow-400">Sideways</strong> (ranging). Each regime creates a different backdrop for technical signals.
              </p>
              <p className="text-gray-400 mb-3">
                This panel tests whether the same signal produces different win rates across regimes, and whether those differences are <strong className="text-white">statistically significant</strong> (Chi-square test, p &lt; 0.05).
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Reading the table</p>
              <ul className="space-y-1 text-gray-400 text-xs">
                <li>• <strong className="text-gray-300">Win Rate</strong> — % of times price was higher after the signal (7d / 3d / 1d later)</li>
                <li>• <strong className="text-gray-300">Edge (+/−pp)</strong> — win rate minus the unconditional baseline. Positive = signal adds value in this regime.</li>
                <li>• <strong className="text-gray-300">[lo%–hi%]</strong> — Wilson 95% confidence interval. Wider = fewer samples, less certainty.</li>
                <li>• <strong className="text-gray-300">p-value</strong> — Chi-square test across the three regimes. p &lt; 0.05 means the regime differences are unlikely to be random.</li>
                <li>• <strong className="text-gray-300">✓ Significant</strong> — the signal behaves meaningfully differently depending on the regime.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：RSI 超賣信號在所有市場條件下都同樣有效嗎——還是只在特定市場狀態下才有用？</em>
              </p>
              <p className="text-gray-400 mb-2">
                市場被分為三種狀態：<strong className="text-green-400">牛市（Bull）</strong>、<strong className="text-red-400">熊市（Bear）</strong>、<strong className="text-yellow-400">橫盤（Sideways）</strong>。不同狀態下，同一個技術信號的效果可能完全不同。
              </p>
              <p className="text-gray-400 mb-3">
                本分析用 Chi-square 卡方檢驗，測試三個 Regime 的勝率差異是否達到統計顯著（p &lt; 0.05）。
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">如何看表格</p>
              <ul className="space-y-1 text-gray-400 text-xs">
                <li>• <strong className="text-gray-300">Win Rate</strong> — 信號出現後 N 天價格上漲的比例</li>
                <li>• <strong className="text-gray-300">Edge（優勢）</strong> — 勝率減去無條件基準勝率，正值代表信號在此 Regime 有額外優勢</li>
                <li>• <strong className="text-gray-300">[lo%–hi%]</strong> — Wilson 95% 置信區間，越寬代表樣本越少</li>
                <li>• <strong className="text-gray-300">p 值</strong> — 卡方檢驗，p &lt; 0.05 代表三個 Regime 間勝率差異不太可能是隨機的</li>
                <li>• <strong className="text-gray-300">✓ 顯著</strong> — 該信號的效果因市場狀態而有顯著差異</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1">
          {symbols.map(s => (
            <button key={s} onClick={() => setSym(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${sym === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {s.replace("USDT", "")}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {[["1", "1d"], ["3", "3d"], ["7", "7d"]].map(([val, label]) => (
            <button key={val} onClick={() => setHd(val)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${hd === val ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Condition banner */}
      <div className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">{symLabel} signal win rates by market regime</span>
        <span className="text-gray-400"> — hold {hd}d after signal. Edge = win rate vs unconditional baseline.</span>
        <span className="block mt-1 text-gray-500 text-sm">顯示：{symLabel} 各信號在不同 Regime 下的勝率，持有 {hd} 天，Edge = 相對無條件基準的優勢</span>
      </div>

      {/* Key Takeaway */}
      {rows.length > 0 && (() => {
        const baselineWr = parseFloat(rows[0]?.baseline_wr ?? "0.5");
        if (sigCount > 0 && bestFinds.length > 0) {
          const top = bestFinds[0];
          return (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
              <div className="font-medium text-green-400 mb-1">✓ Regime-dependent patterns found</div>
              <div className="text-gray-300">{sigCount} signal{sigCount > 1 ? "s" : ""} show statistically significant regime differences (p &lt; 0.05). {SIGNAL_LABELS[rows.find(r => r.significant === "True")?.signal ?? ""]?.en} performs best in <span className={REGIME_COLORS[top.regime]}>{REGIME_LABELS[top.regime]}</span> regime ({(top.wr * 100).toFixed(1)}% win rate vs {(baselineWr * 100).toFixed(1)}% baseline).</div>
              <div className="text-gray-500 mt-1">{sigCount} 個信號的勝率在不同市場狀態間存在統計顯著差異——信號有效性是 Regime 依賴的。</div>
            </div>
          );
        }
        return (
          <div className="mb-4 rounded-lg border border-gray-700 bg-white/[0.03] px-4 py-3 text-sm">
            <div className="font-medium text-gray-400 mb-1">~ No statistically significant regime differences (p ≥ 0.05)</div>
            <div className="text-gray-500">Signals perform similarly across Bull / Bear / Sideways regimes for {symLabel} at {hd}d holding. The differences observed may be due to sampling variation.</div>
            <div className="text-gray-600 mt-1">在此篩選條件下，各信號在不同 Regime 的勝率差異未達統計顯著水平。</div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-3 py-2 text-left text-xs text-gray-500 font-medium">Signal</th>
              <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Baseline<br/><span className="text-gray-700">無條件</span></th>
              <th className="px-3 py-2 text-center text-xs text-green-600 font-medium">Bull<br/><span className="text-gray-700">牛市</span></th>
              <th className="px-3 py-2 text-center text-xs text-red-600 font-medium">Bear<br/><span className="text-gray-700">熊市</span></th>
              <th className="px-3 py-2 text-center text-xs text-yellow-600 font-medium">Sideways<br/><span className="text-gray-700">橫盤</span></th>
              <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">p-value</th>
              <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Sig?</th>
              <th className="px-3 py-2 text-center text-xs text-gray-500 font-medium">Best Regime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pval = parseFloat(row.chi2_pvalue);
              const isSig = row.significant === "True";
              return (
                <tr key={i} className={`border-b border-gray-900 hover:bg-white/[0.02] ${isSig ? "bg-green-950/10" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="text-gray-200 font-medium text-sm">{SIGNAL_LABELS[row.signal]?.en ?? row.signal}</div>
                    <div className="text-gray-600 text-xs">{SIGNAL_LABELS[row.signal]?.zh ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="text-sm text-gray-400">{pct(row.baseline_wr)}</div>
                    <div className="text-[10px] text-gray-700">n={row.baseline_n}</div>
                  </td>
                  <WinRateCell wr={row.bull_wr} lo={row.bull_lo} hi={row.bull_hi} e={row.bull_edge} n={row.bull_n} />
                  <WinRateCell wr={row.bear_wr} lo={row.bear_lo} hi={row.bear_hi} e={row.bear_edge} n={row.bear_n} />
                  <WinRateCell wr={row.sideways_wr} lo={row.sideways_lo} hi={row.sideways_hi} e={row.sideways_edge} n={row.sideways_n} />
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs ${!isNaN(pval) && pval < 0.05 ? "text-green-400 font-medium" : "text-gray-500"}`}>
                      {!isNaN(pval) ? pval.toFixed(3) : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-sm ${isSig ? "text-green-400" : "text-gray-700"}`}>{isSig ? "✓" : "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-medium capitalize ${REGIME_COLORS[row.best_regime] ?? "text-gray-500"}`}>
                      {row.best_regime ? REGIME_LABELS[row.best_regime] : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Chi-square test across Bull / Bear / Sideways regimes. Regime classification based on SMA50/200 trend rules. Wilson 95% CI shown below each win rate. Edge = win rate minus unconditional baseline.
      </p>
    </div>
  );
}
