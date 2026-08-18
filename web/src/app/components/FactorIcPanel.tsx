"use client";

// FactorIcPanel — Factor Information Coefficient Analysis
// Tab 1: IC Summary Table（各因子 IC / IC IR 統計）
// Tab 2: IC by Year（逐年走勢，Factor Decay 可視化）

import { useEffect, useState, useMemo } from "react";

type IcRow = {
  symbol: string;
  factor: string;
  factor_name: string;
  mean_ic: string;
  std_ic: string;
  ic_ir: string;
  n_years: string;
  n_positive: string;
  rating: string;
  ic_by_year: string;
};

const SYMBOL_LABELS: Record<string, string> = {
  BTCUSDT: "BTC",
  ETHUSDT: "ETH",
  SOLUSDT: "SOL",
};

const RATING_STYLE: Record<string, { bar: string; badge: string }> = {
  Strong:   { bar: "bg-green-500",  badge: "bg-green-900 text-green-300" },
  Moderate: { bar: "bg-blue-500",   badge: "bg-blue-900 text-blue-300" },
  Weak:     { bar: "bg-yellow-500", badge: "bg-yellow-900 text-yellow-300" },
  Noise:    { bar: "bg-zinc-600",   badge: "bg-zinc-800 text-zinc-400" },
};

// 每個因子的折線顏色
const FACTOR_COLORS: Record<string, string> = {
  f1_cont:  "#f59e0b",
  f2_cont:  "#60a5fa",
  f5_cont:  "#34d399",
  f6_cont:  "#a78bfa",
  f7_cont:  "#fb923c",
  f8_cont:  "#f472b6",
  f9_cont:  "#facc15",
  f11_cont: "#4ade80",
  f12_cont: "#38bdf8",
  f13_cont: "#c084fc",
  f14_cont: "#f87171",
};

