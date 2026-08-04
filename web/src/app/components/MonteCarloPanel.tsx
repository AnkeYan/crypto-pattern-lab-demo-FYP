"use client";

// 這個檔案負責：Monte Carlo 價格路徑模擬面板
// 基於 GARCH 波動率預測，使用 Student-t 分佈模擬未來 7/14/30 天
// 圖表：純 SVG，50 條半透明路徑 + 百分位帶（5th/25th/50th/75th/95th）

import { useState, useEffect, useCallback } from "react";

// ── API 回傳類型 ───────────────────────────────────────────────────────────────
type BandPoint = {
  day: number;
  p5: number; p25: number; p50: number; p75: number; p95: number;
};

type McResult = {
  symbol: string;
  horizon: number;
  simulations: number;
  last_price: number;
  bands: BandPoint[];
  sample_paths: number[][];
  summary: {
    median: number;
    p5: number;
    p95: number;
    prob_up: number;
    expected_return: number;
  };
};

// ── 常數 ──────────────────────────────────────────────────────────────────────
const SYMBOLS  = ["BTC", "ETH", "SOL"];
const HORIZONS = [7, 14, 30] as const;

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

// SVG 尺寸
const SVG_W   = 700;
const SVG_H   = 280;
const PAD_L   = 72;
const PAD_R   = 68;   // 加寬，容納右側 CI 標籤
const PAD_T   = 16;
const PAD_B   = 40;
const CHART_W = SVG_W - PAD_L - PAD_R;
const CHART_H = SVG_H - PAD_T - PAD_B;

// ── SVG 圖表 ──────────────────────────────────────────────────────────────────
function McChart({ result, color }: { result: McResult; color: string }) {
  const { bands, sample_paths, last_price, horizon } = result;

  // Y 軸：基於 p5 和 p95 加一點 padding
  const allPrices = bands.flatMap((b) => [b.p5, b.p95]);
  const yMin = Math.min(...allPrices) * 0.97;
  const yMax = Math.max(...allPrices) * 1.03;

  function xOf(day: number) {
    return PAD_L + (day / horizon) * CHART_W;
  }
  function yOf(price: number) {
    return PAD_T + CHART_H - ((price - yMin) / (yMax - yMin)) * CHART_H;
  }

  // Y 軸刻度（5 條）
  const yTicks = Array.from({ length: 5 }, (_, i) =>
    yMin + ((yMax - yMin) * i) / 4
  );

  // X 軸刻度：day 0 + 每隔幾天一個
  const xTickStep = horizon <= 7 ? 1 : horizon <= 14 ? 2 : 5;
  const xTicks: number[] = [];
  for (let d = 0; d <= horizon; d += xTickStep) xTicks.push(d);
  if (!xTicks.includes(horizon)) xTicks.push(horizon);

  // 百分位 band polygon 點
  function polyPoints(upper: number[], lower: number[]) {
    const up   = upper.map((p, i) => `${xOf(i)},${yOf(p)}`).join(" ");
    const down = [...lower].reverse().map((p, i) =>
      `${xOf(lower.length - 1 - i)},${yOf(p)}`
    ).join(" ");
    return `${up} ${down}`;
  }

  const p95vals = bands.map((b) => b.p95);
  const p75vals = bands.map((b) => b.p75);
  const p50vals = bands.map((b) => b.p50);
  const p25vals = bands.map((b) => b.p25);
  const p5vals  = bands.map((b) => b.p5);

  // 路徑字串
  function pathD(prices: number[]) {
    return prices.map((p, i) =>
      `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p).toFixed(1)}`
    ).join(" ");
  }

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ maxHeight: `${SVG_H}px` }}>
      {/* 格線 */}
      {yTicks.map((tick, i) => (
        <line key={i}
          x1={PAD_L} x2={SVG_W - PAD_R}
          y1={yOf(tick)} y2={yOf(tick)}
          stroke="#374151" strokeWidth={0.7} strokeDasharray="3 3"
        />
      ))}

      {/* 百分位帶：p5–p95（最寬，最透明）*/}
      <polygon points={polyPoints(p95vals, p5vals)}
        fill={color} fillOpacity={0.07} />
      {/* p25–p75（中間帶）*/}
      <polygon points={polyPoints(p75vals, p25vals)}
        fill={color} fillOpacity={0.12} />

      {/* 50 條模擬路徑（半透明）*/}
      {sample_paths.map((path, i) => (
        <path key={i} d={pathD(path)}
          stroke={color} strokeWidth={0.6} strokeOpacity={0.12} fill="none"
        />
      ))}

      {/* 中位數線（p50）*/}
      <path d={pathD(p50vals)}
        stroke={color} strokeWidth={1.8} fill="none" strokeOpacity={0.9}
      />

      {/* 起始價格水平參考線 */}
      <line
        x1={PAD_L} x2={SVG_W - PAD_R}
        y1={yOf(last_price)} y2={yOf(last_price)}
        stroke="#6b7280" strokeWidth={0.8} strokeDasharray="5 3"
      />

      {/* ── 右側 CI 標籤 ── */}
      {/* 90% CI 標籤（貼近 p95 帶頂部中點）*/}
      {(() => {
        const midIdx = Math.floor(bands.length / 2);
        const p95mid = bands[midIdx]?.p95;
        const p5mid  = bands[midIdx]?.p5;
        const p75mid = bands[midIdx]?.p75;
        const p25mid = bands[midIdx]?.p25;
        const p50mid = bands[midIdx]?.p50;
        const labelX = SVG_W - PAD_R + 6;
        if (!p95mid) return null;
        return (
          <>
            {/* 90% CI */}
            <text x={labelX} y={yOf(p95mid) + 4}
              fontSize={9} fill={color} fillOpacity={0.6} fontWeight="600">
              90%
            </text>
            <text x={labelX} y={yOf(p95mid) + 14}
              fontSize={8} fill="#6b7280">
              CI
            </text>
            {/* 50% CI */}
            <text x={labelX} y={yOf(p75mid) + 4}
              fontSize={9} fill={color} fillOpacity={0.85} fontWeight="600">
              50%
            </text>
            <text x={labelX} y={yOf(p75mid) + 14}
              fontSize={8} fill="#6b7280">
              CI
            </text>
            {/* Median 標籤 */}
            <text x={labelX} y={yOf(p50mid) + 4}
              fontSize={9} fill={color} fontWeight="700">
              Med.
            </text>
            {/* 5th pct 底部標籤 */}
            <text x={labelX} y={yOf(p5mid) + 4}
              fontSize={9} fill={color} fillOpacity={0.6} fontWeight="600">
              90%
            </text>
            <text x={labelX} y={yOf(p5mid) + 14}
              fontSize={8} fill="#6b7280">
              CI
            </text>
          </>
        );
      })()}

      {/* Y 軸刻度文字 */}
      {yTicks.map((tick, i) => (
        <text key={i}
          x={PAD_L - 6} y={yOf(tick) + 4}
          textAnchor="end" fontSize={10} fill="#9ca3af"
        >
          {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}
        </text>
      ))}

      {/* X 軸刻度 */}
      {xTicks.map((d) => (
        <text key={d}
          x={xOf(d)} y={SVG_H - PAD_B + 16}
          textAnchor="middle" fontSize={10} fill="#9ca3af"
        >
          {d === 0 ? "Today" : `+${d}d`}
        </text>
      ))}

      {/* X 軸標籤 */}
      <text x={PAD_L + CHART_W / 2} y={SVG_H - 4}
        textAnchor="middle" fontSize={10} fill="#6b7280">
        Forecast Day
      </text>

      {/* Y 軸邊框線 */}
      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + CHART_H}
        stroke="#4b5563" strokeWidth={0.8} />
    </svg>
  );
}

