import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (!v || v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const content = await readFile(
      process.cwd() + "/public/data/rl_backtest.csv",
      "utf-8"
    );
    const lines   = content.trim().split("\n");
    const headers = lines[0].split(",");

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number | null> = {};
      headers.forEach((h, i) => {
        const v = values[i] ?? "";
        if (h === "row_type" || h === "label") {
          row[h] = v.trim();
        } else {
          row[h] = numOrNull(v.trim());
        }
      });
      return row;
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("/api/rl-backtest", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
