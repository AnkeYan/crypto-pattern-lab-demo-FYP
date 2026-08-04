import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/rolling_correlation.csv";
    const fileContent = await readFile(filePath, "utf-8");
  
    const lines = fileContent.trim().split("\n");
    const headers = lines[0].split(",");
    const idx = (name: string) => headers.indexOf(name);
  
    const results = lines.slice(1).map((line) => {
      const v = line.split(",");
      const numOrNull = (col: string): number | null => {
        const val = v[idx(col)];
        if (val === "" || val === undefined) return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
      };
      return {
        date:          v[idx("date")],
        eth_btc_corr:  numOrNull("eth_btc_corr"),
        sol_btc_corr:  numOrNull("sol_btc_corr"),   // 2020年前為 null
        eth_btc_ratio: numOrNull("eth_btc_ratio"),
      };
    });
  
    return NextResponse.json(results);
  } catch (err) {
    console.error("/api/rolling-correlation", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
