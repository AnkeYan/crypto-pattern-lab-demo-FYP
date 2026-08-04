"use client";

import { useMemo, useState } from "react";

type ValidationRow = {
  symbol: string;
  threshold: number | null;
  holding_days: number | null;
  discovery_start: string;
  discovery_end: string;
  validation_start: string;
  validation_end: string;
  discovery_sample_size: number | null;
  discovery_mean_return: number | null;
  discovery_median_return: number | null;
  discovery_win_rate: number | null;
  discovery_sharpe_ratio: number | null;
  discovery_sortino_ratio: number | null;
  discovery_max_drawdown: number | null;
  validation_sample_size: number | null;
  validation_mean_return: number | null;
  validation_median_return: number | null;
  validation_win_rate: number | null;
  validation_sharpe_ratio: number | null;
  validation_sortino_ratio: number | null;
  validation_max_drawdown: number | null;
  consistency_flag: string;
  confidence_label: string;
  confidence_score: number | null;
  confidence_reasons: string;
  summary_note: string;
};

const SYMBOLS = ["BTC", "ETH", "SOL"];
const THRESHOLDS = [-0.03, -0.05, -0.07];
const HOLDING_DAYS = [1, 3, 7];

const SYMBOL_ACTIVE_BORDER: Record<string, string> = {
  BTC: "border-green-400 text-green-400",
  ETH: "border-blue-400 text-blue-400",
  SOL: "border-yellow-400 text-yellow-400",
};

const CONSISTENCY_STYLES: Record<string, string> = {
  consistent_positive: "bg-green-500/15 text-green-300 border-green-500/30",
  failed_validation: "bg-red-500/15 text-red-300 border-red-500/30",
  improved_in_validation: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  insufficient_validation_sample: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  consistent_but_weak: "bg-gray-700/60 text-gray-300 border-gray-600",
};

