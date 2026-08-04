"use client";

// 這個檔案負責：ACF / PACF 自相關圖 + Ljung-Box 白噪聲檢定
// 放在 Validation workspace，用於說明 return 序列的自相關結構
// 圖表用純 SVG 繪製，不依賴 recharts

import { useMemo, useState } from "react";

type AcfRow = {
  symbol: string;
  type: string;      // "acf" | "pacf"
  lag: number | null;
  value: number | null;
  ci_upper: number | null;
  ci_lower: number | null;
};

type LjungBoxRow = {
  symbol: string;
  lag: number | null;
  lb_stat: number | null;
  lb_pvalue: number | null;
};

// ── 常數 ──────────────────────────────────────────────────────────────────────
const SYMBOLS = ["BTC", "ETH", "SOL"];
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

// SVG 圖表尺寸常數
const SVG_W        = 640;
const SVG_H        = 220;
const PAD_L        = 42;
const PAD_R        = 16;
const PAD_T        = 16;
const PAD_B        = 36;
const CHART_W      = SVG_W - PAD_L - PAD_R;
const CHART_H      = SVG_H - PAD_T - PAD_B;
const Y_DOMAIN     = 0.22;   // y 軸顯示範圍 ±0.22
const MAX_LAGS     = 30;

// ── SVG ACF 圖 ────────────────────────────────────────────────────────────────
function AcfChart({
  rows,
  ciUpper,
  color,
}: {
  rows: AcfRow[];
  ciUpper: number;
  color: string;
}) {
  if (rows.length === 0) return null;

  function xOf(lag: number) {
    const step = CHART_W / MAX_LAGS;
    return PAD_L + (lag - 0.5) * step;
  }
  function yOf(v: number) {
    return PAD_T + CHART_H / 2 - (v / Y_DOMAIN) * (CHART_H / 2);
  }

  const barW    = (CHART_W / MAX_LAGS) * 0.5;
  const yZero   = yOf(0);
  const yCiUp   = yOf(ciUpper);
  const yCiDown = yOf(-ciUpper);

  const yTicks = [-0.2, -0.1, 0, 0.1, 0.2];

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full"
      style={{ maxHeight: `${SVG_H}px` }}
    >
      {/* 背景格線 */}
      {yTicks.map((tick) => (
        <line
          key={tick}
          x1={PAD_L}
          x2={SVG_W - PAD_R}
          y1={yOf(tick)}
          y2={yOf(tick)}
          stroke="#374151"
          strokeWidth={tick === 0 ? 1.2 : 0.7}
          strokeDasharray={tick === 0 ? "none" : "3 3"}
        />
      ))}

      {/* 信賴區間帶（淺色填充）*/}
      <rect
        x={PAD_L}
        y={yCiUp}
        width={CHART_W}
        height={yCiDown - yCiUp}
        fill={color}
        fillOpacity={0.07}
      />
      {/* 信賴區間上下邊線 */}
      <line x1={PAD_L} x2={SVG_W - PAD_R} y1={yCiUp}   y2={yCiUp}   stroke={color} strokeWidth={0.8} strokeDasharray="4 3" strokeOpacity={0.6} />
      <line x1={PAD_L} x2={SVG_W - PAD_R} y1={yCiDown} y2={yCiDown} stroke={color} strokeWidth={0.8} strokeDasharray="4 3" strokeOpacity={0.6} />

      {/* Bars */}
      {rows.map((row) => {
        if (row.lag == null || row.value == null) return null;
        const x      = xOf(row.lag) - barW / 2;
        const isUp   = row.value >= 0;
        const yTop   = isUp ? yOf(row.value) : yZero;
        const height = Math.abs(yOf(row.value) - yZero);
        const outside = Math.abs(row.value) > ciUpper;
        const fill   = outside ? color : "#4b5563";
        return (
          <rect
            key={row.lag}
            x={x}
            y={yTop}
            width={barW}
            height={Math.max(height, 1)}
            fill={fill}
            fillOpacity={outside ? 0.9 : 0.55}
            rx={1}
          />
        );
      })}

      {/* Y 軸刻度文字 */}
      {yTicks.map((tick) => (
        <text
          key={tick}
          x={PAD_L - 6}
          y={yOf(tick) + 4}
          textAnchor="end"
          fontSize={10}
          fill="#9ca3af"
        >
          {tick.toFixed(1)}
        </text>
      ))}

      {/* X 軸刻度：每 5 個 lag 一個 */}
      {[5, 10, 15, 20, 25, 30].map((lag) => (
        <text
          key={lag}
          x={xOf(lag)}
          y={SVG_H - PAD_B + 18}
          textAnchor="middle"
          fontSize={10}
          fill="#9ca3af"
        >
          {lag}
        </text>
      ))}

      {/* X 軸標籤 */}
      <text
        x={PAD_L + CHART_W / 2}
        y={SVG_H - 2}
        textAnchor="middle"
        fontSize={10}
        fill="#6b7280"
      >
        Lag (days)
      </text>

      {/* Y 軸邊框線 */}
      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + CHART_H} stroke="#4b5563" strokeWidth={0.8} />
    </svg>
  );
}

