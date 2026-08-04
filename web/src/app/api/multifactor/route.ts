import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/multifactor_results.csv";
    const fileContent = await readFile(filePath, "utf-8");
  
    const lines = fileContent.trim().split("\n");
    // header: symbol,factor,raw_value,normalized_score,weight,weighted_score,description
    // description can contain commas — join tail columns back
    const results = lines.slice(1).map((line) => {
      const parts = line.split(",");
      const symbol           = parts[0];
      const factor           = parts[1];
      const raw_value        = numOrNull(parts[2] ?? "");
      const normalized_score = numOrNull(parts[3] ?? "");
      const weight           = numOrNull(parts[4] ?? "");
      const weighted_score   = numOrNull(parts[5] ?? "");
      // description may contain commas; rejoin remaining parts and strip quotes
      const description = parts.slice(6).join(",").replace(/^"|"$/g, "");
      return { symbol, factor, raw_value, normalized_score, weight, weighted_score, description };
    });
  
    return NextResponse.json(results);
  } catch (err) {
    console.error("/api/multifactor", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
