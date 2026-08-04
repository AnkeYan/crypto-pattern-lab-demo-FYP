import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/pattern_results.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");

    const results = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        symbol: values[0],
        threshold: Number(values[1]),
        holding_days: Number(values[2]),
        sample_size: Number(values[3]),
        mean_return: Number(values[4]),
        median_return: Number(values[5]),
        win_rate: Number(values[6]),
        sharpe_ratio: Number(values[7]),
        sortino_ratio: Number(values[8]),
        skewness: Number(values[9]),
        kurtosis: Number(values[10]),
        max_drawdown: Number(values[11]),
        avg_drawdown: Number(values[12]),
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/results]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}