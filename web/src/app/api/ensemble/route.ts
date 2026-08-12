import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const parse = (file: string) =>
      readFile(process.cwd() + `/public/data/${file}`, "utf-8").then((raw) => {
        const lines = raw.trim().split("\n");
        const headers = lines[0].split(",");
        return lines.slice(1).map((line) => {
          const vals = line.split(",");
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? "").trim(); });
          return obj;
        });
      });

    const [folds, predictions] = await Promise.all([
      parse("ensemble_results.csv"),
      parse("ensemble_predictions.csv"),
    ]);

    return NextResponse.json({ folds, predictions });
  } catch (err) {
    console.error("[/api/ensemble]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
