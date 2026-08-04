"use client";

// 這個檔案負責：Walk-forward validation 面板
// 顯示每個 pattern 在不同市場週期（滾動年份）的表現穩定性
// 圖表：每個 fold 的 test win_rate 折線 + pass_flag 顏色點 + 訓練期 win_rate 對比線

import { useState } from "react";

type WalkForwardRow = {
  symbol: string;
  threshold: number | null;
  holding_days: number | null;
  fold: number | null;
  train_start: string;
  train_end: string;
  test_start: string;
  test_end: string;
  train_n: number | null;
  test_n: number | null;
  train_win_rate: number | null;
  test_win_rate: number | null;
  train_mean_return: number | null;
  test_mean_return: number | null;
  train_sharpe: number | null;
  test_sharpe: number | null;
  pass_flag: string;
};

// ── 常數 ──────────────────────────────────────────────────────────────────────
const SYMBOLS    = ["BTC", "ETH", "SOL"];
const THRESHOLDS = [-0.03, -0.05, -0.07];
const HOLDINGS   = [1, 3, 7];

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};
const SYMBOL_COLOR: Record<string, string> = {
  BTC: "#22c55e",
  ETH: "#60a5fa",
  SOL: "#facc15",
};

const FLAG_STYLE: Record<string, { dot: string; label: string; zh: string }> = {
  consistent: { dot: "#22c55e", label: "Consistent",  zh: "穩定" },
  weakened:   { dot: "#f59e0b", label: "Weakened",    zh: "轉弱" },
  failed:     { dot: "#ef4444", label: "Failed",      zh: "失效" },
  low_sample: { dot: "#6b7280", label: "Low sample",  zh: "樣本少" },
};

// SVG 尺寸
const SVG_W   = 620;
const SVG_H   = 200;
const PAD_L   = 50;
const PAD_R   = 20;
const PAD_T   = 20;
const PAD_B   = 40;
const CHART_W = SVG_W - PAD_L - PAD_R;
const CHART_H = SVG_H - PAD_T - PAD_B;

