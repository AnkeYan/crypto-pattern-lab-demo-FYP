import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/funding_rate_history.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");
    const header = lines[0].split(",");

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      const obj: Record<string, string | number> = {};
      header.forEach((h, i) => {
        const v = values[i];
        obj[h.trim()] = isNaN(Number(v)) ? v : Number(v);
      });
      return obj;
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[/api/funding-rate-history]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
