import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const raw = await readFile(process.cwd() + "/public/data/factor_ic_results.csv", "utf-8");
    const lines = raw.trim().split("\n");
    const headers = lines[0].split(",");
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? "").trim(); });
      return obj;
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/factor-ic]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
