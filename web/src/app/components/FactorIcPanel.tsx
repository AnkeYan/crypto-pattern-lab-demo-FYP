"use client";

// FactorIcPanel — Factor Information Coefficient Analysis
// Tab 1: IC Summary Table（各因子 IC / IC IR 統計）
// Tab 2: IC by Year（逐年走勢，Factor Decay 可視化）

import { useEffect, useState } from "react";

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

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            Factor IC Analysis · 因子預測力驗證
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            IC (Information Coefficient) measures each factor&apos;s correlation with 7-day returns ·
            IC 衡量各因子與 7 天後回報的統計相關性
          </p>
        </div>
        <div className="flex gap-1">
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
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 border-b border-zinc-800 pb-0">
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

      {/* 說明框 */}
      <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 mb-4 text-xs text-zinc-400 space-y-1">
        {tab === "summary" ? (
          <>
            <p>
              <span className="text-zinc-200 font-medium">IC（Information Coefficient）</span>
              {" "}= 因子值與 7 天後回報的 Spearman 相關係數。IC &gt; 0 表示因子值高時回報傾向正向，IC &lt; 0 表示反向。
            </p>
            <p>
              <span className="text-zinc-200 font-medium">IC IR（Information Ratio）</span>
              {" "}= IC 均值 ÷ IC 標準差，衡量穩定性。|IR| ≥ 1.0 = Strong；≥ 0.5 = Moderate；≥ 0.2 = Weak；其餘 = Noise。
            </p>
          </>
        ) : (
          <>
            <p>
              <span className="text-zinc-200 font-medium">Factor Decay（因子衰退）</span>
              {" "}= 一個因子的預測力隨時間變化。折線持續在 0 以上 = 穩定因子；忽上忽下 = 不穩定；整體下滑 = 衰退中。
            </p>
            <p>
              <span className="text-zinc-200 font-medium">怎麼看：</span>
              滑鼠懸停在圖例名稱上可單獨高亮某個因子。IC IR 括號內數字是跨年穩定性指標，愈高愈持久。
            </p>
            <p className="text-zinc-500">
              借鑑 WorldQuant：耐久型因子（MVRV、Turbulence）的 IC 跨年穩定；短暫型（Volume Surge）隨市場結構改變而衰退。
            </p>
          </>
        )}
      </div>

      {loading && <p className="text-zinc-500 text-sm">載入中…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && rows.length > 0 && (
        <>
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
