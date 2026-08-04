import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/walk_forward_results.csv";
    const fileContent = await readFile(filePath, "utf-8");
  
    const lines = fileContent.trim().split("\n");
    const headers = lines[0].split(",");
  
    const strCols = new Set(["symbol", "train_start", "train_end", "test_start", "test_end", "pass_flag"]);
  
    const results = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number | null> = {};
      headers.forEach((h, i) => {
        row[h] = strCols.has(h) ? values[i] : numOrNull(values[i]);
      });
      return row;
    });
  
    return NextResponse.json(results);
  } catch (err) {
    console.error("/api/walk-forward", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
