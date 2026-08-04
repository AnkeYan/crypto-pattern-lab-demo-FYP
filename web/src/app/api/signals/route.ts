import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// 三個 CSV 合併成一個 endpoint，減少前端 fetch 次數
export async function GET() {
  try {
    const base = process.cwd() + "/public/data/";

    const [summaryRaw, confRaw] = await Promise.all([
      readFile(base + "signal_summary.csv",    "utf-8"),
      readFile(base + "confluence_results.csv","utf-8"),
    ]);

    // signal_summary
    const sumLines   = summaryRaw.trim().split("\n");
    const sumHeaders = sumLines[0].split(",");
    const boolCols   = new Set(["sig_rsi","sig_bollinger","sig_drop3","sig_vol_spike"]);
    const strCols    = new Set(["symbol","current_regime"]);
    const summary = sumLines.slice(1).map((line) => {
      const v = line.split(",");
      const row: Record<string, string | number | boolean | null> = {};
      sumHeaders.forEach((h, i) => {
        if (strCols.has(h))  row[h] = v[i];
        else if (boolCols.has(h)) row[h] = v[i] === "True";
        else row[h] = numOrNull(v[i]);
      });
      return row;
    });

    // confluence_results
    const confLines   = confRaw.trim().split("\n");
    const confHeaders = confLines[0].split(",");
    const confStrCols = new Set(["symbol","signals","regime"]);
    const confluence = confLines.slice(1).map((line) => {
      const v = line.split(",");
      const row: Record<string, string | number | null> = {};
      confHeaders.forEach((h, i) => {
        row[h] = confStrCols.has(h) ? v[i] : numOrNull(v[i]);
      });
      return row;
    });

    return NextResponse.json({ summary, confluence });
  } catch (err) {
    console.error("[/api/signals]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
