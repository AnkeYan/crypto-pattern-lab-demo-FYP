import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const [statsContent, pathContent] = await Promise.all([
      readFile(process.cwd() + "/public/data/halving_results.csv", "utf-8"),
      readFile(process.cwd() + "/public/data/halving_price_path.csv", "utf-8"),
    ]);
  
    // Parse stats
    const statsLines   = statsContent.trim().split("\n");
    const statsHeaders = statsLines[0].split(",");
    const stats = statsLines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number | null | boolean> = {};
      statsHeaders.forEach((h, i) => {
        if (h === "date") {
          row[h] = values[i];
        } else if (h.endsWith("_available")) {
          row[h] = values[i] === "True";
        } else {
          row[h] = numOrNull(values[i] ?? "");
        }
      });
      return row;
    });
  
    // Parse price path
    const pathLines   = pathContent.trim().split("\n");
    const pathHeaders = pathLines[0].split(",");
    const path = pathLines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, string | number | null> = {};
      pathHeaders.forEach((h, i) => {
        row[h] = h === "date" ? values[i] : numOrNull(values[i] ?? "");
      });
      return row;
    });
  
    return NextResponse.json({ stats, path });
  } catch (err) {
    console.error("/api/halving", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
