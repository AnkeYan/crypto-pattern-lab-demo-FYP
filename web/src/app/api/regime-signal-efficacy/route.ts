import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/regime_signal_efficacy.csv";
    const fileContent = await readFile(filePath, "utf-8");
    const lines = fileContent.trim().split("\n");
    const headers = lines[0].split(",");
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h.trim()] = (values[i] ?? "").trim(); });
      return obj;
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/regime-signal-efficacy]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