function fmt(v: string, decimals = 3): string {
  const n = parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function IcBar({ ic, ir }: { ic: number; ir: number }) {
  const rating =
    Math.abs(ir) >= 1.0 ? "Strong" :
    Math.abs(ir) >= 0.5 ? "Moderate" :
    Math.abs(ir) >= 0.2 ? "Weak" : "Noise";
  const { bar } = RATING_STYLE[rating];
  const pct = Math.min(Math.abs(ic) * 500, 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      {ic < 0 && (
        <div className="flex justify-end" style={{ width: "50%" }}>
          <div className={`h-2 rounded-sm ${bar} opacity-70`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {ic >= 0 && <div style={{ width: "50%" }} />}
      <div className="w-px h-3 bg-zinc-600" />
      {ic >= 0 && (
        <div style={{ width: "50%" }}>
          <div className={`h-2 rounded-sm ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {ic < 0 && <div style={{ width: "50%" }} />}
    </div>
  );
}

// 把 ic_by_year JSON string 解析成 { year: string, ic: number }[]
function parseIcByYear(raw: string): { year: string; ic: number }[] {
  try {
    const obj: Record<string, number> = JSON.parse(raw);
    return Object.entries(obj)
      .map(([year, ic]) => ({ year, ic }))
      .sort((a, b) => a.year.localeCompare(b.year));
  } catch {
    return [];
  }
}

// 迷你折線 SVG（單因子）
function SparkLine({
  points, color, width = 80, height = 28,
}: { points: { year: string; ic: number }[]; color: string; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.ic);
  const min = Math.min(...vals, -0.05);
  const max = Math.max(...vals, 0.05);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const toX = (i: number) => pad + (i / (points.length - 1)) * w;
  const toY = (v: number) => pad + h - ((v - min) / range) * h;
  const zeroY = toY(0);
  const pts = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.ic).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={pad} y1={zeroY.toFixed(1)} x2={pad + w} y2={zeroY.toFixed(1)}
        stroke="#52525b" strokeWidth="0.6" strokeDasharray="2,2" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// 完整多因子折線圖（IC by Year chart）
function IcByYearChart({ rows }: { rows: IcRow[] }) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  // 收集所有年份
  const allYears = Array.from(new Set(
    rows.flatMap((r) => parseIcByYear(r.ic_by_year).map((p) => p.year))
  )).sort();

  if (allYears.length < 2) return <p className="text-zinc-500 text-xs">數據不足</p>;

  const W = 560, H = 200;
  const padL = 36, padR = 12, padT = 12, padB = 24;
  const w = W - padL - padR;
  const h = H - padT - padB;

  // 所有 IC 值範圍
  const allIcValues = rows.flatMap((r) => parseIcByYear(r.ic_by_year).map((p) => p.ic));
  const minV = Math.min(...allIcValues, -0.15);
  const maxV = Math.max(...allIcValues, 0.15);
  const range = maxV - minV || 1;

  const toX = (year: string) => {
    const i = allYears.indexOf(year);
    return padL + (i / (allYears.length - 1)) * w;
  };
  const toY = (ic: number) => padT + h - ((ic - minV) / range) * h;

  const zeroY = toY(0);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="text-zinc-400">

        {/* Zero line */}
        <line x1={padL} y1={zeroY.toFixed(1)} x2={padL + w} y2={zeroY.toFixed(1)}
          stroke="#52525b" strokeWidth="0.8" strokeDasharray="4,3" />
        <text x={padL - 4} y={(zeroY + 4).toFixed(1)} textAnchor="end"
          fontSize="8" fill="#71717a">0</text>

        {/* Y axis labels */}
        {[0.1, 0.2, -0.1, -0.2].map((v) => {
          const y = toY(v);
          if (y < padT || y > padT + h) return null;
          return (
            <g key={v}>
              <line x1={padL - 2} y1={y.toFixed(1)} x2={padL + w} y2={y.toFixed(1)}
                stroke="#3f3f46" strokeWidth="0.4" />
              <text x={padL - 4} y={(y + 4).toFixed(1)} textAnchor="end"
                fontSize="8" fill="#71717a">{v > 0 ? "+" : ""}{v.toFixed(1)}</text>
            </g>
          );
        })}

        {/* X axis year labels */}
        {allYears.map((year) => (
          <text key={year} x={toX(year).toFixed(1)} y={padT + h + 14}
            textAnchor="middle" fontSize="8" fill="#71717a">
            {year}
          </text>
        ))}

        {/* Factor lines */}
        {rows.map((r) => {
          const pts = parseIcByYear(r.ic_by_year);
          const isHigh = highlighted === null || highlighted === r.factor;
          const color = FACTOR_COLORS[r.factor] ?? "#94a3b8";
          const linePoints = pts
            .filter((p) => allYears.includes(p.year))
            .map((p) => `${toX(p.year).toFixed(1)},${toY(p.ic).toFixed(1)}`)
            .join(" ");
          return (
            <polyline
              key={r.factor}
              points={linePoints}
              fill="none"
              stroke={color}
              strokeWidth={highlighted === r.factor ? 2 : 1.2}
              opacity={isHigh ? 1 : 0.15}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHighlighted(r.factor)}
              onMouseLeave={() => setHighlighted(null)}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {rows.map((r) => {
          const color = FACTOR_COLORS[r.factor] ?? "#94a3b8";
          const ir = parseFloat(r.ic_ir);
          return (
            <button
              key={r.factor}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${
                highlighted === null || highlighted === r.factor ? "opacity-100" : "opacity-30"
              }`}
              onMouseEnter={() => setHighlighted(r.factor)}
              onMouseLeave={() => setHighlighted(null)}
            >
              <span className="w-5 h-0.5 inline-block rounded" style={{ backgroundColor: color }} />
              <span className="text-zinc-400">{r.factor_name.replace(/^F\d+ /, "")}</span>
              <span className={`text-xs ${Math.abs(ir) >= 1 ? "text-green-400" : Math.abs(ir) >= 0.5 ? "text-blue-400" : "text-zinc-600"}`}>
                ({ir >= 0 ? "+" : ""}{ir.toFixed(2)})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FactorIcPanel() {
  const [data, setData] = useState<IcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tab, setTab] = useState<"summary" | "decay">("summary");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/factor-ic")
      .then((r) => r.json())
      .then((d) => {
        setData(d.rows ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("無法載入 Factor IC 數據");
        setLoading(false);
      });
  }, []);

  const rows = data
    .filter((r) => r.symbol === symbol)
    .sort((a, b) => Math.abs(parseFloat(b.ic_ir)) - Math.abs(parseFloat(a.ic_ir)));

  const strongCount = rows.filter((r) => r.rating === "Strong" || r.rating === "Moderate").length;

  // ── 動態解說 ──────────────────────────────────────────────────────────────────
  const insight = useMemo(() => {
    if (rows.length === 0) return null;
    const top = rows[0];
    const strongRows  = rows.filter(r => r.rating === "Strong");
    const noiseRows   = rows.filter(r => r.rating === "Noise");
    const symLabel    = SYMBOL_LABELS[symbol];
    const topIr       = parseFloat(top.ic_ir);
    const topIc       = parseFloat(top.mean_ic);
    const topName     = top.factor_name.replace(/^F\d+ /, "");

    if (strongRows.length >= 2) {
      const names = strongRows.map(r => r.factor_name.replace(/^F\d+ /, "")).join(", ");
      return {
        border: "border-green-500/30", bg: "bg-green-500/5", icon: "✓", titleColor: "text-green-400",
        title: `${strongRows.length} Strong factor${strongRows.length > 1 ? "s" : ""} found · 發現強力因子`,
        en: `For ${symLabel}, ${strongRows.length} factors show strong and consistent predictive power (|IC IR| ≥ 1.0): ${names}. The top factor is ${topName} with IC IR = ${topIr >= 0 ? "+" : ""}${topIr.toFixed(2)} and mean IC = ${topIc >= 0 ? "+" : ""}${topIc.toFixed(4)}. These factors maintain above-zero IC across most years — a sign of durable, non-regime-dependent signal.`,
        zh: `${symLabel} 有 ${strongRows.length} 個因子預測力強且穩定（|IC IR| ≥ 1.0）：${names}。表現最佳的是 ${topName}，IC IR = ${topIr >= 0 ? "+" : ""}${topIr.toFixed(2)}，均值 IC = ${topIc >= 0 ? "+" : ""}${topIc.toFixed(4)}。這些因子跨年 IC 持續為正，說明預測力耐久、不依賴單一牛熊環境。`,
      };
    }
    if (strongRows.length === 1) {
      return {
        border: "border-blue-500/30", bg: "bg-blue-500/5", icon: "~", titleColor: "text-blue-400",
        title: `1 Strong factor found · 發現 1 個強力因子`,
        en: `For ${symLabel}, only ${topName} shows strong predictive power (IC IR = ${topIr >= 0 ? "+" : ""}${topIr.toFixed(2)}). Most other factors are Weak or Noise — their IC is near zero or unstable across years. This suggests the factor structure for ${symLabel} is concentrated in a single driver.`,
        zh: `${symLabel} 只有 ${topName} 表現出強力預測力（IC IR = ${topIr >= 0 ? "+" : ""}${topIr.toFixed(2)}）。大部分其他因子屬於 Weak 或 Noise，IC 接近 0 或跨年不穩定。說明 ${symLabel} 的因子結構集中在單一驅動力。`,
      };
    }
    return {
      border: "border-gray-700", bg: "bg-white/[0.03]", icon: "–", titleColor: "text-gray-400",
      title: `No strong factors · 暫無強力因子`,
      en: `For ${symLabel}, no factor currently shows strong IC IR (≥ 1.0). The highest is ${topName} at IC IR = ${topIr >= 0 ? "+" : ""}${topIr.toFixed(2)}. ${noiseRows.length > 0 ? `${noiseRows.length} factor${noiseRows.length > 1 ? "s" : ""} are classified as Noise (|IR| < 0.2). ` : ""}This does not mean these factors are useless — in multi-factor combinations, weak signals can still contribute diversification value.`,
      zh: `${symLabel} 目前沒有因子達到強力 IC IR（≥ 1.0）。最高的是 ${topName}，IC IR = ${topIr >= 0 ? "+" : ""}${topIr.toFixed(2)}。${noiseRows.length > 0 ? `有 ${noiseRows.length} 個因子屬於 Noise（|IR| < 0.2）。` : ""}這不代表這些因子沒用——在多因子組合中，弱信號仍可提供分散化價值。`,
    };
  }, [rows, symbol]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            Factor IC Analysis · 因子預測力驗證
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            IC (Information Coefficient) measures each factor&apos;s correlation with 7-day returns ·
            IC 衡量各因子與 7 天後回報的統計相關性
          </p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-xs text-gray-500 hover:text-gray-300 whitespace-nowrap ml-4 mt-1">
          {open ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {/* Symbol tabs */}
      <div className="flex gap-1 mt-3">
        {(["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              symbol === s
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {SYMBOL_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Explainer */}
      {open && (
        <div className="mb-4 mt-3 rounded-lg border border-gray-800 bg-white/[0.03] p-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: which factors actually predict 7-day returns — and how consistently?</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-gray-300">IC (Information Coefficient)</strong> is the Spearman rank correlation between a factor&apos;s value and the subsequent 7-day return. IC &gt; 0 means higher factor values tend to precede positive returns; IC &lt; 0 means the opposite.
              </p>
              <p className="text-gray-400 mb-3">
                <strong className="text-gray-300">IC IR (Information Ratio)</strong> = mean IC ÷ std IC, measuring consistency across years. A high IR means the factor predicts reliably, not just in certain bull or bear years.
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Rating thresholds</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <span className="text-green-400 font-medium">Strong</span> — |IC IR| ≥ 1.0. Durable, reliable signal.</li>
                <li>• <span className="text-blue-400 font-medium">Moderate</span> — |IC IR| ≥ 0.5. Useful but less consistent.</li>
                <li>• <span className="text-yellow-400 font-medium">Weak</span> — |IC IR| ≥ 0.2. Small edge, use with caution.</li>
                <li>• <span className="text-zinc-500 font-medium">Noise</span> — |IC IR| &lt; 0.2. No consistent predictive power.</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：哪些因子真的能預測 7 天後的回報？預測力有多穩定？</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-gray-300">IC（信息係數）</strong>= 因子值與 7 天後回報的 Spearman 排名相關係數。IC &gt; 0 代表因子值高時回報傾向正向，IC &lt; 0 代表反向。
              </p>
              <p className="text-gray-400 mb-3">
                <strong className="text-gray-300">IC IR（信息比率）</strong>= IC 均值 ÷ IC 標準差，衡量跨年穩定性。IR 高 = 因子在牛熊不同市況下都能穩定預測，不只是「某年剛好靈」。
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">評級標準</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>• <span className="text-green-400 font-medium">Strong</span> — |IC IR| ≥ 1.0，耐久型強力因子</li>
                <li>• <span className="text-blue-400 font-medium">Moderate</span> — |IC IR| ≥ 0.5，有用但穩定性中等</li>
                <li>• <span className="text-yellow-400 font-medium">Weak</span> — |IC IR| ≥ 0.2，邊緣優勢，謹慎使用</li>
                <li>• <span className="text-zinc-500 font-medium">Noise</span> — |IC IR| &lt; 0.2，無持續預測力</li>
              </ul>
              <p className="text-gray-600 text-xs mt-3">
                IC 接近 0 的因子（如 RSI、Bollinger）並非「無用」——在 Regime 篩選、多因子組合中仍可提供互補信息。
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600">
            <p><strong className="text-gray-500">IC by Year tab：</strong>Factor Decay 可視化——折線持續在 0 以上 = 耐久因子；忽上忽下 = 不穩定；整體下滑 = 衰退中。滑鼠懸停圖例可高亮單一因子。</p>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800 pb-0 mt-3">
        {([
          { key: "summary", label: "IC Summary" },
          { key: "decay",   label: "IC by Year · Factor Decay" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors -mb-px border-b-2 ${
              tab === key
                ? "text-zinc-100 border-zinc-300"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>


      {loading && <p className="text-zinc-500 text-sm">載入中…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Dynamic insight */}
          {insight && (
            <div className={`rounded-lg border ${insight.border} ${insight.bg} px-4 py-3 text-sm mb-4`}>
              <div className={`font-medium mb-2 ${insight.titleColor}`}>{insight.icon} {insight.title}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <p className="text-gray-300 text-sm">{insight.en}</p>
                <p className="text-gray-500 text-sm">{insight.zh}</p>
              </div>
            </div>
          )}

          {tab === "summary" && (
            <>
              {/* 摘要 */}
              <div className="flex gap-4 mb-4 text-xs">
                <div className="rounded-lg bg-zinc-800 px-3 py-2">
                  <div className="text-zinc-500">Strong / Moderate 因子</div>
                  <div className="text-zinc-100 font-semibold text-sm mt-0.5">
                    {strongCount} / {rows.length}
                  </div>
                </div>
                <div className="rounded-lg bg-zinc-800 px-3 py-2">
                  <div className="text-zinc-500">最高 IC IR</div>
                  <div className="text-zinc-100 font-semibold text-sm mt-0.5">
                    {rows[0] ? `${rows[0].factor_name.split(" ").slice(0, 2).join(" ")} (${fmt(rows[0].ic_ir)})` : "—"}
                  </div>
                </div>
              </div>

              {/* 表格 */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-2 pr-3 font-medium w-40">Factor</th>
                      <th className="text-right py-2 px-2 font-medium">Mean IC</th>
                      <th className="text-right py-2 px-2 font-medium">IC IR</th>
                      <th className="text-left py-2 px-2 font-medium w-48">IC Bar</th>
                      <th className="text-right py-2 px-2 font-medium">+Yrs / Total</th>
                      <th className="text-left py-2 pl-2 font-medium">Rating</th>
                      <th className="text-left py-2 pl-3 font-medium">Year Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const ic = parseFloat(r.mean_ic);
                      const ir = parseFloat(r.ic_ir);
                      const { badge } = RATING_STYLE[r.rating] ?? RATING_STYLE.Noise;
                      const color = FACTOR_COLORS[r.factor] ?? "#94a3b8";
                      const yearPts = parseIcByYear(r.ic_by_year);
                      return (
                        <tr key={r.factor} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="py-2 pr-3 text-zinc-300 font-medium">{r.factor_name}</td>
                          <td className={`py-2 px-2 text-right tabular-nums ${ic > 0.01 ? "text-green-400" : ic < -0.01 ? "text-red-400" : "text-zinc-500"}`}>
                            {ic >= 0 ? "+" : ""}{fmt(r.mean_ic, 4)}
                          </td>
                          <td className={`py-2 px-2 text-right tabular-nums font-semibold ${Math.abs(ir) >= 1.0 ? "text-green-400" : Math.abs(ir) >= 0.5 ? "text-blue-400" : "text-zinc-500"}`}>
                            {ir >= 0 ? "+" : ""}{fmt(r.ic_ir, 3)}
                          </td>
                          <td className="py-2 px-2">
                            <IcBar ic={ic} ir={ir} />
                          </td>
                          <td className="py-2 px-2 text-right text-zinc-400 tabular-nums">
                            {r.n_positive}/{r.n_years}
                          </td>
                          <td className="py-2 pl-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge}`}>
                              {r.rating}
                            </span>
                          </td>
                          <td className="py-2 pl-3">
                            <SparkLine points={yearPts} color={color} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "decay" && (
            <div className="space-y-3">
              <IcByYearChart rows={rows} />
            </div>
          )}

          {/* 底部解讀 */}
          <div className="mt-4 text-xs text-zinc-500 space-y-1 border-t border-zinc-800 pt-3">
            <p>
              IC 以逐年 Spearman 相關係數計算（{rows[0]?.n_years ?? "—"} 年），避免不同市場 regime 的混淆效應。
              IC IR = 跨年均值 ÷ 標準差，數值愈高代表因子預測力愈穩定、不依賴單一牛熊市場。
            </p>
            <p>
              注意：IC 接近 0 的因子（如 RSI、Bollinger）並非「無用」——在 Regime 篩選、多因子組合中仍可提供互補信息。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