// ── 格式化價格 ────────────────────────────────────────────────────────────────
function fmtPrice(v: number) {
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function MonteCarloPanel() {
  const [sym,     setSym]     = useState("BTC");
  const [horizon, setHorizon] = useState<7 | 14 | 30>(30);
  const [result,  setResult]  = useState<McResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const fetchSimulation = useCallback(async (s: string, h: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/monte-carlo?symbol=${s}USDT&horizon=${h}&simulations=500`
      );
      const data: McResult = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入 + 參數變更時重新 fetch
  useEffect(() => {
    fetchSimulation(sym, horizon);
  }, [sym, horizon, fetchSimulation]);

  const color = SYMBOL_COLOR[sym];

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Monte Carlo Price Simulation</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            GARCH 波動率驅動 · Student-t 分佈 · 500 條模擬路徑
          </p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} How does this work?
        </button>
      </div>

      {/* ── 說明框 ── */}
      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                Monte Carlo simulation generates 500 possible future price paths by sampling random returns each day.
                Each return is drawn from a <strong className="text-white">Student-t distribution</strong> (fat tails),
                scaled by the <strong className="text-white">GARCH-forecast volatility</strong> for that day.
              </p>
              <p className="text-gray-400 text-xs">
                The <strong className="text-gray-300">shaded bands</strong> show where 50% (inner) and 90% (outer) of simulated prices fall.
                The <strong className="text-gray-300">bold line</strong> is the median path.
                This is a <em>probabilistic range</em>, not a price target.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                Monte Carlo 每天從 <strong className="text-white">Student-t 分佈</strong>（厚尾）抽取隨機回報，
                以 <strong className="text-white">GARCH 波動率預測值</strong>作為當天的波動尺度，生成 500 條可能的未來價格路徑。
              </p>
              <p className="text-gray-400 text-xs">
                <strong className="text-gray-300">陰影帶</strong>代表 50%（內帶）和 90%（外帶）的模擬路徑分佈範圍。
                <strong className="text-gray-300">粗線</strong>為中位數路徑。
                這是<em>概率性區間</em>，不是價格預測目標。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 篩選器列 ── */}
      <div className="flex flex-wrap items-center gap-4 mt-4 mb-5">
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

        {/* Horizon 選擇 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">Horizon</span>
          <div className="flex gap-1">
            {HORIZONS.map((h) => (
              <button key={h} onClick={() => setHorizon(h)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  horizon === h
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>

        {/* Re-run 按鈕 */}
        <button
          onClick={() => fetchSimulation(sym, horizon)}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 px-3 py-1 rounded-full transition-colors disabled:opacity-40"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span>
          Re-run
        </button>
      </div>

      {/* ── 圖表區 ── */}
      <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 mb-5 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-950/70 z-10">
            <span className="text-sm text-gray-400">Simulating…</span>
          </div>
        )}
        {result ? (
          <McChart result={result} color={color} />
        ) : (
          <div style={{ height: `${SVG_H}px` }} className="flex items-center justify-center text-gray-500 text-sm">
            Loading simulation…
          </div>
        )}
        <p className="text-center text-xs text-gray-500 mt-1">
          <strong className="text-gray-400">Bold line = Median path</strong>
          {" · "}Inner band = <strong className="text-gray-400">50% CI</strong> (25th–75th pct, half of all paths)
          {" · "}Outer band = <strong className="text-gray-400">90% CI</strong> (5th–95th pct, 9 out of 10 paths)
          {" · "}Dashed = entry price
        </p>
      </div>

      {/* ── 統計摘要卡片 ── */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Median Price (+{horizon}d)</p>
            <p className="text-base font-bold text-white">${fmtPrice(result.summary.median)}</p>
            <p className={`text-xs mt-0.5 font-medium ${result.summary.expected_return >= 0 ? "text-green-400" : "text-red-400"}`}>
              {result.summary.expected_return >= 0 ? "+" : ""}{result.summary.expected_return.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Prob. Above Entry</p>
            <p className="text-base font-bold text-white">
              {(result.summary.prob_up * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-0.5">of paths end higher</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Bearish Scenario (5th pct)</p>
            <p className="text-base font-bold text-red-400">${fmtPrice(result.summary.p5)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {((result.summary.p5 / result.last_price - 1) * 100).toFixed(1)}% from entry
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Bullish Scenario (95th pct)</p>
            <p className="text-base font-bold text-green-400">${fmtPrice(result.summary.p95)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {((result.summary.p95 / result.last_price - 1) * 100).toFixed(1)}% from entry
            </p>
          </div>
        </div>
      )}

      {/* ── 動態白話解讀 ── */}
      {result && (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-sm leading-relaxed">
          <p className="text-gray-300 font-semibold mb-1">
            How to read this · 如何解讀
          </p>
          <p className="text-gray-400 text-xs leading-relaxed">
            The <strong className="text-gray-200">bold line</strong> is the <strong className="text-gray-200">median path</strong> — half of the 500 simulated paths end above it, half below.
            It is <em>not</em> a price forecast or the most likely outcome; it is simply the midpoint of a wide distribution.
            {" "}The <strong className="text-gray-200">inner shaded band</strong> (50% CI) means 250 out of 500 paths stayed inside it at every day.
            {" "}The <strong className="text-gray-200">outer band</strong> (90% CI) contains 450 out of 500 paths — only extreme outliers fall outside.
          </p>
          <p className="text-gray-500 text-xs mt-2 leading-relaxed">
            粗線是<strong className="text-gray-300">中位數路徑</strong>——500 條模擬中一半高於它、一半低於它，並非「最可能」的走勢，只是分佈的中點。
            內帶（50% CI）代表 500 條中有 250 條每天都在這個範圍內；外帶（90% CI）包含 450 條。
            這是<strong className="text-gray-300">概率性區間，不是價格目標</strong>。
          </p>
          <p className="text-yellow-500/70 text-xs mt-2 leading-relaxed">
            ⓘ Each run samples 500 new random paths — summary numbers will vary slightly between runs and horizon changes. This is expected behaviour for a probabilistic model.
            {" "}· 每次模擬重新抽樣 500 條路徑，切換時間維度或點擊 Re-run 時數字會有輕微浮動，這是概率模型的正常現象。
          </p>
        </div>
      )}

      {/* ── 免責聲明 ── */}
      <p className="text-gray-600 text-xs mt-3 leading-relaxed">
        Simulations are based on GARCH-estimated volatility and historical drift. Results are probabilistic and do not constitute financial advice.
        Past volatility regimes may not persist. · 模擬結果基於歷史波動率，僅供研究參考，不構成投資建議。
      </p>
    </div>
  );
}
