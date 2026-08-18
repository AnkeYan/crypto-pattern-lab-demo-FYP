import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

// 回傳兩種數據：
// 1. summary — 每個 symbol × pct_bucket 的聚合統計（前端表格用）
// 2. scatter — 每個 symbol 的 score vs outcome_7d 樣本點（前端散點圖用，隨機抽樣 300 點控制大小）

type SummaryRow = {
  symbol: string;
  pct_bucket: string;
  n: number;
  win_rate: number;
  mean_7d: number;
  score_min: number;
  score_max: number;
};

type ScatterPoint = {
  score: number;
  outcome_7d: number;
  win: number;
};

type VolRow = {
  symbol: string;
  date: string;
  f7_cont: number;
  f8_cont: number;
  f9_cont: number;
  f14_cont: number;
};

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const PCT_BUCKET_ORDER = ["bottom 50%", "top 50%", "top 25%", "top 10%"];
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const SCATTER_SAMPLE = 400; // 每個 symbol 最多回傳幾個散點

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/multifactor_calibration.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");
    // header: symbol,date,score,score_bucket,f1_norm,f2_norm,f3_norm,f4_norm,
    //         f5_norm,f6_norm,f7_norm,f8_norm,outcome_7d,win,percentile_rank,pct_bucket
    const header = lines[0].split(",");
    const idxOf = (col: string) => header.indexOf(col);

    const iSym    = idxOf("symbol");
    const iScore  = idxOf("score");
    const iPctBkt = idxOf("pct_bucket");
    const iOut7d  = idxOf("outcome_7d");
    const iWin    = idxOf("win");

    // Parse all rows into a minimal structure
    type Row = { symbol: string; score: number; pct_bucket: string; outcome_7d: number; win: number };
    const rows: Row[] = [];
    const iDate  = idxOf("date");
    const iF7    = idxOf("f7_cont");
    const iF8    = idxOf("f8_cont");
    const iF9    = idxOf("f9_cont");
    const iF14   = idxOf("f14_cont");
    const volRows: VolRow[] = [];

    for (const line of lines.slice(1)) {
      const parts = line.split(",");
      const score      = numOrNull(parts[iScore]  ?? "");
      const outcome_7d = numOrNull(parts[iOut7d]  ?? "");
      const win        = numOrNull(parts[iWin]    ?? "");
      if (score === null || outcome_7d === null || win === null) continue;
      rows.push({
        symbol:     parts[iSym]    ?? "",
        score,
        pct_bucket: parts[iPctBkt] ?? "",
        outcome_7d,
        win,
      });
      // Collect f7/f8/f9/f14 for VolumeMomentumPanel + FundingRatePanel
      const f7  = iF7  >= 0 ? numOrNull(parts[iF7]  ?? "") : null;
      const f8  = iF8  >= 0 ? numOrNull(parts[iF8]  ?? "") : null;
      const f9  = iF9  >= 0 ? numOrNull(parts[iF9]  ?? "") : null;
      const f14 = iF14 >= 0 ? numOrNull(parts[iF14] ?? "") : null;
      if (f7 !== null && f8 !== null) {
        volRows.push({
          symbol:  parts[iSym]  ?? "",
          date:    parts[iDate] ?? "",
          f7_cont: f7,
          f8_cont: f8,
          f9_cont:  f9  ?? 0.5,
          f14_cont: f14 ?? 0.5,
        });
      }
    }

    // ── Build summary ─────────────────────────────────────────────────────────
    const summary: SummaryRow[] = [];
    for (const sym of SYMBOLS) {
      const symRows = rows.filter((r) => r.symbol === sym);
      for (const bucket of PCT_BUCKET_ORDER) {
        const bRows = symRows.filter((r) => r.pct_bucket === bucket);
        if (bRows.length === 0) continue;
        const wins    = bRows.filter((r) => r.win === 1).length;
        const meanOut = bRows.reduce((s, r) => s + r.outcome_7d, 0) / bRows.length;
        const scores  = bRows.map((r) => r.score);
        summary.push({
          symbol:     sym,
          pct_bucket: bucket,
          n:          bRows.length,
          win_rate:   Math.round((wins / bRows.length) * 1000) / 1000,
          mean_7d:    Math.round(meanOut * 10000) / 10000,
          score_min:  Math.min(...scores),
          score_max:  Math.max(...scores),
        });
      }
    }

    // ── Build scatter (random sample per symbol) ──────────────────────────────
    const scatter: Record<string, ScatterPoint[]> = {};
    for (const sym of SYMBOLS) {
      const symRows = rows.filter((r) => r.symbol === sym);
      // Reservoir sampling (shuffle + slice)
      const shuffled = symRows
        .map((r) => ({ r, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map((x) => x.r)
        .slice(0, SCATTER_SAMPLE);
      scatter[sym] = shuffled.map((r) => ({
        score:      r.score,
        outcome_7d: Math.round(r.outcome_7d * 10000) / 10000,
        win:        r.win,
      }));
    }

    return NextResponse.json({ summary, scatter, rows: volRows });
  } catch (err) {
    console.error("/api/multifactor-calibration", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