// ── 輔助 ──────────────────────────────────────────────────────────────────────
function pct(v: number | null, d = 1) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(d)}%`;
}
function fmt(v: number | null, d = 3) {
  if (v == null) return "—";
  return v.toFixed(d);
}

// ── SVG 折線圖 ────────────────────────────────────────────────────────────────
function WalkChart({
  rows,
  color,
}: {
  rows: WalkForwardRow[];
  color: string;
}) {
  if (rows.length === 0) return null;

  const maxFold = Math.max(...rows.map((r) => r.fold ?? 0));
  const yMin = 0.3;
  const yMax = 0.9;

  function xOf(fold: number) {
    return PAD_L + ((fold - 1) / Math.max(maxFold - 1, 1)) * CHART_W;
  }
  function yOf(v: number) {
    return PAD_T + CHART_H - ((v - yMin) / (yMax - yMin)) * CHART_H;
  }

  const yTicks = [0.4, 0.5, 0.55, 0.6, 0.7, 0.8];

  // train win_rate 均值（虛線）
  const trainAvg = rows
    .filter((r) => r.train_win_rate != null)
    .reduce((s, r) => s + r.train_win_rate!, 0) / rows.filter((r) => r.train_win_rate != null).length;

  // test 折線
  const testPoints = rows
    .filter((r) => r.fold != null && r.test_win_rate != null)
    .sort((a, b) => (a.fold ?? 0) - (b.fold ?? 0));

  const lineD = testPoints
    .map((r, i) => `${i === 0 ? "M" : "L"}${xOf(r.fold!).toFixed(1)},${yOf(r.test_win_rate!).toFixed(1)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: `${SVG_H}px` }}>
      {/* 格線 */}
      {yTicks.map((tick) => (
        <line key={tick}
          x1={PAD_L} x2={SVG_W - PAD_R}
          y1={yOf(tick)} y2={yOf(tick)}
          stroke="#374151" strokeWidth={tick === 0.55 ? 1.2 : 0.7}
          strokeDasharray={tick === 0.55 ? "none" : "3 3"}
        />
      ))}

      {/* 55% 參考線 label */}
      <text x={PAD_L - 4} y={yOf(0.55) + 4} textAnchor="end" fontSize={9} fill="#6b7280">55%</text>

      {/* train 平均線（虛線） */}
      {!isNaN(trainAvg) && (
        <line
          x1={PAD_L} x2={SVG_W - PAD_R}
          y1={yOf(trainAvg)} y2={yOf(trainAvg)}
          stroke={color} strokeWidth={0.8} strokeDasharray="5 3" strokeOpacity={0.45}
        />
      )}

      {/* test 折線 */}
      <path d={lineD} stroke={color} strokeWidth={1.6} fill="none" strokeOpacity={0.85} />

      {/* fold 數據點（顏色 = pass_flag）*/}
      {testPoints.map((r) => {
        const fs = FLAG_STYLE[r.pass_flag] ?? FLAG_STYLE.low_sample;
        return (
          <circle key={r.fold}
            cx={xOf(r.fold!)} cy={yOf(r.test_win_rate!)}
            r={5} fill={fs.dot} stroke="#111827" strokeWidth={1.5}
          />
        );
      })}

      {/* Y 軸刻度 */}
      {yTicks.filter((t) => t !== 0.55).map((tick) => (
        <text key={tick}
          x={PAD_L - 6} y={yOf(tick) + 4}
          textAnchor="end" fontSize={9} fill="#9ca3af"
        >
          {(tick * 100).toFixed(0)}%
        </text>
      ))}

      {/* X 軸：fold 標籤（年份） */}
      {testPoints.map((r) => (
        <text key={r.fold}
          x={xOf(r.fold!)} y={SVG_H - PAD_B + 16}
          textAnchor="middle" fontSize={9} fill="#9ca3af"
        >
          {r.test_start?.slice(0, 4)}
        </text>
      ))}

      <text x={PAD_L + CHART_W / 2} y={SVG_H - 4}
        textAnchor="middle" fontSize={9} fill="#6b7280">
        Test year
      </text>

      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + CHART_H}
        stroke="#4b5563" strokeWidth={0.8} />
    </svg>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function WalkForwardPanel({ data }: { data: WalkForwardRow[] }) {
  const [sym,     setSym]     = useState("BTC");
  const [thr,     setThr]     = useState(-0.03);
  const [hold,    setHold]    = useState(7);
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;
  const filtered = data.filter(
    (r) => r.symbol === symKey && r.threshold === thr && r.holding_days === hold
  ).sort((a, b) => (a.fold ?? 0) - (b.fold ?? 0));

  const color = SYMBOL_COLOR[sym];

  // consistent rate
  const validFolds = filtered.filter((r) => r.pass_flag !== "low_sample");
  const consistentRate = validFolds.length > 0
    ? validFolds.filter((r) => r.pass_flag === "consistent").length / validFolds.length
    : null;

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Walk-Forward Validation</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            滾動年份窗口驗證 · 測試 pattern 跨市場週期的穩定性
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} What is this?
        </button>
      </div>

      {/* ── 說明框 ── */}
      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                Walk-forward validation tests a pattern by <strong className="text-white">rolling forward one year at a time</strong>.
                Each fold trains on 3 years of data and tests on the following year — a much stricter check than a single train/test split.
              </p>
              <p className="text-gray-400 text-sm">
                A pattern that only works in one period may be a statistical artefact.
                A pattern that remains <strong className="text-gray-300">consistent</strong> across multiple folds is more likely to reflect a genuine market inefficiency.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                Walk-forward 驗證以<strong className="text-white">每年滾動一格</strong>的方式測試 pattern：
                每個 fold 用 3 年數據訓練，測試下一年，比單一 train/test split 更嚴格。
              </p>
              <p className="text-gray-400 text-sm">
                只在某一段時期有效的 pattern 可能是統計偶然。
                在多個 fold 中保持<strong className="text-gray-300">穩定</strong>的 pattern，更有可能反映真實的市場規律。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 篩選器 ── */}
      <div className="flex flex-wrap items-center gap-4 mt-4 mb-5">
        {/* 幣種 */}
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
        {/* Threshold */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Threshold</span>
          <div className="flex gap-1">
            {THRESHOLDS.map((t) => (
              <button key={t} onClick={() => setThr(t)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  thr === t
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {(t * 100).toFixed(0)}%
              </button>
            ))}
          </div>
        </div>
        {/* Holding */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Hold</span>
          <div className="flex gap-1">
            {HOLDINGS.map((h) => (
              <button key={h} onClick={() => setHold(h)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  hold === h
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>

        {/* Consistent Rate badge */}
        {consistentRate !== null && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Consistent rate</span>
            <span className={`text-sm font-bold ${
              consistentRate >= 0.6 ? "text-green-400" :
              consistentRate >= 0.4 ? "text-yellow-400" : "text-red-400"
            }`}>
              {(consistentRate * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* ── 圖表 ── */}
      <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 mb-5">
        <WalkChart rows={filtered} color={color} />
        <div className="flex flex-wrap items-center gap-4 mt-2 justify-center">
          {Object.entries(FLAG_STYLE).map(([key, s]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.dot }} />
              {s.label} · {s.zh}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-5 border-t border-dashed" style={{ borderColor: color, opacity: 0.45 }} />
            Train avg win rate
          </div>
        </div>
      </div>

      {/* ── Fold 明細表 ── */}
      <div className="overflow-x-auto">
        <table className="text-sm w-full border-collapse">
          <thead className="text-gray-400 border-b border-gray-700">
            <tr>
              <th className="pb-2 pr-5 font-medium text-left whitespace-nowrap">Fold</th>
              <th className="pb-2 pr-5 font-medium text-left whitespace-nowrap">Test Period</th>
              <th className="pb-2 pr-5 font-medium text-left whitespace-nowrap">Test n</th>
              <th className="pb-2 pr-5 font-medium text-left whitespace-nowrap">Train WR</th>
              <th className="pb-2 pr-5 font-medium text-left whitespace-nowrap">Test WR</th>
              <th className="pb-2 pr-5 font-medium text-left whitespace-nowrap">Test Mean Ret</th>
              <th className="pb-2 font-medium text-left whitespace-nowrap">Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const fs = FLAG_STYLE[row.pass_flag] ?? FLAG_STYLE.low_sample;
              const wrDelta = (row.test_win_rate ?? 0) - (row.train_win_rate ?? 0);
              return (
                <tr key={row.fold} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-3 pr-5 text-gray-400">{row.fold}</td>
                  <td className="py-3 pr-5 text-gray-300 whitespace-nowrap text-xs">
                    {row.test_start?.slice(0, 4)}
                  </td>
                  <td className="py-3 pr-5 text-gray-400">
                    {row.test_n ?? "—"}
                    {(row.test_n ?? 0) < 15 && <span className="ml-1 text-yellow-400 text-xs">⚠</span>}
                  </td>
                  <td className="py-3 pr-5 text-gray-400">{pct(row.train_win_rate)}</td>
                  <td className="py-3 pr-5">
                    <span className={row.test_win_rate != null && row.test_win_rate >= 0.55 ? "text-green-400 font-medium" : "text-gray-300"}>
                      {pct(row.test_win_rate)}
                    </span>
                    {row.train_win_rate != null && row.test_win_rate != null && (
                      <span className={`ml-1.5 text-xs ${wrDelta >= 0 ? "text-green-500" : "text-red-400"}`}>
                        ({wrDelta >= 0 ? "+" : ""}{(wrDelta * 100).toFixed(1)}%)
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-5">
                    {row.test_mean_return != null ? (
                      <span className={row.test_mean_return >= 0 ? "text-green-400" : "text-red-400"}>
                        {(row.test_mean_return * 100).toFixed(2)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: fs.dot }}>
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: fs.dot }} />
                      {fs.label} · {fs.zh}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 底部注釋 ── */}
      <p className="text-gray-600 text-sm mt-4 leading-relaxed">
        Each fold trains on 3 years and tests on the next year. Low sample folds (test n &lt; 15) are excluded from consistent rate calculation.
        · 每個 fold 以 3 年訓練、1 年測試。測試樣本少於 15 次的 fold 不計入穩定率。
      </p>
    </div>
  );
}
