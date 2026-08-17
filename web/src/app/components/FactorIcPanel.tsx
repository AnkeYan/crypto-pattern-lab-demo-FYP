"use client";

// FactorIcPanel — Factor Information Coefficient Analysis
// 展示各因子與 7 天後回報的統計相關性（IC）及穩定性（IC IR）

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

function fmt(v: string, decimals = 3): string {
  const n = parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function IcBar({ ic, ir }: { ic: number; ir: number }) {
  // 以 IC IR 決定顏色，IC 決定方向和長度
  const rating =
    Math.abs(ir) >= 1.0 ? "Strong" :
    Math.abs(ir) >= 0.5 ? "Moderate" :
    Math.abs(ir) >= 0.2 ? "Weak" : "Noise";
  const { bar } = RATING_STYLE[rating];
  const pct = Math.min(Math.abs(ic) * 500, 100); // IC 0.20 = 100%
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

export default function FactorIcPanel() {
  const [data, setData] = useState<IcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [symbol, setSymbol] = useState("BTCUSDT");

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
        {/* Symbol selector */}
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

      {/* 說明框 */}
      <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-3 mb-4 text-xs text-zinc-400 space-y-1">
        <p>
          <span className="text-zinc-200 font-medium">IC（Information Coefficient）</span>
          {" "}= 因子值與 7 天後回報的 Spearman 相關係數。IC &gt; 0 表示因子值高時回報傾向正向，IC &lt; 0 表示反向。
        </p>
        <p>
          <span className="text-zinc-200 font-medium">IC IR（Information Ratio）</span>
          {" "}= IC 均值 ÷ IC 標準差，衡量穩定性。|IR| ≥ 1.0 = Strong（跨年穩定）；≥ 0.5 = Moderate；≥ 0.2 = Weak；其餘 = Noise（統計上不可靠）。
        </p>
        <p className="text-zinc-500">
          如果一個因子的 IC 接近 0、IR 接近 0，說明它跟未來回報沒有統計關聯——但它仍可能作為風險過濾器或 regime 指標有意義。
        </p>
      </div>

      {loading && <p className="text-zinc-500 text-sm">載入中…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && rows.length > 0 && (
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
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ic = parseFloat(r.mean_ic);
                  const ir = parseFloat(r.ic_ir);
                  const { badge } = RATING_STYLE[r.rating] ?? RATING_STYLE.Noise;
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 底部解讀 */}
          <div className="mt-4 text-xs text-zinc-500 space-y-1 border-t border-zinc-800 pt-3">
            <p>
              IC 以逐年 Spearman 相關係數計算（{rows[0]?.n_years ?? "—"} 年），避免不同市場 regime 的混淆效應。
              IC IR = 跨年均值 ÷ 標準差，數值愈高代表因子預測力愈穩定、不依賴單一牛熊市場。
            </p>
            <p>
              注意：IC 接近 0 的因子（如 RSI、Bollinger）並非「無用」——它們在 Regime 篩選、多因子組合中仍可提供互補信息。
              單因子 IC 只是其中一個維度的評估。
            </p>
          </div>
        </>
      )}
    </section>
  );
}
