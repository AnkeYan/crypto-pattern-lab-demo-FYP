import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/regime_transition_results.csv";
    const fileContent = await readFile(filePath, "utf-8");
  
    const lines = fileContent.trim().split("\n");
    const headers = lines[0].split(",");
  
    const results = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number | null> = {};
      headers.forEach((h, i) => {
        if (h === "symbol" || h === "from_regime" || h === "to_regime" || h === "extra") {
          row[h] = values[i] ?? null;
        } else {
          row[h] = numOrNull(values[i] ?? "");
        }
      });
      return row;
    });
  
    return NextResponse.json(results);
  } catch (err) {
    console.error("/api/regime-transition", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