// ── Ljung-Box 解讀 ────────────────────────────────────────────────────────────
function lbInterpret(pvalue: number | null): { label: string; color: string; zh: string } {
  if (pvalue === null) return { label: "—", color: "text-gray-400", zh: "—" };
  if (pvalue < 0.01) return {
    label: "Highly significant",
    color: "text-red-400",
    zh: "高度顯著（序列非白噪聲）",
  };
  if (pvalue < 0.05) return {
    label: "Significant",
    color: "text-orange-400",
    zh: "顯著（p < 0.05）",
  };
  if (pvalue < 0.1) return {
    label: "Marginal",
    color: "text-yellow-400",
    zh: "邊際顯著（p < 0.1）",
  };
  return {
    label: "Not significant",
    color: "text-green-400",
    zh: "不顯著（接近白噪聲）",
  };
}

// ── 動態 Key Takeaway ──────────────────────────────────────────────────────────
function buildTakeaway(
  sym: string,
  viewType: "acf" | "pacf",
  significantCount: number,
  lbRows: LjungBoxRow[]
) {
  const lb1  = lbRows.find((r) => r.lag === 1);
  const lb5  = lbRows.find((r) => r.lag === 5);
  const lb10 = lbRows.find((r) => r.lag === 10);
  const lb1p  = lb1?.lb_pvalue ?? null;
  const lb5p  = lb5?.lb_pvalue ?? null;
  const lb10p = lb10?.lb_pvalue ?? null;

  // 判斷短期（lag1/5）vs 中期（lag10）是否顯著
  const shortTermSig = (lb1p !== null && lb1p < 0.05) || (lb5p !== null && lb5p < 0.05);
  const midTermSig   = lb10p !== null && lb10p < 0.05;

  let border = "border-gray-700";
  let bg = "bg-white/[0.03]";
  let icon = "~";
  let enSummary = "";
  let zhSummary = "";
  let enDetail = "";
  let zhDetail = "";

  if (significantCount === 0 || (!shortTermSig && !midTermSig)) {
    // 純白噪聲 / 近似白噪聲
    border = "border-green-500/30";
    bg = "bg-green-500/5";
    icon = "✓";
    enSummary = `${sym}'s daily returns are close to a random walk — no significant autocorrelation found across all ${MAX_LAGS} lags tested.`;
    enDetail = `What this means for trading: strategies that try to predict tomorrow's direction based purely on past price moves (e.g. "it went up 3 days in a row, so it'll go up again") have very weak statistical backing for ${sym}. Each day is largely independent.`;
    zhSummary = `${sym} 的日回報接近隨機漫步——${MAX_LAGS} 個 lag 中均無顯著自相關。`;
    zhDetail = `對交易的意義：純粹根據過去漲跌預測明天方向的策略（例如「連漲三天所以明天也會漲」），在 ${sym} 上的統計支持很弱。每天基本上都是獨立事件。`;
  } else if (shortTermSig) {
    // 短期（1-5天）顯著 → 有動量/均值回歸潛力
    border = "border-yellow-500/30";
    bg = "bg-yellow-500/5";
    icon = "⚠";
    enSummary = `${sym} shows statistically significant short-term autocorrelation (lag 1–5 significant). This means yesterday's return has some detectable relationship with today's.`;
    enDetail = `What this means for trading: there is a measurable short-term pattern, but the correlation coefficient is typically very small (< 0.1). In theory this could support very short-term momentum or mean-reversion strategies — but after transaction costs, this edge is extremely difficult to profit from in practice. Do not overinterpret "statistically significant" as "easy to trade."`;
    zhSummary = `${sym} 存在統計顯著的短期自相關（lag 1–5 顯著）。昨天的漲跌對今天有一定可偵測的關聯。`;
    zhDetail = `對交易的意義：存在可測量的短期規律，但相關係數通常非常小（< 0.1）。理論上可支持超短線動量或均值回歸策略，但考慮交易成本後這個優勢極難轉化為實際獲利。「統計顯著」不等於「容易交易」。`;
  } else {
    // 只有中期（lag10）顯著，短期不顯著 → BTC 的典型情況
    border = "border-yellow-500/30";
    bg = "bg-yellow-500/5";
    icon = "⚠";
    enSummary = `${sym} shows no significant short-term autocorrelation (lag 1–5 not significant), but some mid-term structure appears at lag 10 (Ljung-Box p ≈ ${lb10p?.toFixed(3) ?? "—"}).`;
    enDetail = `What this means for trading: the next 1–5 days are largely unpredictable from past returns alone — short-term momentum or mean-reversion strategies have weak statistical support. The mid-term signal at lag 10 is statistically detectable but the magnitude is small. This pattern is consistent with a near-efficient market where simple pattern-following strategies struggle to beat costs.`;
    zhSummary = `${sym} 短期（lag 1–5）自相關不顯著，但中期（lag 10）有一定結構（Ljung-Box p ≈ ${lb10p?.toFixed(3) ?? "—"}）。`;
    zhDetail = `對交易的意義：未來 1–5 天的走向單純從過去回報來看基本上難以預測，短線動量或均值回歸策略的統計支持偏弱。lag 10 的中期信號雖然統計上可偵測，但係數很小。這與「近似有效市場」的結論一致——簡單規律跟蹤策略難以在扣除成本後獲利。`;
  }

  return { border, bg, icon, enSummary, zhSummary, enDetail, zhDetail };
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function AcfPanel({
  acfData,
  lbData,
}: {
  acfData: AcfRow[];
  lbData: LjungBoxRow[];
}) {
  const [sym,      setSym]      = useState("BTC");
  const [viewType, setViewType] = useState<"acf" | "pacf">("acf");
  const [showInfo, setShowInfo] = useState(false);

  const symKey = `${sym}USDT`;

  const rows = acfData.filter((r) => r.symbol === symKey && r.type === viewType);
  const ciUpper = rows[0]?.ci_upper ?? 0.035;

  const significantCount = rows.filter(
    (r) => r.value != null && Math.abs(r.value) > ciUpper
  ).length;

  const lbRows = lbData.filter((r) => r.symbol === symKey && [1, 5, 10, 20].includes(r.lag ?? -1));
  const color = SYMBOL_COLOR[sym];

  const takeaway = useMemo(
    () => buildTakeaway(sym, viewType, significantCount, lbRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sym, viewType, significantCount, lbRows.length]
  );

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* ── 標題列 ── */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Return Autocorrelation (ACF / PACF)</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            日對數回報序列的自相關結構分析 · 用於評估 random walk 假設
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
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* English */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: does yesterday's price move tell us anything about today's? Or is each day essentially a fresh coin flip?</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-white">ACF (Autocorrelation Function)</strong> measures how much today's return is correlated with returns from N days ago.
                Think of it like checking whether rainy days tend to cluster together — if today is rainy, does that predict tomorrow?
              </p>
              <p className="text-gray-400 mb-3">
                If all bars stay <strong className="text-white">inside the shaded band</strong>, the answer is no — the market behaves like a random walk and past returns carry no useful signal. Bars <strong className="text-white">outside the band</strong> suggest some predictable structure exists.
              </p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What do the terms mean?</p>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-gray-200">ACF</strong> — measures correlation between today and N days ago, including indirect effects through intermediate days.</li>
                <li><strong className="text-gray-200">PACF</strong> — like ACF but removes indirect correlations. Shows only the direct relationship between today and lag N, controlling for everything in between.</li>
                <li><strong className="text-gray-200">95% CI band</strong> — the shaded zone (±1.96/√n). Bars inside are statistically indistinguishable from zero.</li>
                <li><strong className="text-gray-200">Ljung-Box test</strong> — formally tests whether all autocorrelations up to lag k are jointly zero. Low p-value (p &lt; 0.05) means the series is not pure white noise.</li>
                <li><strong className="text-gray-200">⚠ Important</strong> — statistical significance ≠ economic significance. Even a "significant" autocorrelation of 0.05 is too small to trade profitably after costs.</li>
              </ul>
            </div>

            {/* 中文 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：昨天的漲跌能預測今天嗎？還是每天基本上都是全新的隨機結果？</em>
              </p>
              <p className="text-gray-400 mb-2">
                <strong className="text-white">ACF（自相關函數）</strong>測量今日回報與 N 天前回報的相關程度。
                就像查看下雨天是否有連續性——今天下雨，明天更可能也下雨嗎？
              </p>
              <p className="text-gray-400 mb-3">
                如果所有 bars 都在<strong className="text-white">陰影帶內</strong>，答案是否——市場接近隨機漫步，過去回報沒有預測價值。<strong className="text-white">超出陰影帶的 bar</strong> 則暗示存在某種可預測的結構。
              </p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">各術語說明</p>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-gray-200">ACF</strong> — 測量今日與 N 天前的相關，包含透過中間日期的間接效應。</li>
                <li><strong className="text-gray-200">PACF</strong> — 剔除間接相關後的純直接效應，控制中間所有 lag 的影響後，今天與 N 天前的直接關係。</li>
                <li><strong className="text-gray-200">95% CI 帶</strong> — 陰影區域（±1.96/√n）。帶內的 bar 在統計上與零無異。</li>
                <li><strong className="text-gray-200">Ljung-Box 檢定</strong> — 正式檢驗所有 lag 的自相關係數是否聯合為零。p 值低（p &lt; 0.05）代表序列不是純白噪聲。</li>
                <li><strong className="text-gray-200">⚠ 重要</strong> — 統計顯著 ≠ 實際可用。即使自相關係數達到 0.05 的「顯著」水平，考慮交易成本後也難以獲利。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── 篩選器列 ── */}
      <div className="flex flex-wrap items-center gap-4 mt-4 mb-4">
        {/* 幣種 tabs */}
        <div className="flex gap-1 border-b border-gray-700">
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

        {/* ACF / PACF 切換 */}
        <div className="flex gap-1">
          {(["acf", "pacf"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setViewType(t)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors uppercase tracking-wide ${
                viewType === t
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 顯著 lag 統計 */}
        <span className="text-xs text-gray-500 ml-auto">
          <span className={significantCount > 0 ? "text-yellow-400" : "text-green-400"}>
            {significantCount}
          </span>
          {" "}/ {MAX_LAGS} lags outside 95% CI
        </span>
      </div>

      {/* ── 條件說明行 ── */}
      <div className="mb-5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
        <span className="text-gray-400">Showing: </span>
        <span className="text-white font-medium">{sym} daily log-returns</span>
        <span className="text-gray-400"> — how much does today's return correlate with </span>
        <span className="text-white font-medium">{viewType === "acf" ? "past N days" : "each specific lag directly"}</span>
        <span className="text-gray-400">? ({viewType.toUpperCase()} up to lag {MAX_LAGS})</span>
        <span className="block mt-1 text-gray-500 text-sm">
          顯示：{sym} 日對數回報的{viewType === "acf" ? "累計" : "直接"}自相關，lag 1 至 {MAX_LAGS} 天
        </span>
      </div>

      {/* ── 圖表 ── */}
      <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 mb-5">
        <AcfChart rows={rows} ciUpper={ciUpper} color={color} />
        <p className="text-center text-xs text-gray-500 mt-1">
          Shaded band = 95% confidence interval (±1.96/√n) · Highlighted bars = statistically significant lags
          <span className="block">陰影帶 = 95% 信賴區間 · 高亮 bar = 統計顯著的 lag</span>
        </p>
      </div>

      {/* ── Key Takeaway ── */}
      <div className={`mb-5 rounded-lg border ${takeaway.border} ${takeaway.bg} px-4 py-3`}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {takeaway.icon} Key Takeaway
        </p>
        <p className="text-sm text-gray-200 leading-relaxed font-medium">{takeaway.enSummary}</p>
        <p className="text-sm text-gray-300 leading-relaxed mt-1.5">{takeaway.enDetail}</p>
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.06]">
          <p className="text-sm text-gray-400 leading-relaxed">{takeaway.zhSummary}</p>
          <p className="text-sm text-gray-500 leading-relaxed mt-1">{takeaway.zhDetail}</p>
        </div>
      </div>

      {/* ── Ljung-Box 結果表 ── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3">
          Ljung-Box White Noise Test · 白噪聲檢定
          <span className="ml-2 text-xs font-normal text-gray-500">
            H₀: no autocorrelation up to lag k · 假設：lag k 以內無自相關
          </span>
        </h4>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">Lag k</th>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">LB Statistic</th>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">p-value</th>
                <th className="pb-2 pr-8 font-medium text-left whitespace-nowrap">Interpretation</th>
                <th className="pb-2 font-medium text-left whitespace-nowrap text-gray-500">中文</th>
              </tr>
            </thead>
            <tbody>
              {lbRows.map((row) => {
                const interp = lbInterpret(row.lb_pvalue);
                return (
                  <tr key={row.lag} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-3 pr-8 text-gray-300">{row.lag}</td>
                    <td className="py-3 pr-8 font-mono text-gray-300">
                      {row.lb_stat?.toFixed(2) ?? "—"}
                    </td>
                    <td className="py-3 pr-8 font-mono text-gray-300">
                      {row.lb_pvalue != null ? row.lb_pvalue.toFixed(4) : "—"}
                    </td>
                    <td className={`py-3 pr-8 font-medium ${interp.color}`}>
                      {interp.label}
                    </td>
                    <td className="py-3 text-gray-400 text-xs">{interp.zh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-gray-600 text-sm mt-4 leading-relaxed">
          Even when Ljung-Box rejects white noise, autocorrelation magnitudes are typically small in crypto daily returns. Statistical significance alone does not imply a tradeable edge.
          <span className="block mt-0.5">即使 Ljung-Box 拒絕白噪聲假設，加密貨幣日回報的自相關係數通常仍很小。統計顯著不等於有可交易的優勢。</span>
        </p>
      </div>

    </div>
  );
}
