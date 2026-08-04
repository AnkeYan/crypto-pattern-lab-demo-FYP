import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

// ── Student-t 抽樣（Box-Muller + Gamma 近似）────────────────────────────────
// 標準 Student-t(nu) 可以由 Z / sqrt(V/nu) 生成，其中 Z ~ N(0,1)，V ~ chi²(nu)
function sampleStudentT(nu: number): number {
  // Box-Muller 生成標準正態
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // chi²(nu) = Gamma(nu/2, 2)，用 Marsaglia-Tsang gamma sampler
  const v = sampleGamma(nu / 2) * 2;
  return z / Math.sqrt(v / nu);
}

// Marsaglia-Tsang "squeeze" gamma sampler（alpha >= 1）
function sampleGamma(alpha: number): number {
  if (alpha < 1) return sampleGamma(1 + alpha) * Math.pow(Math.random(), 1 / alpha);
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do {
      x = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// ── 百分位計算 ────────────────────────────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── GarchRow ──────────────────────────────────────────────────────────────────
type GarchRow = {
  symbol: string;
  last_price: number;
  mu: number;
  nu: number;
  forecast_vol_h1: number;
  forecast_vol_h2: number;
  forecast_vol_h3: number;
  forecast_vol_h4: number;
  forecast_vol_h5: number;
  forecast_vol_h6: number;
  forecast_vol_h7: number;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol     = searchParams.get("symbol")     ?? "BTCUSDT";
  const horizon    = Math.min(parseInt(searchParams.get("horizon")     ?? "30"), 60);
  const nSims      = Math.min(parseInt(searchParams.get("simulations") ?? "500"), 1000);
  const pathsToReturn = 50; // 前端只繪製 50 條路徑，百分位帶用全部 500 條計算

  // 讀取 GARCH 結果
  const filePath   = process.cwd() + "/public/data/garch_results.csv";
  const fileContent = await readFile(filePath, "utf-8");
  const lines      = fileContent.trim().split("\n");
  const headers    = lines[0].split(",");

  const allRows: GarchRow[] = lines.slice(1).map((line) => {
    const v = line.split(",");
    const row: Record<string, string | number> = {};
    headers.forEach((h, i) => { row[h] = h === "symbol" ? v[i] : Number(v[i]); });
    return row as unknown as GarchRow;
  });

  const garch = allRows.find((r) => r.symbol === symbol);
  if (!garch) return NextResponse.json({ error: "Symbol not found" }, { status: 404 });

  // 逐日 vol forecast：h1~h7，h8 之後用 h7 延伸（GARCH 長期均值回歸）
  const volSchedule: number[] = [];
  const volH = [
    garch.forecast_vol_h1, garch.forecast_vol_h2, garch.forecast_vol_h3,
    garch.forecast_vol_h4, garch.forecast_vol_h5, garch.forecast_vol_h6,
    garch.forecast_vol_h7,
  ];
  for (let d = 0; d < horizon; d++) {
    volSchedule.push(d < 7 ? volH[d] : garch.forecast_vol_h7);
  }

  const S0  = garch.last_price;
  const mu  = garch.mu;
  const nu  = Math.max(garch.nu, 2.5); // nu >= 2.5 保證方差存在

  // ── Monte Carlo ────────────────────────────────────────────────────────────
  // paths[i] = 長度為 horizon+1 的價格序列（含第 0 天 = S0）
  const allPaths: number[][] = [];

  for (let sim = 0; sim < nSims; sim++) {
    const path: number[] = [S0];
    let price = S0;
    for (let d = 0; d < horizon; d++) {
      const sigma   = volSchedule[d];
      const epsilon = sampleStudentT(nu);
      // Ito drift correction: mu - 0.5*sigma² 才是對數價格的期望漂移
      const logReturn = mu - 0.5 * sigma * sigma + sigma * epsilon;
      price = price * Math.exp(logReturn);
      path.push(Math.round(price * 100) / 100); // 保留兩位小數
    }
    allPaths.push(path);
  }

  // ── 每天的百分位帶 ─────────────────────────────────────────────────────────
  const bands: {
    day: number;
    p5: number; p25: number; p50: number; p75: number; p95: number;
  }[] = [];

  for (let d = 0; d <= horizon; d++) {
    const prices = allPaths.map((p) => p[d]).sort((a, b) => a - b);
    bands.push({
      day: d,
      p5:  Math.round(percentile(prices, 5)  * 100) / 100,
      p25: Math.round(percentile(prices, 25) * 100) / 100,
      p50: Math.round(percentile(prices, 50) * 100) / 100,
      p75: Math.round(percentile(prices, 75) * 100) / 100,
      p95: Math.round(percentile(prices, 95) * 100) / 100,
    });
  }

  // 只返回 pathsToReturn 條路徑用於前端繪圖
  const samplePaths = allPaths
    .filter((_, i) => i % Math.floor(nSims / pathsToReturn) === 0)
    .slice(0, pathsToReturn);

  // ── 末日統計摘要 ──────────────────────────────────────────────────────────
  const finalPrices = allPaths.map((p) => p[horizon]).sort((a, b) => a - b);
  const finalP5  = percentile(finalPrices, 5);
  const finalP95 = percentile(finalPrices, 95);
  const probUp   = allPaths.filter((p) => p[horizon] > S0).length / nSims;

  return NextResponse.json({
    symbol,
    horizon,
    simulations: nSims,
    last_price: S0,
    bands,
    sample_paths: samplePaths,
    summary: {
      median:   Math.round(bands[horizon].p50 * 100) / 100,
      p5:       Math.round(finalP5  * 100) / 100,
      p95:      Math.round(finalP95 * 100) / 100,
      prob_up:  Math.round(probUp * 1000) / 1000,
      expected_return: Math.round((bands[horizon].p50 / S0 - 1) * 10000) / 100, // %
    },
  });
}