function pct(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function num(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function consistencyLabel(flag: string) {
  switch (flag) {
    case "consistent_positive":
      return "Validated positive · 驗證期仍為正";
    case "failed_validation":
      return "Failed validation · 驗證失效";
    case "improved_in_validation":
      return "Improved later · 後期改善";
    case "positive_but_weakened":
      return "Positive but weakened · 仍為正但明顯轉弱";
    case "insufficient_validation_sample":
      return "Low validation sample · 驗證樣本偏少";
    default:
      return "Mixed / weak · 混合或偏弱";
  }
}

function signColor(value: number | null) {
  if (value === null || Number.isNaN(value)) return "text-gray-400";
  return value >= 0 ? "text-green-300" : "text-red-300";
}

// ── 動態 Key Takeaway ──────────────────────────────────────────────────────
function buildTakeaway(row: ValidationRow, sym: string, thr: number, hold: number) {
  const dropPct = `${Math.abs(thr * 100).toFixed(0)}%`;
  const flag = row.consistency_flag;
  const score = row.confidence_score ?? 0;
  const valWr = row.validation_win_rate ?? 0;
  const valN = row.validation_sample_size ?? 0;
  const valMean = row.validation_mean_return ?? 0;

  // 判斷狀態
  const isValidated =
    flag === "consistent_positive" || flag === "improved_in_validation";
  const isFailed = flag === "failed_validation";
  const isWeak =
    flag === "consistent_but_weak" || flag === "positive_but_weakened";
  const isLowN = flag === "insufficient_validation_sample" || valN < 20;

  let border = "border-gray-700";
  let bg = "bg-white/[0.03]";
  let icon = "~";
  let enSummary = "";
  let zhSummary = "";

  if (isLowN) {
    border = "border-yellow-500/30";
    bg = "bg-yellow-500/5";
    icon = "⚠";
    enSummary = `Only ${valN} validation signals found for ${sym} ${dropPct} drop / ${hold}d hold — too few to draw firm conclusions. The pattern may be valid, but we can't confirm it yet.`;
    zhSummary = `驗證期只有 ${valN} 次信號，樣本太少，無法得出可靠結論。規律可能存在，但目前還不能確認。`;
  } else if (isFailed) {
    border = "border-red-500/20";
    bg = "bg-red-500/5";
    icon = "✗";
    enSummary = `This pattern did NOT hold up in the validation period (2023–present). What worked before may have been specific to the 2017–2022 market era — treat with caution.`;
    zhSummary = `這個規律在驗證期（2023至今）已經失效。研究期有效不代表以後還會有效，要小心過度依賴歷史數據。`;
  } else if (isValidated && score >= 6) {
    border = "border-green-500/30";
    bg = "bg-green-500/5";
    icon = "✓";
    enSummary = `${sym} has historically bounced after a ${dropPct} drop — and this pattern survived the validation period. Win rate in validation: ${pct(row.validation_win_rate)}, mean return: ${pct(valMean, 2)} over ${hold}d. Confidence score ${score}/10.`;
    zhSummary = `${sym} 歷史上在跌 ${dropPct} 後反彈的規律，在驗證期依然成立。驗證期勝率 ${pct(row.validation_win_rate)}，持有 ${hold} 天平均回報 ${pct(valMean, 2)}。信心評分 ${score}/10。`;
  } else if (isWeak || (isValidated && score < 6)) {
    border = "border-gray-700";
    bg = "bg-white/[0.03]";
    icon = "~";
    enSummary = `The pattern survived validation but with reduced edge. Validation win rate is ${pct(row.validation_win_rate)} — slightly above 50% but not strong. Use alongside other signals.`;
    zhSummary = `規律在驗證期仍為正，但優勢明顯縮水。驗證期勝率 ${pct(row.validation_win_rate)}，略高於 50% 但不夠強。建議配合其他指標使用。`;
  } else {
    border = "border-gray-700";
    bg = "bg-white/[0.03]";
    icon = "~";
    enSummary = `Validation result is mixed. Win rate: ${pct(row.validation_win_rate)}, score: ${score}/10. Not a clean signal on its own.`;
    zhSummary = `驗證結果混合。勝率 ${pct(row.validation_win_rate)}，評分 ${score}/10，單獨使用時信號不夠清晰。`;
  }

  return { border, bg, icon, enSummary, zhSummary };
}

// ── confidence_reasons 中文翻譯 ──────────────────────────────────────────────
function translateReasons(reasons: string): string {
  return reasons
    .replace("validation sample is reasonably deep", "驗證樣本數量足夠")
    .replace("validation sample is small", "驗證樣本偏少")
    .replace("combined sample depth is strong", "研究期＋驗證期總樣本充足")
    .replace("validation mean return stayed positive", "驗證期平均回報仍為正")
    .replace("validation mean return turned negative", "驗證期平均回報已轉負")
    .replace("validation median return stayed positive", "驗證期中位回報仍為正")
    .replace("validation median return turned negative", "驗證期中位回報已轉負")
    .replace("validation win rate is at least 50%", "驗證期勝率 ≥ 50%")
    .replace("validation win rate dropped below 50%", "驗證期勝率已低於 50%")
    .replace("validation retained at least half of the discovery edge", "驗證期保留了研究期至少一半的優勢")
    .replace("edge significantly eroded in validation", "驗證期優勢大幅收窄")
    .replace("worst validation event loss is not excessively deep", "驗證期最差單次虧損在可接受範圍")
    .replace("worst validation event loss is severe", "驗證期出現嚴重單次虧損");
}

// ── summary_note 中文版（根據 flag 生成）────────────────────────────────────
function buildZhSummaryNote(row: ValidationRow, sym: string, thr: number, hold: number): string {
  const dropPct = `${Math.abs(thr * 100).toFixed(0)}%`;
  const flag = row.consistency_flag;
  const wr = pct(row.validation_win_rate);
  const mean = pct(row.validation_mean_return, 2);

  switch (flag) {
    case "consistent_positive":
      return `${sym} 在研究期和驗證期的跌 ${dropPct}／持有 ${hold} 天組合均表現正面。驗證期勝率 ${wr}，平均回報 ${mean}，說明這個規律比僅靠研究期發現的結果更穩健。`;
    case "failed_validation":
      return `${sym} 跌 ${dropPct}／持有 ${hold} 天的規律在研究期有效，但驗證期（2023至今）已失效。這可能反映市場結構性轉變，不建議單獨依賴此信號。`;
    case "improved_in_validation":
      return `${sym} 跌 ${dropPct}／持有 ${hold} 天的規律在驗證期表現比研究期更好。驗證期勝率 ${wr}，這是一個積極信號，但樣本仍需繼續累積觀察。`;
    case "positive_but_weakened":
      return `${sym} 跌 ${dropPct}／持有 ${hold} 天的規律在驗證期仍為正，但優勢已明顯收窄。研究期的邊際在新市場環境下部分消失，使用時需謹慎。`;
    case "insufficient_validation_sample":
      return `驗證期信號數量不足，統計意義有限。規律可能存在，但需要更多時間累積數據才能作出可靠判斷。`;
    default:
      return `${sym} 跌 ${dropPct}／持有 ${hold} 天的結果在研究期和驗證期之間表現不一致，信號混合，不建議單獨使用。`;
  }
}

function MetricCard({
  title,
  subtitle,
  sampleSize,
  meanReturn,
  medianReturn,
  winRate,
  sharpe,
  sortino,
  maxDrawdown,
}: {
  title: string;
  subtitle: string;
  sampleSize: number | null;
  meanReturn: number | null;
  medianReturn: number | null;
  winRate: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-base font-semibold text-white">{title}</h4>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="flex items-center justify-between gap-4 sm:block">
          <dt className="text-gray-400">Sample Size</dt>
          <dd className="font-medium text-white sm:mt-1">{sampleSize ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 sm:block">
          <dt className="text-gray-400">Win Rate</dt>
          <dd className="font-medium text-white sm:mt-1">{pct(winRate)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 sm:block">
          <dt className="text-gray-400">Mean Return</dt>
          <dd className={`font-medium sm:mt-1 ${signColor(meanReturn)}`}>{pct(meanReturn, 2)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 sm:block">
          <dt className="text-gray-400">Median Return</dt>
          <dd className={`font-medium sm:mt-1 ${signColor(medianReturn)}`}>{pct(medianReturn, 2)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 sm:block">
          <dt className="text-gray-400">Sharpe</dt>
          <dd className="font-medium text-white sm:mt-1">{num(sharpe, 2)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 sm:block">
          <dt className="text-gray-400">Sortino</dt>
          <dd className="font-medium text-white sm:mt-1">{num(sortino, 2)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 sm:block sm:col-span-2">
          <dt className="text-gray-400">Worst Event Return</dt>
          <dd className="font-medium text-red-300 sm:mt-1">{pct(maxDrawdown, 2)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function PatternValidationPanel({ data }: { data: ValidationRow[] }) {
  const [activeTab, setActiveTab] = useState("BTC");
  const [threshold, setThreshold] = useState(-0.03);
  const [holdingDays, setHoldingDays] = useState(3);
  const [showInfo, setShowInfo] = useState(false);

  const row = useMemo(() => {
    return data.find(
      (item) =>
        item.symbol === `${activeTab}USDT` &&
        item.threshold === threshold &&
        item.holding_days === holdingDays
    ) ?? null;
  }, [activeTab, threshold, holdingDays, data]);

  const takeaway = useMemo(() => {
    if (!row) return null;
    return buildTakeaway(row, activeTab, threshold, holdingDays);
  }, [row, activeTab, threshold, holdingDays]);

  const dropPct = `${Math.abs(threshold * 100).toFixed(0)}%`;

  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Pattern Validation Lab</h3>
          <p className="text-gray-500 text-sm mt-0.5">
            研究期 vs 驗證期分析 · Designed to reduce overfitting risk
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
            {/* English */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                <em>The core question: if a pattern worked historically, does it still work today — or was it just a coincidence of that era?</em>
              </p>
              <p className="text-gray-400 mb-2">
                This panel splits historical data into two periods: <strong className="text-white">Discovery</strong> (pre-2023, used to find patterns) and <strong className="text-white">Validation</strong> (2023–present, used to test if patterns survived into a new market era).
              </p>
              <p className="text-gray-400 mb-2">
                A pattern that worked in Discovery but failed in Validation may be <strong className="text-white">overfitted</strong> — it only reflected the conditions of that specific era, not a persistent market tendency.
              </p>
              <p className="text-gray-400 mb-3">
                A pattern that holds in both periods is much more likely to reflect a real, repeatable edge.
              </p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">What do the numbers mean?</p>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-gray-200">Win Rate</strong> — % of signals where price was higher after the holding period.</li>
                <li><strong className="text-gray-200">Mean / Median Return</strong> — average and middle return across all signals. Median is more reliable when a few extreme events distort the mean.</li>
                <li><strong className="text-gray-200">Sharpe Ratio</strong> — return divided by total volatility. Higher = better risk-adjusted return. Above 0 means positive edge.</li>
                <li><strong className="text-gray-200">Sortino Ratio</strong> — like Sharpe, but only penalises downside volatility. Better for asymmetric strategies like buying dips.</li>
                <li><strong className="text-gray-200">Worst Event Return</strong> — the single worst outcome across all signals. Shows your downside tail risk.</li>
                <li><strong className="text-gray-200">Confidence Score</strong> — a 0–10 composite score blending sample size, win rate, edge retention, and downside risk. Not a formal statistic — use as a quick quality filter.</li>
              </ul>
            </div>

            {/* 中文 */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                <em>核心問題：歷史上有效的規律，現在還有效嗎？還是只是那個年代的特殊現象？</em>
              </p>
              <p className="text-gray-400 mb-2">
                本面板把歷史數據分為兩段：<strong className="text-white">研究期</strong>（2023年前，用來發現規律）和<strong className="text-white">驗證期</strong>（2023至今，用來測試規律是否在新的市場環境下依然成立）。
              </p>
              <p className="text-gray-400 mb-2">
                在研究期有效、但驗證期失效的規律，很可能是<strong className="text-white">過度擬合</strong>——只是恰好符合了那段時期的市場特性，並不代表真正的可重複優勢。
              </p>
              <p className="text-gray-400 mb-3">
                兩段都成立的規律，才更值得信賴。
              </p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">各欄位說明</p>
              <ul className="space-y-1.5 text-gray-400">
                <li><strong className="text-gray-200">勝率（Win Rate）</strong> — 信號出現後，持有期結束時價格上漲的比例。</li>
                <li><strong className="text-gray-200">平均／中位回報</strong> — 所有信號的平均和中位數回報。有極端值時，中位數更可靠。</li>
                <li><strong className="text-gray-200">夏普比率（Sharpe）</strong> — 回報除以總波動率。越高越好，高於 0 表示有正向優勢。</li>
                <li><strong className="text-gray-200">索提諾比率（Sortino）</strong> — 類似夏普，但只懲罰下行波動。對「買跌」類策略更合適。</li>
                <li><strong className="text-gray-200">最差單次回報</strong> — 所有信號中最差的一次結果，代表你的下行尾部風險。</li>
                <li><strong className="text-gray-200">信心評分</strong> — 0–10 分的綜合評分，融合樣本數、勝率、優勢保留度和下行風險。不是正式統計量，作為快速質量篩選用。</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* BTC/ETH/SOL tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-700 overflow-x-auto">
        {SYMBOLS.map((sym) => (
          <button
            key={sym}
            onClick={() => setActiveTab(sym)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${
              activeTab === sym ? SYMBOL_ACTIVE_BORDER[sym] : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Drop + Hold filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {THRESHOLDS.map((value) => (
            <button
              key={value}
              onClick={() => setThreshold(value)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                threshold === value
                  ? "border-cyan-400 text-cyan-300 bg-cyan-500/10"
                  : "border-gray-700 text-gray-400 hover:text-gray-200"
              }`}
            >
              {`${Math.abs(value * 100).toFixed(0)}% Drop`}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {HOLDING_DAYS.map((value) => (
            <button
              key={value}
              onClick={() => setHoldingDays(value)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                holdingDays === value
                  ? "border-purple-400 text-purple-300 bg-purple-500/10"
                  : "border-gray-700 text-gray-400 hover:text-gray-200"
              }`}
            >
              {value}D Hold
            </button>
          ))}
        </div>
      </div>

      {/* 條件說明行 */}
      {row && (
        <div className="mb-5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm">
          <span className="text-gray-400">Showing: </span>
          <span className="text-white font-medium">every time {activeTab} dropped {dropPct} in a single day</span>
          <span className="text-gray-400"> — how did price perform over the next </span>
          <span className="text-white font-medium">{holdingDays} day{holdingDays > 1 ? "s" : ""}</span>
          <span className="text-gray-400">, split by research vs validation era?</span>
          <span className="block mt-1 text-gray-500 text-sm">
            顯示：{activeTab} 單日跌幅達 {dropPct} 後，分研究期和驗證期，{holdingDays} 天後的歷史回報統計
          </span>
        </div>
      )}

      {!row ? (
        <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-400">
          No validation row found for this combination.
        </div>
      ) : (
        <>
          {/* Consistency + Confidence badges */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className={`text-xs px-2 py-1 rounded-full border ${CONSISTENCY_STYLES[row.consistency_flag] ?? CONSISTENCY_STYLES.consistent_but_weak}`}>
              {consistencyLabel(row.consistency_flag)}
            </span>
            <span className="text-xs px-2 py-1 rounded-full border border-gray-700 text-gray-300 bg-gray-800/80">
              {row.confidence_label}
            </span>
          </div>

          {/* MetricCards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MetricCard
              title="Discovery Period"
              subtitle={`${row.discovery_start} → ${row.discovery_end}`}
              sampleSize={row.discovery_sample_size}
              meanReturn={row.discovery_mean_return}
              medianReturn={row.discovery_median_return}
              winRate={row.discovery_win_rate}
              sharpe={row.discovery_sharpe_ratio}
              sortino={row.discovery_sortino_ratio}
              maxDrawdown={row.discovery_max_drawdown}
            />
            <MetricCard
              title="Validation Period"
              subtitle={`${row.validation_start} → ${row.validation_end}`}
              sampleSize={row.validation_sample_size}
              meanReturn={row.validation_mean_return}
              medianReturn={row.validation_median_return}
              winRate={row.validation_win_rate}
              sharpe={row.validation_sharpe_ratio}
              sortino={row.validation_sortino_ratio}
              maxDrawdown={row.validation_max_drawdown}
            />
          </div>

          {/* Key Takeaway */}
          {takeaway && (
            <div className={`mt-5 rounded-lg border ${takeaway.border} ${takeaway.bg} px-4 py-3`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {takeaway.icon} Key Takeaway
              </p>
              <p className="text-sm text-gray-200 leading-relaxed">{takeaway.enSummary}</p>
              <p className="text-sm text-gray-400 leading-relaxed mt-1">{takeaway.zhSummary}</p>
            </div>
          )}

          {/* Interpretation + Confidence Breakdown */}
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/70 p-4 sm:p-5 space-y-4">
            <div>
              <h4 className="text-base font-semibold text-white mb-2">Interpretation · 解讀</h4>
              <p className="text-sm text-gray-300 leading-relaxed">{row.summary_note}</p>
              <p className="text-sm text-gray-400 leading-relaxed mt-2">
                {buildZhSummaryNote(row, activeTab, threshold, holdingDays)}
              </p>
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-medium text-gray-200">Confidence Breakdown · 評分明細</p>
                <span className="text-xs px-2 py-1 rounded-full border border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
                  Score {row.confidence_score ?? "—"} / 10
                </span>
              </div>
              <p className="text-sm text-cyan-100/90 leading-relaxed mt-2">
                {row.confidence_reasons}
              </p>
              <p className="text-sm text-cyan-200/70 leading-relaxed mt-1">
                {translateReasons(row.confidence_reasons)}
              </p>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed">
              Confidence label is a product-layer summary, not a formal confidence interval. It blends sample depth, sign consistency, median support, win rate, edge retention, and downside severity.
              <span className="block mt-1 text-gray-500">
                信心評分是產品層面的綜合評估，非正式統計置信區間。它融合了樣本深度、方向一致性、中位數支撐、勝率、優勢保留度和下行嚴重程度。
              </span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
