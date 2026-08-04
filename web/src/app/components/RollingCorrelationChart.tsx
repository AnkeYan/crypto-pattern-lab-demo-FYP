"use client";

// 這個檔案負責：Rolling Correlation 面板
// 上半：ETH vs BTC、SOL vs BTC 的60天滾動相關係數
// 下半：ETH/BTC 相對強度比率（ETH 跑贏/跑輸 BTC 的視覺化）
// 事件標記：重大市場崩潰（紅）/ Fed 利率決策（藍）/ BTC Halving（黃）

import { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Brush,
} from "recharts";

// ── 歷史事件數據（硬編碼）────────────────────────────────────────────────────
type MarketEvent = {
  date:      string;   // YYYY-MM-DD
  type:      "crash" | "fed" | "halving";
  label:     string;   // 短標題（英文）
  labelZh:   string;   // 短標題（中文）
  detail:    string;   // 一句話說明（英文）
  detailZh:  string;   // 一句話說明（中文）
  source:    string;   // 來源名稱
  url:       string;   // 新聞連結
};

const MARKET_EVENTS: MarketEvent[] = [
  // ── 重大市場崩潰 ──
  { date: "2017-12-22", type: "crash",   label: "2017 ATH Correction",       labelZh: "2017年高位回調",       detail: "Bitcoin fell nearly 30% as the broader crypto market corrected sharply from record highs.",           detailZh: "比特幣從歷史高位急跌近30%，加密市場出現大幅回調。",                                          source: "CoinDesk", url: "https://www.coindesk.com/markets/2017/12/22/charting-2017s-biggest-crypto-price-correction" },
  { date: "2018-01-02", type: "crash",   label: "South Korea Ban Fears",     labelZh: "南韓禁令恐慌",         detail: "Bitcoin dropped over 10% as South Korea threatened to ban crypto exchanges.",                        detailZh: "南韓政府揚言禁止加密貨幣交易所，比特幣下跌逾10%。",                                          source: "Reuters",  url: "https://www.reuters.com/article/technology/south-korea-plans-to-ban-cryptocurrency-trading-rattles-market-idUSKBN1F002B/" },
  { date: "2018-02-05", type: "crash",   label: "Exchange Hack Fears",       labelZh: "交易所被黑恐慌",       detail: "Bitcoin fell below $8,000 after a $60B+ market wipeout amid exchange hack and regulatory concerns.",  detailZh: "交易所被駭及監管憂慮引發逾600億美元市值蒸發，比特幣跌破8000美元。",                          source: "CNBC",     url: "https://www.cnbc.com/2018/02/05/bitcoin-price-drops-below-8000-over-60-billion-wiped-off-cryptocurrencies.html" },
  { date: "2018-11-14", type: "crash",   label: "Bitcoin Cash Hard Fork",    labelZh: "BCH硬分叉事件",        detail: "Bitcoin dropped over 12% amid uncertainty over the Bitcoin Cash hard fork.",                        detailZh: "比特幣現金硬分叉引發不確定性，比特幣下跌逾12%。",                                            source: "CoinDesk", url: "https://www.coindesk.com/markets/2018/11/14/the-crypto-market-just-fell-to-a-new-2018-low" },
  { date: "2018-12-07", type: "crash",   label: "SEC ETF Delay",             labelZh: "SEC延遲ETF審批",       detail: "Bitcoin plunged over 11% amid the SEC's delay on the VanEck Bitcoin ETF decision.",                 detailZh: "美國SEC延遲審批VanEck比特幣ETF，比特幣急跌逾11%。",                                           source: "CNBC",     url: "https://www.cnbc.com/2018/12/07/bitcoin-plunges-as-rout-continues-to-drag-down-cyptocurrency-market.html" },
  { date: "2019-09-24", type: "crash",   label: "Market Volatility Crash",   labelZh: "市場波動性崩跌",       detail: "Bitcoin crashed 15% to below $8,000 for the first time since June amid market volatility.",          detailZh: "比特幣因市場波動崩跌15%，自6月以來首次跌破8000美元。",                                        source: "CNBC",     url: "https://www.cnbc.com/2019/09/24/bitcoin-crashes-15percent-to-below-8000-for-first-time-since-june.html" },
  { date: "2020-03-12", type: "crash",   label: "COVID Black Thursday",      labelZh: "COVID黑色星期四",      detail: "Bitcoin plunged nearly 40% as global markets collapsed over the COVID-19 pandemic.",                 detailZh: "新冠疫情引發全球市場崩潰，比特幣單日暴跌近40%。",                                            source: "CoinDesk", url: "https://www.coindesk.com/markets/2020/03/13/bitcoin-price-briefly-dips-to-12-month-low-in-overnight-trading" },
  { date: "2021-05-19", type: "crash",   label: "China Mining Ban",          labelZh: "中國禁止挖礦",         detail: "Bitcoin sank 22% as China intensified its crypto mining crackdown.",                                detailZh: "中國加強打壓加密貨幣挖礦，比特幣單日下跌22%。",                                              source: "Reuters",  url: "https://www.reuters.com/technology/bitcoin-ethereum-plunge-crypto-market-cap-losses-nearly-1-trillion-2021-05-19" },
  { date: "2021-12-04", type: "crash",   label: "Macro Anxiety Crash",       labelZh: "宏觀憂慮崩跌",         detail: "Bitcoin fell 22% due to profit-taking and broader economic anxieties, with ~$1B in liquidations.",  detailZh: "獲利回吐及宏觀經濟憂慮觸發約10億美元強平，比特幣跌22%。",                                    source: "Reuters",  url: "https://www.reuters.com/technology/bitcoin-extends-downtrend-falls-121-47176-2021-12-04" },
  { date: "2022-05-09", type: "crash",   label: "LUNA/UST Collapse",         labelZh: "LUNA/UST崩潰",         detail: "Bitcoin dropped ~12% as the LUNA/UST algorithmic stablecoin began its fatal collapse.",            detailZh: "LUNA/UST算法穩定幣開始崩潰，比特幣下跌約12%。",                                              source: "Al Jazeera", url: "https://www.aljazeera.com/economy/2022/5/20/after-terra-crash-investors-and-regulators-count-cost-of-crypto" },
  { date: "2022-06-18", type: "crash",   label: "Celsius Halts Withdrawals", labelZh: "Celsius暫停提款",      detail: "Bitcoin tumbled over 13% below $20,000 as Celsius halted withdrawals.",                            detailZh: "借貸平台Celsius暫停提款，比特幣跌破2萬美元，跌幅逾13%。",                                    source: "Reuters",  url: "https://www.reuters.com/markets/currencies/bitcoin-drops-65-below-20000-2022-06-18" },
  { date: "2022-11-09", type: "crash",   label: "FTX Collapse",              labelZh: "FTX爆雷",              detail: "Bitcoin tanked over 14% as FTX filed for bankruptcy — crypto's 'Lehman moment'.",                  detailZh: "FTX申請破產保護，被稱為加密界「雷曼時刻」，比特幣暴跌逾14%。",                               source: "CoinDesk", url: "https://www.coindesk.com/markets/2022/11/09/market-wrap-bitcoin-other-cryptos-continue-to-plummet" },
  { date: "2024-08-05", type: "crash",   label: "Yen Carry Trade Unwind",    labelZh: "日圓套息交易平倉",     detail: "Bitcoin dropped sharply as global markets reacted to the unwinding of the Japanese yen carry trade.", detailZh: "全球市場因日圓套息交易大規模平倉而動盪，比特幣急跌。",                                        source: "Reuters",  url: "https://www.reuters.com/markets/global-markets-carrytrade-2024-08-06/" },
  // ── Fed 利率決策 ──
  { date: "2022-03-16", type: "fed",     label: "Fed Hike +25bps",           labelZh: "Fed加息+25點子",       detail: "First Fed rate hike of 2022 cycle. Target range: 0.25–0.50%.",                                      detailZh: "2022年加息周期首次加息，目標利率區間升至0.25–0.50%。",                                        source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2022-05-04", type: "fed",     label: "Fed Hike +50bps",           labelZh: "Fed加息+50點子",       detail: "Fed raises rates by 50bps. Target range: 0.75–1.00%.",                                               detailZh: "聯儲局加息50點子，目標利率區間升至0.75–1.00%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2022-06-15", type: "fed",     label: "Fed Hike +75bps",           labelZh: "Fed加息+75點子（最大）", detail: "Largest single Fed hike in 28 years (+75bps). Target range: 1.50–1.75%.",                           detailZh: "28年來最大單次加息幅度（+75點子），目標利率區間升至1.50–1.75%。",                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2022-07-27", type: "fed",     label: "Fed Hike +75bps",           labelZh: "Fed加息+75點子",       detail: "Fed raises rates by 75bps again. Target range: 2.25–2.50%.",                                         detailZh: "聯儲局再次加息75點子，目標利率區間升至2.25–2.50%。",                                          source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2022-09-21", type: "fed",     label: "Fed Hike +75bps",           labelZh: "Fed加息+75點子",       detail: "Fed raises rates by 75bps. Target range: 3.00–3.25%.",                                               detailZh: "聯儲局加息75點子，目標利率區間升至3.00–3.25%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2022-11-02", type: "fed",     label: "Fed Hike +75bps",           labelZh: "Fed加息+75點子",       detail: "Fed raises rates by 75bps. Target range: 3.75–4.00%.",                                               detailZh: "聯儲局加息75點子，目標利率區間升至3.75–4.00%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2022-12-14", type: "fed",     label: "Fed Hike +50bps",           labelZh: "Fed加息+50點子",       detail: "Fed raises rates by 50bps. Target range: 4.25–4.50%.",                                               detailZh: "聯儲局加息50點子，目標利率區間升至4.25–4.50%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2023-02-01", type: "fed",     label: "Fed Hike +25bps",           labelZh: "Fed加息+25點子",       detail: "Fed raises rates by 25bps. Target range: 4.50–4.75%.",                                               detailZh: "聯儲局加息25點子，目標利率區間升至4.50–4.75%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2023-03-22", type: "fed",     label: "Fed Hike +25bps",           labelZh: "Fed加息+25點子",       detail: "Fed raises rates by 25bps. Target range: 4.75–5.00%.",                                               detailZh: "聯儲局加息25點子，目標利率區間升至4.75–5.00%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2023-05-03", type: "fed",     label: "Fed Hike +25bps",           labelZh: "Fed加息+25點子（末次）", detail: "Fed raises rates by 25bps. Target range: 5.00–5.25%.",                                              detailZh: "聯儲局最後一次加息25點子，目標利率區間升至5.00–5.25%。",                                      source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2024-09-18", type: "fed",     label: "Fed Cut −50bps",            labelZh: "Fed減息−50點子",       detail: "First Fed rate cut since 2020 (−50bps). Target range: 4.75–5.00%.",                                 detailZh: "2020年以來首次減息（−50點子），目標利率區間降至4.75–5.00%。",                                  source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2024-11-07", type: "fed",     label: "Fed Cut −25bps",            labelZh: "Fed減息−25點子",       detail: "Fed cuts rates by 25bps. Target range: 4.50–4.75%.",                                                 detailZh: "聯儲局減息25點子，目標利率區間降至4.50–4.75%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  { date: "2024-12-18", type: "fed",     label: "Fed Cut −25bps",            labelZh: "Fed減息−25點子",       detail: "Fed cuts rates by 25bps. Target range: 4.25–4.50%.",                                                 detailZh: "聯儲局減息25點子，目標利率區間降至4.25–4.50%。",                                              source: "Bankrate", url: "https://www.bankrate.com/banking/federal-reserve/history-of-federal-funds-rate" },
  // ── BTC Halving ──
  { date: "2020-05-11", type: "halving", label: "BTC 3rd Halving",           labelZh: "BTC第三次減半",        detail: "Block reward halved from 12.5 → 6.25 BTC at block height 630,000.",                                 detailZh: "區塊獎勵從12.5減半至6.25 BTC，區塊高度630,000。",                                            source: "Bitget",   url: "https://www.bitget.com/academy/bitcoin-halving-history-timeline-date-price-chart" },
  { date: "2024-04-20", type: "halving", label: "BTC 4th Halving",           labelZh: "BTC第四次減半",        detail: "Block reward halved from 6.25 → 3.125 BTC at block height 840,000.",                                detailZh: "區塊獎勵從6.25減半至3.125 BTC，區塊高度840,000。",                                           source: "Bitget",   url: "https://www.bitget.com/academy/bitcoin-halving-history-timeline-date-price-chart" },
];

const EVENT_COLORS: Record<MarketEvent["type"], string> = {
  crash:   "#ef4444",   // 紅
  fed:     "#60a5fa",   // 藍
  halving: "#facc15",   // 黃
};

const EVENT_LABELS: Record<MarketEvent["type"], string> = {
  crash:   "Market Crash · 市場崩潰",
  fed:     "Fed Decision · 聯儲局決策",
  halving: "BTC Halving · BTC減半",
};

type RollingCorrRow = {
  date:          string;
  eth_btc_corr:  number | null;
  sol_btc_corr:  number | null;   // 2020年前為 null（SOL 尚未上市）
  eth_btc_ratio: number | null;
};

// 時間範圍選項 — 按鈕決定 Brush 預設範圍（不再截斷數據）
const RANGE_OPTIONS = [
  { label: "1W",  days: 7   },
  { label: "1M",  days: 30  },
  { label: "3M",  days: 90  },
  { label: "6M",  days: 180 },
  { label: "1Y",  days: 365 },
  { label: "All", days: 9999 },
];

// 根據 days 算出 Brush 的 startIndex/endIndex
function calcBrushIndices(total: number, days: number): { startIndex: number; endIndex: number } {
  const end = total - 1;
  const start = days >= 9999 ? 0 : Math.max(0, end - days + 1);
  return { startIndex: start, endIndex: end };
}

// 時間範圍選擇器元件（現在控制 Brush 視窗，不截斷數據）
function RangeSelector({
  activeLabel,
  onSelect,
}: {
  activeLabel: string;
  onSelect: (label: string, startIndex: number, endIndex: number) => void;
  total: number;
}) {
  return (
    <div className="flex gap-2">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          onClick={() => {
            // endIndex 由呼叫端計算（需要 total），此處只傳 label；
            // 實際 index 計算在父組件的 handler 裡
            onSelect(opt.label, -1, -1);
          }}
          className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
            activeLabel === opt.label
              ? "border-gray-300 text-white bg-gray-700"
              : "border-gray-700 text-gray-500 hover:text-gray-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const COLORS = {
  eth: "#22c55e",
  sol: "#60a5fa",
  ratio: "#a78bfa",
};

// 自定義 Brush 拖把手 — 細豎線風格，融入深色主題
function BrushTraveller({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return (
    <g>
      {/* 背景矩形（幾乎透明） */}
      <rect x={x} y={y} width={width} height={height} fill="#1e293b" stroke="#334155" strokeWidth={1} rx={2} />
      {/* 兩條細豎線 */}
      <line x1={cx - 2} y1={cy - 4} x2={cx - 2} y2={cy + 4} stroke="#94a3b8" strokeWidth={1} />
      <line x1={cx + 2} y1={cy - 4} x2={cx + 2} y2={cy + 4} stroke="#94a3b8" strokeWidth={1} />
    </g>
  );
}

// 相關係數強度白話標籤
function corrLabel(r: number): string {
  if (r >= 0.8) return "Very High";
  if (r >= 0.6) return "High";
  if (r >= 0.4) return "Moderate";
  if (r >= 0.2) return "Low";
  return "Negligible";
}
function corrLabelZh(r: number): string {
  if (r >= 0.8) return "極高度同步";
  if (r >= 0.6) return "高度同步";
  if (r >= 0.4) return "中度同步";
  if (r >= 0.2) return "低度同步";
  return "幾乎無關";
}

// 輔助：找出某日期的事件（用於 Tooltip 顯示）
function getEventForDate(date: string): MarketEvent | undefined {
  return MARKET_EVENTS.find((e) => e.date === date);
}

// 自定義 Tooltip（相關係數圖）
function CorrTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const event = label ? getEventForDate(label) : undefined;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-xs shadow-xl max-w-xs pointer-events-none">
      <p className="text-gray-400 mb-2">{label}</p>
      {/* 事件資訊：只顯示名稱，鏈接在下方靜態列表 */}
      {event && (
        <div className="mb-2 pb-2 border-b border-gray-700">
          <p className="font-semibold mb-0.5" style={{ color: EVENT_COLORS[event.type] }}>
            {EVENT_LABELS[event.type]}: {event.label}
          </p>
          <p className="text-gray-400 leading-relaxed">{event.detail}</p>
          <p className="text-gray-600 mt-1 italic">↓ See source link in event list below</p>
        </div>
      )}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-4 mb-1">
          <span style={{ color: p.color }} className="font-medium w-20">{p.name}</span>
          <span className="font-mono text-white w-14">{p.value.toFixed(4)}</span>
          <span className="text-gray-500">{corrLabel(p.value)} · {corrLabelZh(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// 自定義 Tooltip（相對強度圖）
function RatioTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const event = label ? getEventForDate(label) : undefined;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-xs shadow-xl max-w-xs pointer-events-none">
      <p className="text-gray-400 mb-2">{label}</p>
      {/* 事件資訊：只顯示名稱，鏈接在下方靜態列表 */}
      {event && (
        <div className="mb-2 pb-2 border-b border-gray-700">
          <p className="font-semibold mb-0.5" style={{ color: EVENT_COLORS[event.type] }}>
            {EVENT_LABELS[event.type]}: {event.label}
          </p>
          <p className="text-gray-400 leading-relaxed">{event.detail}</p>
          <p className="text-gray-600 mt-1 italic">↓ See source link in event list below</p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <span style={{ color: COLORS.ratio }} className="font-medium">ETH/BTC Ratio</span>
        <span className="font-mono text-white">{val?.toFixed(1)}</span>
        <span className="text-gray-500">
          {val !== undefined && val > 100 ? "ETH outperforming BTC · ETH 跑贏" : "BTC outperforming ETH · BTC 主導"}
        </span>
      </div>
    </div>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────────
export default function RollingCorrelationChart({ data }: { data: RollingCorrRow[] }) {
  const [showInfo,     setShowInfo]     = useState(false);
  const [showHowTo,    setShowHowTo]    = useState(false);
  const [showRatioHow, setShowRatioHow] = useState(false);
  const [showEvents,   setShowEvents]   = useState(true);

  // Brush 狀態：記住目前選中的按鈕 label + brush index 範圍
  const [corrRangeLabel,    setCorrRangeLabel]    = useState("6M");
  const [ratioRangeLabel,   setRatioRangeLabel]   = useState("6M");
  const [corrBrush,    setCorrBrush]    = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [ratioBrush,   setRatioBrush]   = useState<{ startIndex: number; endIndex: number } | null>(null);

  const sorted = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const total  = sorted.length;

  // 圖一/圖二：全部數據傳入（不再 slice），由 Brush 控制顯示範圍
  // corrBrush/ratioBrush 為 null 時用預設 6M 範圍
  const corrBrushIdx  = corrBrush  ?? calcBrushIndices(total, 180);
  const ratioBrushIdx = ratioBrush ?? calcBrushIndices(total, 180);

  // 當前 Brush 顯示的數據範圍（用於事件 filter）
  const corrVisible  = sorted.slice(corrBrushIdx.startIndex,  corrBrushIdx.endIndex  + 1);
  const ratioVisible = sorted.slice(ratioBrushIdx.startIndex, ratioBrushIdx.endIndex + 1);

  // 按鈕點擊 handler：更新 label + brush index
  function handleCorrRange(label: string) {
    const opt = RANGE_OPTIONS.find((o) => o.label === label)!;
    setCorrRangeLabel(label);
    setCorrBrush(calcBrushIndices(total, opt.days));
  }
  function handleRatioRange(label: string) {
    const opt = RANGE_OPTIONS.find((o) => o.label === label)!;
    setRatioRangeLabel(label);
    setRatioBrush(calcBrushIndices(total, opt.days));
  }

  // 觸控板橫向滑動：用 non-passive native listener，才能正確 preventDefault 阻止頁面捲動
  const WHEEL_STEP = 5;
  const corrChartRef  = useRef<HTMLDivElement>(null);
  const ratioChartRef = useRef<HTMLDivElement>(null);

  // corrBrushIdx / ratioBrushIdx 在 render 期間計算，wheel handler 需透過 ref 讀取最新值
  const corrBrushIdxRef  = useRef(corrBrushIdx);
  const ratioBrushIdxRef = useRef(ratioBrushIdx);
  corrBrushIdxRef.current  = corrBrushIdx;
  ratioBrushIdxRef.current = ratioBrushIdx;
  const totalRef = useRef(total);
  totalRef.current = total;

  useEffect(() => {
    const el = corrChartRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaX === 0) return;   // 純縱向才放行，有任何橫向分量一律攔截
      e.preventDefault();
      const dir = e.deltaX > 0 ? 1 : -1;
      const cur = corrBrushIdxRef.current;
      const windowSize = cur.endIndex - cur.startIndex;
      const newStart = Math.max(0, Math.min(totalRef.current - windowSize - 1, cur.startIndex + dir * WHEEL_STEP));
      setCorrBrush({ startIndex: newStart, endIndex: newStart + windowSize });
      setCorrRangeLabel("");
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    const el = ratioChartRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.deltaX === 0) return;
      e.preventDefault();
      const dir = e.deltaX > 0 ? 1 : -1;
      const cur = ratioBrushIdxRef.current;
      const windowSize = cur.endIndex - cur.startIndex;
      const newStart = Math.max(0, Math.min(totalRef.current - windowSize - 1, cur.startIndex + dir * WHEEL_STEP));
      setRatioBrush({ startIndex: newStart, endIndex: newStart + windowSize });
      setRatioRangeLabel("");
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const latest = sorted[sorted.length - 1] ?? null;

  // 判斷當前市場狀態（null 視為沒有數據，不觸發信號）
  const isDiverging   = latest
    ? ((latest.eth_btc_corr ?? 1) < 0.7 || (latest.sol_btc_corr ?? 1) < 0.7)
    : false;
  const ethOutperform = latest ? (latest.eth_btc_ratio ?? 0) > 100 : false;
  const altSeason     = isDiverging && ethOutperform;

  return (
    <div className="bg-gray-900 rounded-xl p-6">

      {/* 標題 */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-lg font-semibold">Rolling Correlation vs BTC (60-day)</h3>
          <p className="text-gray-500 text-sm mt-0.5">ETH/SOL 與 BTC 同步程度 · 相對強度 · 山寨季信號</p>
        </div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors flex-shrink-0"
        >
          {showInfo ? "▾" : "▸"} How to read this?
        </button>
      </div>

      {showInfo && (
        <div className="mt-3 mb-5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-sm leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English</p>
              <p className="text-gray-300 mb-2">
                Are ETH and SOL moving in sync with BTC? The top chart shows the <strong className="text-white">60-day rolling correlation</strong> of each coin vs BTC.
                A value near <strong className="text-white">+1.0</strong> means they moved together almost every day; near <strong className="text-white">0</strong> means their daily moves had no consistent relationship.
              </p>
              <p className="text-gray-400">
                The bottom chart shows <strong className="text-white">ETH/BTC relative strength</strong> — rising means ETH is outperforming BTC.
                When correlation drops AND ETH/BTC ratio rises simultaneously, it may signal the early stage of an <strong className="text-white">altcoin season</strong>.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">中文</p>
              <p className="text-gray-300 mb-2">
                ETH 和 SOL 是否跟著 BTC 同步移動？下圖顯示每個幣種與 BTC 的<strong className="text-white"> 60天滾動相關係數</strong>。
                接近 <strong className="text-white">+1.0</strong> 代表幾乎每天都同向移動；接近 <strong className="text-white">0</strong> 代表日常走勢沒有穩定關聯。
              </p>
              <p className="text-gray-400">
                下圖顯示 <strong className="text-white">ETH/BTC 相對強度</strong>——上升代表 ETH 跑贏 BTC。
                當相關係數下降的同時 ETH/BTC 比率上升，可能是<strong className="text-white">山寨季</strong>的早期信號。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 圖一標題列：標題 + How is this calculated */}
      <div className="flex flex-wrap items-center gap-y-2 justify-between mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
          Correlation vs BTC · 與BTC的同步程度
        </p>
        <button
          onClick={() => setShowHowTo((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span>{showHowTo ? "▾" : "▸"}</span>
          <span>How is this calculated? · 計算方法</span>
        </button>
      </div>

      {/* ── 折疊說明區塊 ── */}
      {showHowTo && (
        <div className="bg-gray-800/60 rounded-lg px-4 py-4 mb-5 space-y-4 text-sm">

          {/* 英文說明 */}
          <div className="space-y-2">
            <p className="text-gray-200 font-medium">How the 60-day rolling correlation works:</p>
            <p className="text-gray-400 leading-relaxed">
              Each point on the chart is calculated from the <strong className="text-white">60 trading days before that date</strong>.
              For example, the point at <strong className="text-white">June 1, 2024</strong> uses data from April 2 → June 1, 2024.
              The next point (June 2) shifts the window forward by one day: April 3 → June 2.
              This &quot;rolling window&quot; is repeated for every day, producing a curve that shows how correlation changes over time.
            </p>
            <p className="text-gray-400 leading-relaxed">
              The calculation uses <strong className="text-white">daily return rates</strong> (not prices) — e.g. BTC +2.1%, ETH +1.8% on the same day.
              This removes long-term price trends and focuses on day-to-day co-movement.
              A result near <strong className="text-green-400">+1.0</strong> means they moved together almost every day in that window;
              near <strong className="text-red-400">0</strong> means their daily moves had no consistent relationship.
            </p>
          </div>

          {/* 示意表 */}
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Example: calculating the June 1 data point</p>
            <div className="overflow-x-auto">
              <table className="text-xs text-gray-400 border-collapse w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-1.5 pr-6 text-gray-500 font-medium">Date</th>
                    <th className="text-right py-1.5 pr-6 text-gray-500 font-medium">BTC daily return</th>
                    <th className="text-right py-1.5 pr-6 text-gray-500 font-medium">ETH daily return</th>
                    <th className="text-right py-1.5 text-gray-500 font-medium">Moving together?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Apr 2",  "+2.1%", "+1.8%", "✓ Yes"],
                    ["Apr 3",  "-1.3%", "-1.5%", "✓ Yes"],
                    ["Apr 4",  "+0.8%", "+0.6%", "✓ Yes"],
                    ["...",    "...",   "...",    "..."],
                    ["Jun 1",  "+1.1%", "-0.4%", "✗ No"],
                  ].map(([date, btc, eth, sync], i) => (
                    <tr key={i} className="border-b border-gray-800">
                      <td className="py-1.5 pr-6 text-gray-300">{date}</td>
                      <td className={`py-1.5 pr-6 text-right font-mono ${btc.startsWith("+") ? "text-green-400" : btc === "..." ? "text-gray-600" : "text-red-400"}`}>{btc}</td>
                      <td className={`py-1.5 pr-6 text-right font-mono ${eth.startsWith("+") ? "text-green-400" : eth === "..." ? "text-gray-600" : "text-red-400"}`}>{eth}</td>
                      <td className={`py-1.5 text-right ${sync.startsWith("✓") ? "text-green-500" : sync === "..." ? "text-gray-600" : "text-red-500"}`}>{sync}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-gray-600 text-xs mt-2">→ Pearson r calculated across all 60 rows = the correlation value plotted at June 1</p>
          </div>

          {/* 中文說明 */}
          <div className="pt-2 border-t border-gray-700 space-y-2">
            <p className="text-gray-400 font-medium">中文說明：</p>
            <p className="text-gray-500 leading-relaxed">
              圖表上每一個點，代表的是<strong className="text-white">該日期之前60天</strong>的相關係數。例如「2024年6月1日」這個點，
              是用「4月2日→6月1日」這60天的每日漲跌幅計算出來的。
              第二天（6月2日）的點，窗口向前移一天，變成「4月3日→6月2日」。
              這個「滾動窗口」每天重複計算，最終連成一條曲線，讓你看到相關性如何隨時間變化。
            </p>
            <p className="text-gray-500 leading-relaxed">
              計算用的是<strong className="text-white">每日回報率</strong>（漲跌幅），而不是收盤價。
              這樣可以消除長期價格趨勢的影響，專注於每天同步移動的程度。
              結果接近 <strong className="text-green-400">+1.0</strong> = 那60天裡幾乎每天都同向移動；
              接近 <strong className="text-red-400">0</strong> = 每天漲跌沒有一致的關係。
            </p>
          </div>

        </div>
      )}

      {/* 圖一時間選擇器（現在是 Brush 預設範圍按鈕） */}
      <div className="mb-3">
        <RangeSelector activeLabel={corrRangeLabel} onSelect={(lbl) => handleCorrRange(lbl)} total={total} />
      </div>

      {/* ── 圖一：相關係數（完整數據，由 Brush 控制視窗）── */}
      <div ref={corrChartRef} style={{ touchAction: "pan-y" }}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={sorted} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)} interval="preserveStartEnd" />
          <YAxis domain={[0, 1]} tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(1)} />
          <Tooltip content={<CorrTooltip />} isAnimationActive={false} />
          <ReferenceLine y={0.8} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.15}
            label={{ value: "0.8", position: "right", fill: "#6b7280", fontSize: 10 }} />
          <ReferenceLine y={0.6} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.10}
            label={{ value: "0.6", position: "right", fill: "#6b7280", fontSize: 10 }} />
          {/* 事件標記垂直線 — 只顯示在當前 Brush 視窗內的事件 */}
          {MARKET_EVENTS.filter((e) =>
            corrVisible.length > 0 &&
            e.date >= corrVisible[0].date &&
            e.date <= corrVisible[corrVisible.length - 1].date
          ).map((e) => (
            <ReferenceLine key={e.date} x={e.date}
              stroke={EVENT_COLORS[e.type]} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />
          ))}
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            formatter={(v) => v === "eth_btc_corr" ? "ETH vs BTC" : "SOL vs BTC"} />
          <Line type="monotone" dataKey="eth_btc_corr" stroke={COLORS.eth} dot={false} strokeWidth={1.5}
            activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line type="monotone" dataKey="sol_btc_corr" stroke={COLORS.sol} dot={false} strokeWidth={1.5}
            activeDot={{ r: 5, strokeWidth: 0 }} />
          <Brush
            dataKey="date"
            startIndex={corrBrushIdx.startIndex}
            endIndex={corrBrushIdx.endIndex}
            onChange={(range) => {
              if (range && range.startIndex != null && range.endIndex != null) {
                setCorrRangeLabel("");
                setCorrBrush({ startIndex: range.startIndex, endIndex: range.endIndex });
              }
            }}
            height={16}
            stroke="#1e293b"
            fill="#0f172a"
            travellerWidth={10}
            traveller={BrushTraveller}
            tickFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>

      {/* ── 圖二：ETH/BTC 相對強度 ── */}
      <div className="flex items-center justify-between mt-6 mb-2">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            ETH / BTC Relative Strength · ETH相對BTC強度（基準=100）
          </p>
        </div>
        <button
          onClick={() => setShowRatioHow((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <span>{showRatioHow ? "▾" : "▸"}</span>
          <span>What is this? · 說明</span>
        </button>
      </div>

      {/* 圖二折疊說明 */}
      {showRatioHow && (
        <div className="bg-gray-800/60 rounded-lg px-4 py-3 mb-3 space-y-3 text-sm">
          <p className="text-gray-300 leading-relaxed">
            This chart shows <strong className="text-white">ETH price ÷ BTC price</strong>, normalized so the first data point = 100.
            It answers: is ETH gaining or losing ground against BTC over time?
            <br />
            <span className="text-green-400 font-medium">Above 100</span> = ETH has outperformed BTC since the start of this dataset.{" "}
            <span className="text-red-400 font-medium">Below 100</span> = BTC has outperformed ETH.
            <br />
            When this rises <em>and</em> the correlation chart above drops, that combination is the classic <strong className="text-white">altcoin season</strong> signal.
          </p>
          <p className="text-gray-400 leading-relaxed">
            此圖顯示 <strong className="text-white">ETH收盤價 ÷ BTC收盤價</strong>，以數據起始點標準化為100。
            回答的問題是：ETH 相對 BTC 是在升值還是貶值？
            <br />
            <span className="text-green-400 font-medium">高於100</span> = ETH 自起始點以來跑贏 BTC；
            <span className="text-red-400 font-medium">低於100</span> = BTC 跑贏 ETH。
            <br />
            當此圖上升，且上方相關係數圖同時下降，才構成完整的<strong className="text-white">山寨季</strong>信號。
          </p>
        </div>
      )}

      {/* 圖二時間範圍選擇器（現在是 Brush 預設範圍按鈕） */}
      <div className="mb-3">
        <RangeSelector activeLabel={ratioRangeLabel} onSelect={(lbl) => handleRatioRange(lbl)} total={total} />
      </div>

      {/* 圖二（完整數據，由 Brush 控制視窗）*/}
      <div ref={ratioChartRef} style={{ touchAction: "pan-y" }}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={sorted} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)} interval="preserveStartEnd" />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(0)} />
          <Tooltip content={<RatioTooltip />} isAnimationActive={false} />
          <ReferenceLine y={100} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.2}
            label={{ value: "100", position: "right", fill: "#6b7280", fontSize: 10 }} />
          {/* 事件標記垂直線 — 只顯示在當前 Brush 視窗內的事件 */}
          {MARKET_EVENTS.filter((e) =>
            ratioVisible.length > 0 &&
            e.date >= ratioVisible[0].date &&
            e.date <= ratioVisible[ratioVisible.length - 1].date
          ).map((e) => (
            <ReferenceLine key={e.date} x={e.date}
              stroke={EVENT_COLORS[e.type]} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />
          ))}
          <Line type="monotone" dataKey="eth_btc_ratio" stroke={COLORS.ratio} dot={false} strokeWidth={1.5}
            activeDot={{ r: 5, strokeWidth: 0 }} />
          <Brush
            dataKey="date"
            startIndex={ratioBrushIdx.startIndex}
            endIndex={ratioBrushIdx.endIndex}
            onChange={(range) => {
              if (range && range.startIndex != null && range.endIndex != null) {
                setRatioRangeLabel("");
                setRatioBrush({ startIndex: range.startIndex, endIndex: range.endIndex });
              }
            }}
            height={16}
            stroke="#1e293b"
            fill="#0f172a"
            travellerWidth={10}
            traveller={BrushTraveller}
            tickFormatter={() => ""}
          />
        </LineChart>
      </ResponsiveContainer>
      </div>

      {/* 事件圖例 + 折疊事件列表 */}
      <div className="mt-3">
        {/* 圖例列 + 展開按鈕 */}
        <div className="flex flex-wrap items-center gap-4 mb-2">
          {(["crash", "fed", "halving"] as const).map((type) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: EVENT_COLORS[type] }} />
              <span>{EVENT_LABELS[type]}</span>
            </div>
          ))}
          <button
            onClick={() => setShowEvents((v) => !v)}
            className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>{showEvents ? "▾" : "▸"}</span>
            <span>{showEvents ? "Hide events" : "Show all events"} · 查看所有事件</span>
          </button>
        </div>

        {/* 折疊事件列表 */}
        {showEvents && (
          <div className="bg-gray-800/60 rounded-lg px-4 py-3 space-y-3 text-xs">
            {MARKET_EVENTS.map((e) => (
              <div key={e.date} className="flex gap-3 pb-3 border-b border-gray-700/50 last:border-0 last:pb-0">
                {/* 左：日期 + 顏色條 */}
                <div className="flex-shrink-0 w-24">
                  <span className="font-mono text-gray-500">{e.date}</span>
                  <span
                    className="inline-block mt-1 w-2 h-2 rounded-full"
                    style={{ background: EVENT_COLORS[e.type] }}
                  />
                </div>
                {/* 右：事件說明 */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: EVENT_COLORS[e.type] }}>
                    {e.label} · {e.labelZh}
                  </p>
                  <p className="text-gray-400 mt-0.5 leading-relaxed">{e.detail}</p>
                  <p className="text-gray-500 mt-0.5 leading-relaxed">{e.detailZh}</p>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 mt-1 inline-block"
                  >
                    {e.source} →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 動態解讀 ── */}
      {latest && (
        <div className="mt-5 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
            Latest Reading · 最新數據解讀
          </p>
          <div className="bg-gray-800/60 rounded-lg px-4 py-3 space-y-3">
            {/* 數值一覽 */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.eth }} />
                <span className="text-gray-400">ETH vs BTC:</span>
                <span className="text-white font-semibold font-mono">{latest.eth_btc_corr?.toFixed(4) ?? "—"}</span>
                <span className="text-gray-500">{latest.eth_btc_corr != null ? `${corrLabel(latest.eth_btc_corr)} · ${corrLabelZh(latest.eth_btc_corr)}` : "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.sol }} />
                <span className="text-gray-400">SOL vs BTC:</span>
                <span className="text-white font-semibold font-mono">{latest.sol_btc_corr?.toFixed(4) ?? "—"}</span>
                <span className="text-gray-500">{latest.sol_btc_corr != null ? `${corrLabel(latest.sol_btc_corr)} · ${corrLabelZh(latest.sol_btc_corr)}` : "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS.ratio }} />
                <span className="text-gray-400">ETH/BTC Ratio:</span>
                <span className="text-white font-semibold font-mono">{latest.eth_btc_ratio?.toFixed(1) ?? "—"}</span>
                <span className="text-gray-500">{latest.eth_btc_ratio != null ? (latest.eth_btc_ratio > 100 ? "ETH outperforming" : "BTC dominating") : "—"}</span>
              </div>
            </div>
            {/* 英文解讀 */}
            <p className="text-sm text-gray-300 leading-relaxed">
              As of <strong className="text-white">{latest.date}</strong>,{" "}
              ETH and SOL remain{" "}
              <strong style={{ color: COLORS.eth }}>{latest.eth_btc_corr != null ? corrLabel(latest.eth_btc_corr).toLowerCase() : "—"}</strong> correlated with BTC.
              The ETH/BTC ratio is at <strong className="text-white">{latest.eth_btc_ratio?.toFixed(1) ?? "—"}</strong>{" "}
              ({(latest.eth_btc_ratio ?? 0) > 100 ? "above" : "below"} the baseline of 100),
              meaning ETH has {(latest.eth_btc_ratio ?? 0) > 100 ? "outperformed" : "underperformed"} BTC since the start of this dataset.
              {altSeason
                ? " Both conditions are met — correlation is declining and ETH is outperforming. This is consistent with an early altcoin season pattern."
                : " Altcoin season conditions are not fully met — the market is still largely BTC-driven."}
            </p>
            {/* 中文解讀 */}
            <p className="text-sm text-gray-400 leading-relaxed">
              截至 <strong className="text-white">{latest.date}</strong>，
              ETH 與 BTC 的相關係數為 <strong style={{ color: COLORS.eth }}>{latest.eth_btc_corr?.toFixed(4) ?? "—"}</strong>
              {latest.eth_btc_corr != null ? `（${corrLabelZh(latest.eth_btc_corr)}）` : ""}，
              ETH/BTC 相對強度為 <strong className="text-white">{latest.eth_btc_ratio?.toFixed(1) ?? "—"}</strong>，
              ETH 相對 BTC 自數據起點{(latest.eth_btc_ratio ?? 0) > 100 ? "跑贏" : "跑輸"}。
              {altSeason
                ? "相關係數下降且 ETH 跑贏 BTC，兩個條件同時成立，符合山寨季早期訊號的特徵。"
                : "山寨季條件尚未完全成立——市場目前仍以 BTC 主導為主。"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
