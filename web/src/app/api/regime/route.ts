import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// 只回傳指定 symbol 的 regime 時間序列（行數多，按需載入）
export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol") ?? "BTCUSDT";
  
    const fileContent = await readFile(
      process.cwd() + "/public/data/regime_results.csv", "utf-8"
    );
    const lines   = fileContent.trim().split("\n");
    const headers = lines[0].split(",");
    const strCols = new Set(["symbol","date","regime"]);
  
    const results = lines.slice(1)
      .filter((line) => line.startsWith(symbol))
      .map((line) => {
        const v = line.split(",");
        const row: Record<string, string | number | null> = {};
        headers.forEach((h, i) => {
          row[h] = strCols.has(h) ? v[i] : numOrNull(v[i]);
        });
        return row;
      });
  
    return NextResponse.json(results);
  } catch (err) {
    console.error("/api/regime", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
