"use client";

import { useState } from "react";

type GarchRow = {
  symbol: string;
  last_price: number;
  annualized_vol: number;
  forecast_vol_1d: number;
  forecast_vol_7d: number;
  mu: number;
  alpha: number;
  beta: number;
  nu: number;
  persistence: number;
  forecast_vol_h1: number;
  forecast_vol_h2: number;
  forecast_vol_h3: number;
  forecast_vol_h4: number;
  forecast_vol_h5: number;
  forecast_vol_h6: number;
  forecast_vol_h7: number;
};

const SYMBOL_STYLES: Record<string, string> = {
  BTCUSDT: "border-green-500/30 text-green-300",
  ETHUSDT: "border-blue-500/30 text-blue-300",
  SOLUSDT: "border-yellow-500/30 text-yellow-300",
};

function pct(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function num(value: number, digits = 4) {
  return value.toFixed(digits);
}

function persistenceLabel(value: number) {
  if (value >= 0.98) return "Very sticky · 波動延續性很高";
  if (value >= 0.94) return "Sticky · 波動延續性高";
  if (value >= 0.88) return "Moderate · 波動延續性中等";
  return "Faster mean reversion · 波動較快回落";
}

function tailRiskLabel(value: number) {
  if (value <= 5) return "Very fat tails · 極端波動機率偏高";
  if (value <= 8) return "Fat tails · 厚尾明顯";
  if (value <= 12) return "Moderate tails · 厚尾中等";
  return "Closer to normal · 較接近常態";
}

function volatilityLevelLabel(value: number) {
  if (value < 0.4) return "Low volatility · 低波動";
  if (value < 0.8) return "Moderate volatility · 中等波動";
  return "High volatility · 高波動";
}

function forecastTrendLabel(h1: number, h7: number) {
  const diff = h7 - h1;
  if (diff > 0.003) return "Heating up · 預測升溫";
  if (diff < -0.003) return "Cooling down · 預測降溫";
  return "Stable · 預測平穩";
}

function buildSummary(row: GarchRow) {
  const volLabel = volatilityLevelLabel(row.annualized_vol);
  const trendLabel = forecastTrendLabel(row.forecast_vol_h1, row.forecast_vol_h7);
  const tailLabel = tailRiskLabel(row.nu);
  const persistenceHigh = row.persistence >= 0.94;

  return {
    en: `${row.symbol.replace("USDT", "")} is currently in a ${volLabel.toLowerCase().split(" · ")[0]} regime. The 1–7 day forecast is ${trendLabel.toLowerCase().split(" · ")[0]}, ${persistenceHigh ? "and volatility persistence remains elevated" : "with persistence at a more moderate level"}. Tail behavior suggests ${tailLabel.toLowerCase().split(" · ")[0]}.`,
    zh: `${row.symbol.replace("USDT", "")} 目前處於${volLabel.split(" · ")[1]}狀態。1 到 7 天預測顯示波動${trendLabel.split(" · ")[1].replace("預測", "")}，${persistenceHigh ? "而且波動延續性仍偏高" : "波動延續性屬中等"}；尾部風險方面則屬於「${tailLabel.split(" · ")[1]}」。`,
  };
}

function buildHorizonRows(row: GarchRow) {
  return [
    row.forecast_vol_h1,
    row.forecast_vol_h2,
    row.forecast_vol_h3,
    row.forecast_vol_h4,
    row.forecast_vol_h5,
    row.forecast_vol_h6,
    row.forecast_vol_h7,
  ];
}

export default function GarchPanel({ data }: { data: GarchRow[] }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-6">
      <div className="flex items-start sm:items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">GARCH Volatility Forecast</h3>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            Daily volatility model with 1–7 day forward horizons.
          </p>
        </div>

      </div>

      {/* 說明框 */}
      <div className="bg-gray-800/60 rounded-lg px-3 sm:px-4 py-4 mb-5 space-y-3 text-sm">

        {/* 核心問題 */}
        <p className="text-gray-200 leading-relaxed">
          <strong className="text-white">波動率 ≠ 漲跌方向。</strong>{" "}
          GARCH 模型測量的是「幣價的脾氣大小」——它告訴你明天<em>大約會動多少幅度</em>，但不告訴你是漲還是跌。
          就像天氣預報說「明天風速很大」，但不告訴你風從哪個方向吹。
        </p>
        <p className="text-gray-400 leading-relaxed">
          預測值是<strong className="text-white">概率區間，不是確定結果</strong>。例如「1D Forecast 1.96%」代表：根據歷史模式，明天的漲跌幅<em>大約</em>落在 ±1.96% 附近。
          實際上有約 95% 的日子落在這個範圍，剩下 5% 是更劇烈的尾部事件（Tail Risk）。
          ν 越低，這 5% 裡的極端程度越誇張。
        </p>

        {/* 名詞解釋折疊 */}
        <div className="border-t border-white/[0.06] pt-3">
          <button
            onClick={() => setShowHow((v: boolean) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>{showHow ? "▾" : "▸"}</span>
            <span>What do these terms mean? · 名詞解釋</span>
          </button>

          {showHow && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">English</p>
                <div><span className="text-white font-medium">Annualized Vol</span><span className="text-gray-400"> — Daily volatility scaled to a full year. 66% means the price is expected to swing roughly ±66% over a year. Does not imply direction.</span></div>
                <div><span className="text-white font-medium">1D / 7D Forecast</span><span className="text-gray-400"> — Predicted daily volatility for tomorrow (h1) and the 7-day average (h1–h7). Higher = larger expected price swings either way.</span></div>
                <div><span className="text-white font-medium">Alpha (α)</span><span className="text-gray-400"> — How much yesterday's surprise (actual return²) feeds into today's volatility. Short memory. High α = yesterday's shock matters a lot.</span></div>
                <div><span className="text-white font-medium">Beta (β)</span><span className="text-gray-400"> — How much yesterday's volatility level carries over to today. Long memory. High β = volatility regime is sticky.</span></div>
                <div><span className="text-white font-medium">Persistence (α + β)</span><span className="text-gray-400"> — How long a volatility spike lasts. Near 1.0 = shock never decays (IGARCH). BTC/ETH at 1.000 means: once volatility spikes, it stays elevated.</span></div>
                <div><span className="text-white font-medium">Tail Parameter ν (nu)</span><span className="text-gray-400"> — Degree of freedom of the t-distribution. Lower = fatter tails = extreme moves (±10% days) are more likely than a normal distribution would predict. ν &lt; 5 is considered high tail risk.</span></div>
                <div><span className="text-white font-medium">Mean return (mu)</span><span className="text-gray-400"> — The model's estimated average daily return. Not a prediction — just a baseline parameter the model fits to historical data.</span></div>
                <div><span className="text-white font-medium">Forecast term structure</span><span className="text-gray-400"> — The full h1–h7 forecast sequence. Rising = volatility expected to heat up; falling = cooling down; flat = stable regime.</span></div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">中文</p>
                <div><span className="text-white font-medium">年化波動率</span><span className="text-gray-400"> — 把日波動率換算成一整年的幅度。66% 代表這一年內價格預計在 ±66% 範圍內波動，跟漲跌方向無關。</span></div>
                <div><span className="text-white font-medium">1D / 7D 預測</span><span className="text-gray-400"> — 明天（h1）以及未來 7 天平均的日波動率預測。數字越高 = 明後天預計漲或跌的幅度越大，但不代表一定漲或跌。</span></div>
                <div><span className="text-white font-medium">Alpha（α）</span><span className="text-gray-400"> — 「昨天的衝擊」對今天波動的貢獻。α 高 = 昨天突然暴漲或暴跌，今天波動率也會跟著升高。短記憶效應。</span></div>
                <div><span className="text-white font-medium">Beta（β）</span><span className="text-gray-400"> — 「昨天的波動水平」對今天的延續程度。β 高 = 昨天波動大，今天也大。長記憶效應。</span></div>
                <div><span className="text-white font-medium">Persistence（持續性）</span><span className="text-gray-400"> — α + β 之和，越接近 1.0 代表高波動越難平靜。BTC/ETH = 1.000（IGARCH），理論上波動一旦拉高就不會自然衰減。</span></div>
                <div><span className="text-white font-medium">尾部參數 ν（nu）</span><span className="text-gray-400"> — t 分佈自由度，數字越小 = 極端行情（單日 ±10%）發生機率越高，遠超正態分佈的預期。ν &lt; 5 屬於高尾部風險。</span></div>
                <div><span className="text-white font-medium">均值回報（mu）</span><span className="text-gray-400"> — 模型估算的日均回報率，只是模型的基線參數，不是對未來漲跌的預測。</span></div>
                <div><span className="text-white font-medium">預測期限結構</span><span className="text-gray-400"> — h1 到 h7 的完整預測序列。上升 = 波動預計升溫；下降 = 預計冷卻；平坦 = 波動穩定。</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {data.map((row) => {
          const horizonRows = buildHorizonRows(row);

          return (
            <div key={row.symbol} className="rounded-lg border border-gray-800 bg-gray-950/70 p-4 sm:p-5 min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h4 className="text-base sm:text-lg font-semibold">{row.symbol.replace("USDT", "")}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Mean return (mu): {pct(row.mu, 3)} per day
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border shrink-0 ${SYMBOL_STYLES[row.symbol]}`}>
                  {row.symbol}
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 sm:block">
                  <dt className="text-gray-400">Last Price</dt>
                  <dd className="font-medium text-white sm:mt-1">${row.last_price.toFixed(2)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block">
                  <dt className="text-gray-400">Annualized Vol</dt>
                  <dd className="font-medium text-white sm:mt-1">{pct(row.annualized_vol)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block">
                  <dt className="text-gray-400">1D Forecast</dt>
                  <dd className="font-medium text-white sm:mt-1">{pct(row.forecast_vol_1d)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block">
                  <dt className="text-gray-400">7D Avg Forecast</dt>
                  <dd className="font-medium text-white sm:mt-1">{pct(row.forecast_vol_7d)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block">
                  <dt className="text-gray-400">Alpha</dt>
                  <dd className="font-medium text-white sm:mt-1">{num(row.alpha)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block">
                  <dt className="text-gray-400">Beta</dt>
                  <dd className="font-medium text-white sm:mt-1">{num(row.beta)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block sm:col-span-2">
                  <dt className="text-gray-400">Tail Parameter (nu)</dt>
                  <dd className="font-medium text-white sm:mt-1">{num(row.nu, 2)}</dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-gray-300">Persistence</p>
                  <p className="text-sm font-semibold text-purple-300">{num(row.persistence)}</p>
                </div>
                  <p className="text-xs text-purple-200/90 mt-2 leading-relaxed">
                    {persistenceLabel(row.persistence)}
                  </p>
                </div>

                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-sm text-gray-300">Tail Risk</p>
                    <p className="text-sm font-semibold text-cyan-300">ν = {num(row.nu, 2)}</p>
                  </div>
                  <p className="text-xs text-cyan-200/90 mt-2 leading-relaxed">
                    {tailRiskLabel(row.nu)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-3">
                <p className="text-sm font-medium text-gray-200">Model interpretation</p>
                <p className="text-sm text-gray-300 leading-relaxed mt-2">
                  {buildSummary(row).en}
                </p>
                <p className="text-sm text-gray-400 leading-relaxed mt-2">
                  {buildSummary(row).zh}
                </p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <h5 className="text-sm font-medium text-gray-200">Forecast term structure</h5>
                  <span className="text-xs text-gray-500">h1 → h7</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs sm:text-sm border-separate border-spacing-y-1">
                    <thead>
                      <tr className="text-gray-500">
                        {horizonRows.map((_, index) => (
                          <th key={index} className="text-left font-medium pr-4 whitespace-nowrap">
                            h{index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {horizonRows.map((value, index) => (
                          <td key={index} className="pr-4 whitespace-nowrap text-gray-200">
                            {pct(value)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
