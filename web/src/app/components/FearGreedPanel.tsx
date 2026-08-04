"use client";

// 這個檔案負責：Fear & Greed 分層回報面板
// 五個情緒層（Extreme Fear → Extreme Greed）各自的 Win Rate + Mean Return

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type FearGreedRow = {
  symbol: string;
  threshold: number | null;
  holding_days: number | null;
  sample_size: number | null;

  corr_fg_same_day: number | null;
  p_fg_same_day:    number | null;
  corr_fg_pre7:     number | null;
  p_fg_pre7:        number | null;

  ef_n: number | null; ef_mean: number | null; ef_win_rate: number | null;
  fe_n: number | null; fe_mean: number | null; fe_win_rate: number | null;
  ne_n: number | null; ne_mean: number | null; ne_win_rate: number | null;
  gr_n: number | null; gr_mean: number | null; gr_win_rate: number | null;
  eg_n: number | null; eg_mean: number | null; eg_win_rate: number | null;
};

// ── 常數設定 ──────────────────────────────────────────────────────────────────
const SYMBOLS     = ["BTC", "ETH", "SOL"];
const THRESHOLDS  = [-0.03, -0.05, -0.07];
const HOLD_DAYS   = [1, 3, 7];

const SYMBOL_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};

// 五個情緒層的顯示設定
const BANDS = [
  { key: "ef", label: "Extreme Fear", range: "0–24",   color: "#ef4444" },
  { key: "fe", label: "Fear",         range: "25–44",  color: "#f97316" },
  { key: "ne", label: "Neutral",      range: "45–55",  color: "#9ca3af" },
  { key: "gr", label: "Greed",        range: "56–75",  color: "#22c55e" },
  { key: "eg", label: "Extreme Greed",range: "76–100", color: "#4ade80" },
] as const;

// ── 輔助：格式化 ──────────────────────────────────────────────────────────────
function pct(v: number | null, decimals = 1) {
  if (v === null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}
function signColor(v: number | null) {
  if (v === null) return "#9ca3af";
  return v >= 0 ? "#4ade80" : "#f87171";
}

// ── 解讀文字生成（英文 + 中文各一段）────────────────────────────────────────
type InsightSegment = { text: string; bold?: boolean; color?: string };

function buildInsight(
  row: FearGreedRow,
  sym: string,
  thr: number,
  hold: number
): { en: InsightSegment[]; zh: InsightSegment[] } {
  const layers = [
    { label: "Extreme Fear",  labelZh: "極度恐慌", wr: row.ef_win_rate, mean: row.ef_mean, n: row.ef_n },
    { label: "Fear",          labelZh: "恐慌",     wr: row.fe_win_rate, mean: row.fe_mean, n: row.fe_n },
    { label: "Neutral",       labelZh: "中性",     wr: row.ne_win_rate, mean: row.ne_mean, n: row.ne_n },
    { label: "Greed",         labelZh: "貪婪",     wr: row.gr_win_rate, mean: row.gr_mean, n: row.gr_n },
    { label: "Extreme Greed", labelZh: "極度貪婪", wr: row.eg_win_rate, mean: row.eg_mean, n: row.eg_n },
  ].filter((l) => l.n !== null && l.n >= 1 && l.wr !== null && l.mean !== null);

  const empty: { en: InsightSegment[]; zh: InsightSegment[] } = {
    en: [{ text: "Not enough data for this combination." }],
    zh: [{ text: "此組合的數據不足，無法生成解讀。" }],
  };
  if (layers.length === 0) return empty;

  const bestWR   = layers.reduce((a, b) => (b.wr!  > a.wr!  ? b : a));
  const bestMean = layers.reduce((a, b) => (b.mean! > a.mean! ? b : a));
  const worstWR  = layers.reduce((a, b) => (b.wr!  < a.wr!  ? b : a));

  const thrLabel  = `${Math.abs(thr * 100).toFixed(0)}`;
  const holdLabel = `${hold} day${hold > 1 ? "s" : ""}`;
  const holdZh    = `${hold} 天`;
  const corrSig   = (row.p_fg_same_day ?? 1) < 0.05 || (row.p_fg_pre7 ?? 1) < 0.05;

  // ── 英文段落 ──
  const en: InsightSegment[] = [];
  en.push({ text: `When ${sym} drops ` });
  en.push({ text: `${thrLabel}%`, bold: true, color: "#f87171" });
  en.push({ text: ` or more in a single day, ` });

  if (bestWR.label === bestMean.label) {
    en.push({ text: `entering during ` });
    en.push({ text: bestWR.label, bold: true, color: "#4ade80" });
    en.push({ text: ` sentiment historically gave the best results — ` });
    en.push({ text: `${(bestWR.wr! * 100).toFixed(1)}% win rate`, bold: true, color: "#4ade80" });
    en.push({ text: ` and ` });
    en.push({ text: `+${(bestWR.mean! * 100).toFixed(2)}% average return`, bold: true, color: "#4ade80" });
    en.push({ text: ` over the next ${holdLabel}.` });
  } else {
    en.push({ text: bestWR.label, bold: true, color: "#4ade80" });
    en.push({ text: ` had the highest win rate (` });
    en.push({ text: `${(bestWR.wr! * 100).toFixed(1)}%`, bold: true, color: "#4ade80" });
    en.push({ text: `), while ` });
    en.push({ text: bestMean.label, bold: true, color: "#60a5fa" });
    en.push({ text: ` had the highest average return (` });
    en.push({ text: `+${(bestMean.mean! * 100).toFixed(2)}%`, bold: true, color: "#60a5fa" });
    en.push({ text: `). These two don't align — timing entry by sentiment alone carries uncertainty.` });
  }

  if (worstWR.label !== bestWR.label && worstWR.n! >= 3) {
    en.push({ text: ` By contrast, ` });
    en.push({ text: worstWR.label, bold: true, color: "#f87171" });
    en.push({ text: ` had the lowest win rate (` });
    en.push({ text: `${(worstWR.wr! * 100).toFixed(1)}%`, bold: true, color: "#f87171" });
    en.push({ text: `).` });
  }

  en.push({ text: corrSig
    ? ` This relationship is statistically significant — sentiment does carry measurable predictive value here.`
    : ` Note: sentiment score alone is not a statistically reliable predictor of returns — use it as context, not a signal.`
  });

  // ── 中文段落 ──
  const zh: InsightSegment[] = [];
  zh.push({ text: `當 ${sym} 單日下跌 ` });
  zh.push({ text: `${thrLabel}%`, bold: true, color: "#f87171" });
  zh.push({ text: ` 或以上，` });

  if (bestWR.label === bestMean.label) {
    zh.push({ text: `在市場處於` });
    zh.push({ text: `「${bestWR.labelZh}」`, bold: true, color: "#4ade80" });
    zh.push({ text: `情緒時入場，歷史表現最佳——` });
    zh.push({ text: `勝率 ${(bestWR.wr! * 100).toFixed(1)}%`, bold: true, color: "#4ade80" });
    zh.push({ text: `，持有 ${holdZh} 的平均回報為 ` });
    zh.push({ text: `+${(bestWR.mean! * 100).toFixed(2)}%`, bold: true, color: "#4ade80" });
    zh.push({ text: `。` });
  } else {
    zh.push({ text: `「${bestWR.labelZh}」`, bold: true, color: "#4ade80" });
    zh.push({ text: `情緒的入場勝率最高（` });
    zh.push({ text: `${(bestWR.wr! * 100).toFixed(1)}%`, bold: true, color: "#4ade80" });
    zh.push({ text: `），而「` });
    zh.push({ text: bestMean.labelZh, bold: true, color: "#60a5fa" });
    zh.push({ text: `」情緒的平均回報最高（` });
    zh.push({ text: `+${(bestMean.mean! * 100).toFixed(2)}%`, bold: true, color: "#60a5fa" });
    zh.push({ text: `）。兩者並不一致——單憑情緒擇時入場存在不確定性。` });
  }

  if (worstWR.label !== bestWR.label && worstWR.n! >= 3) {
    zh.push({ text: `相比之下，在「` });
    zh.push({ text: worstWR.labelZh, bold: true, color: "#f87171" });
    zh.push({ text: `」情緒時入場的勝率最低（` });
    zh.push({ text: `${(worstWR.wr! * 100).toFixed(1)}%`, bold: true, color: "#f87171" });
    zh.push({ text: `）。` });
  }

  zh.push({ text: corrSig
    ? ` 此關係具統計顯著性——情緒指數對回報有可量化的預測參考價值。`
    : ` 注意：情緒指數與回報之間的相關性在統計上並不顯著，建議將其作為背景參考，而非獨立入場信號。`
  });

  return { en, zh };
}

// 把 InsightSegment[] 渲染成 JSX
function renderSegments(segs: InsightSegment[]) {
  return segs.map((seg, i) =>
    seg.bold
      ? <strong key={i} style={{ color: seg.color, fontWeight: 600 }}>{seg.text}</strong>
      : <span key={i}>{seg.text}</span>
  );
}

// ── 相關係數白話注釋 ──────────────────────────────────────────────────────────
function corrStrength(r: number | null): string {
  if (r === null) return "—";
  const abs = Math.abs(r);
  if (abs < 0.1) return "Negligible · 幾乎無關";
  if (abs < 0.3) return "Weak · 弱";
  if (abs < 0.5) return "Moderate · 中等";
  return "Strong · 強";
}
function pConfidence(p: number | null): string {
  if (p === null) return "—";
  if (p < 0.01) return "Very high · 極高（p<0.01）";
  if (p < 0.05) return "High · 高（p<0.05）";
  if (p < 0.10) return "Borderline · 邊緣（p<0.10）";
  return "Low · 低（not significant）";
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function FearGreedPanel({ data }: { data: FearGreedRow[] }) {
  const searchParams = useSearchParams();
  const symbolFromUrl = searchParams.get("symbol")?.toUpperCase();
  const initialSym = SYMBOLS.includes(symbolFromUrl ?? "") ? symbolFromUrl! : "BTC";

  const [sym,       setSym]       = useState(initialSym);
  const [thr,       setThr]       = useState(-0.03);
  const [hold,      setHold]      = useState(7);
  const [showStats, setShowStats] = useState(false);

  // 找出對應的那一行數據
  const row = data.find(
    (r) =>
      r.symbol       === `${sym}USDT` &&
      r.threshold    === thr &&
      r.holding_days === hold
  ) ?? null;

  return (
    <div className="bg-gray-900 rounded-xl p-6 mb-6">
      {/* 標題 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-lg font-semibold">Fear &amp; Greed × Pattern Returns</h3>
        <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
          SENTIMENT ANALYSIS
        </span>
      </div>
      {/* 雙語副標題說明 */}
      <div className="bg-gray-800/60 rounded-lg px-4 py-3 mb-5 space-y-3">
        <p className="text-gray-200 text-sm leading-relaxed">
          When the market drops, does the <span className="text-purple-300 font-medium">level of fear or greed</span> at that moment affect how well the trade performs afterward?
          The chart below groups historical drop events by the <span className="text-purple-300 font-medium">Crypto Fear &amp; Greed Index</span> (0 = extreme fear, 100 = extreme greed) and compares win rates across each sentiment zone.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed">
          當市場出現大跌時，<span className="text-purple-300 font-medium">當下的市場情緒</span>（是極度恐慌還是極度貪婪）會影響後續的回報嗎？
          下圖將歷史大跌事件按照<span className="text-purple-300 font-medium">加密貨幣恐懼與貪婪指數</span>分層，對比不同情緒環境下的入場勝率與平均回報。
        </p>
      </div>

      {/* ── 控制列 ── */}
      <div className="flex flex-wrap gap-2 md:gap-4 mb-6">

        {/* 幣種 Tab */}
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

        {/* Threshold 選擇 */}
        <div className="flex gap-1">
          {THRESHOLDS.map((t) => (
            <button
              key={t}
              onClick={() => setThr(t)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                thr === t
                  ? "border-gray-300 text-white bg-gray-700"
                  : "border-gray-700 text-gray-500 hover:text-gray-300"
              }`}
            >
              {(t * 100).toFixed(0)}%
            </button>
          ))}
        </div>

        {/* Holding Period 選擇 */}
        <div className="flex gap-1">
          {HOLD_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setHold(d)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                hold === d
                  ? "border-gray-300 text-white bg-gray-700"
                  : "border-gray-700 text-gray-500 hover:text-gray-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── 主體：五層分析 ── */}
      {!row ? (
        <p className="text-gray-500 text-sm">No data for this combination.</p>
      ) : (
        <div className="space-y-3">
          {BANDS.map((band) => {
            const n        = row[`${band.key}_n`        as keyof FearGreedRow] as number | null;
            const mean     = row[`${band.key}_mean`     as keyof FearGreedRow] as number | null;
            const win_rate = row[`${band.key}_win_rate` as keyof FearGreedRow] as number | null;

            const barWidth = win_rate !== null ? Math.max(2, win_rate * 100) : 0;
            // n >= 1 才顯示；n < 3 時顯示警告標籤，提醒樣本不足
            const hasData    = n !== null && n >= 1;
            const lowSample  = n !== null && n >= 1 && n < 3;

            return (
              <div key={band.key}>
                {/* 情緒層標籤 + 數字 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: band.color }}
                    />
                    <span className="text-sm font-medium text-gray-200">{band.label}</span>
                    <span className="text-xs text-gray-600">({band.range})</span>
                    {hasData && (
                      <span className="text-xs text-gray-600">n={n}</span>
                    )}
                    {/* 樣本少於3時的黃色警告 */}
                    {lowSample && (
                      <span className="text-xs text-yellow-600 border border-yellow-700/50 rounded px-1">
                        low sample
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {hasData ? (
                      <>
                        <span className="text-gray-500">Average Return: <span className="font-semibold" style={{ color: signColor(mean) }}>{pct(mean, 2)}</span></span>
                        <span className="text-gray-500">Win Rate: <span className="font-semibold" style={{ color: win_rate !== null && win_rate >= 0.55 ? "#4ade80" : "#9ca3af" }}>{pct(win_rate)}</span></span>
                      </>
                    ) : (
                      <span className="text-gray-600 text-xs">no events</span>
                    )}
                  </div>
                </div>

                {/* Win Rate 橫向進度條 */}
                <div className="h-4 bg-gray-800 rounded-sm overflow-hidden relative">
                  {hasData && win_rate !== null ? (
                    <>
                      {/* 實際 bar（先渲染，基準線疊在上面） */}
                      <div
                        className="h-full rounded-sm transition-all duration-300"
                        style={{
                          width: `${barWidth}%`,
                          background: band.color,
                          opacity: 0.75,
                        }}
                      />
                      {/* 55% 基準線：白色細線疊在 bar 上 */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-white/40"
                        style={{ left: "55%" }}
                      />
                    </>
                  ) : (
                    <div className="h-full bg-gray-800" />
                  )}
                </div>
                {/* 55% 標籤：bar 正下方獨立一行，不與情緒層文字重疊 */}
                {band.key === "eg" && (
                  <div className="relative mt-1">
                    <span
                      className="absolute text-xs text-gray-600"
                      style={{ left: "calc(55% - 6px)" }}
                    >
                      55%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 底部解讀 ── */}
      {row && (() => {
        const insight = buildInsight(row, sym, thr, hold);
        return (
          <div className="mt-5 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
              Data Interpretation · 數據解讀
            </p>
            {/* 解讀文字：與上面說明框同樣的背景框樣式 */}
            <div className="bg-gray-800/60 rounded-lg px-4 py-3 space-y-3">
              <p className="text-sm text-gray-300 leading-relaxed">
                {renderSegments(insight.en)}
              </p>
              <p className="text-sm text-gray-400 leading-relaxed">
                {renderSegments(insight.zh)}
              </p>
            </div>
            {/* Show statistics 折疊區 */}
            <div className="mt-4">
              <button
                onClick={() => setShowStats((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span>{showStats ? "▾" : "▸"}</span>
                <span>{showStats ? "Hide statistics" : "Show statistics"} · 統計數據</span>
              </button>

              {showStats && (
                <div className="mt-3 space-y-3">

                  {/* 名詞解釋 */}
                  <div className="bg-gray-800/30 rounded-lg px-4 py-3 text-sm text-gray-400 space-y-2 border border-white/[0.06]">
                    <p className="text-gray-200 font-semibold">What do r and p mean? · r 和 p 是什麼？</p>
                    <p className="leading-relaxed">
                      <span className="text-white font-mono font-semibold">r</span>
                      <span className="text-gray-300"> = Pearson correlation coefficient（皮爾遜相關係數）</span>：衡量兩個數值之間的線性關聯程度，範圍 −1 到 +1。
                      <span className="text-gray-300"> r = 0</span> = 完全無線性關聯；<span className="text-gray-300">r = ±1</span> = 完美線性關聯。
                      這裡的 r 是用每次大跌當天的 Fear &amp; Greed 分數，對比入場後 N 天的回報率，計算兩者的線性相關性。
                    </p>
                    <p className="leading-relaxed">
                      <span className="text-white font-mono font-semibold">p</span>
                      <span className="text-gray-300"> = p-value（顯著性 p 值）</span>：這個相關係數「純屬偶然」的概率。
                      <span className="text-green-400 font-medium"> p &lt; 0.05</span> 才算統計顯著（有 95% 信心這不是巧合）；
                      <span className="text-red-400 font-medium"> p &gt; 0.05</span> 代表即使 r 不是 0，也可能只是隨機噪音。
                    </p>
                  </div>

                  {/* Same-day correlation */}
                  <div className="bg-gray-800/40 rounded-lg px-4 py-3 text-sm text-gray-300 space-y-2">
                    <p className="text-gray-200 font-semibold">
                      Same-day sentiment vs. return · 當天情緒 vs 後續回報
                    </p>
                    <div className="flex flex-wrap gap-x-8 gap-y-1.5">
                      <span className="font-mono text-gray-300">
                        r = <span className="text-white font-semibold">{row.corr_fg_same_day?.toFixed(3) ?? "—"}</span>
                        <span className="ml-2 font-sans text-gray-400 not-italic">
                          相關強度：<span className="text-gray-200">{corrStrength(row.corr_fg_same_day)}</span>
                        </span>
                      </span>
                      <span className="font-mono text-gray-300">
                        p = <span className="text-white font-semibold">{row.p_fg_same_day?.toFixed(3) ?? "—"}</span>
                        <span className="ml-2 font-sans text-gray-400 not-italic">
                          統計可信度：<span className={`font-medium ${(row.p_fg_same_day ?? 1) < 0.05 ? "text-green-400" : "text-gray-300"}`}>
                            {pConfidence(row.p_fg_same_day)}
                          </span>
                        </span>
                      </span>
                    </div>
                    <p className={`text-sm font-medium leading-relaxed ${(row.p_fg_same_day ?? 1) < 0.05 ? "text-green-400" : "text-red-400"}`}>
                      {(row.p_fg_same_day ?? 1) < 0.05
                        ? "✓ 結論：當天情緒分數與後續回報存在統計顯著的線性關聯，情緒指數具有一定的預測參考價值。"
                        : "✗ 結論：當天情緒分數與後續回報之間的線性相關不顯著，不能單靠情緒數字預測回報方向。分層勝率差異（上圖）可能來自其他因素，而非情緒本身的線性作用。"}
                    </p>
                  </div>

                  {/* Pre-7d correlation */}
                  <div className="bg-gray-800/40 rounded-lg px-4 py-3 text-sm text-gray-300 space-y-2">
                    <p className="text-gray-200 font-semibold">
                      Pre-7d avg sentiment vs. return · 前7天平均情緒 vs 後續回報
                    </p>
                    <div className="flex flex-wrap gap-x-8 gap-y-1.5">
                      <span className="font-mono text-gray-300">
                        r = <span className="text-white font-semibold">{row.corr_fg_pre7?.toFixed(3) ?? "—"}</span>
                        <span className="ml-2 font-sans text-gray-400 not-italic">
                          相關強度：<span className="text-gray-200">{corrStrength(row.corr_fg_pre7)}</span>
                        </span>
                      </span>
                      <span className="font-mono text-gray-300">
                        p = <span className="text-white font-semibold">{row.p_fg_pre7?.toFixed(3) ?? "—"}</span>
                        <span className="ml-2 font-sans text-gray-400 not-italic">
                          統計可信度：<span className={`font-medium ${(row.p_fg_pre7 ?? 1) < 0.05 ? "text-green-400" : "text-gray-300"}`}>
                            {pConfidence(row.p_fg_pre7)}
                          </span>
                        </span>
                      </span>
                    </div>
                    <p className={`text-sm font-medium leading-relaxed ${(row.p_fg_pre7 ?? 1) < 0.05 ? "text-green-400" : "text-red-400"}`}>
                      {(row.p_fg_pre7 ?? 1) < 0.05
                        ? "✓ 結論：大跌前7天的平均情緒與後續回報存在統計顯著的線性關聯，情緒累積趨勢具有預測參考價值。"
                        : "✗ 結論：大跌前7天的平均情緒與後續回報之間的線性相關不顯著，情緒累積趨勢本身不能可靠地預測入場後的回報方向。"}
                    </p>
                  </div>

                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
