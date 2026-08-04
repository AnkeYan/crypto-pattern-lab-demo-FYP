import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(value: string) {
  if (value === "" || value === "null" || value === "None" || value === "NaN") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/pattern_validation_results.csv";
    const fileContent = await readFile(filePath, "utf-8");
    const lines = fileContent.trim().split("\n");
  
    const results = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        symbol: values[0],
        threshold: numOrNull(values[1]),
        holding_days: numOrNull(values[2]),
        discovery_start: values[3],
        discovery_end: values[4],
        validation_start: values[5],
        validation_end: values[6],
        discovery_sample_size: numOrNull(values[7]),
        discovery_mean_return: numOrNull(values[8]),
        discovery_median_return: numOrNull(values[9]),
        discovery_win_rate: numOrNull(values[10]),
        discovery_sharpe_ratio: numOrNull(values[11]),
        discovery_sortino_ratio: numOrNull(values[12]),
        discovery_max_drawdown: numOrNull(values[13]),
        validation_sample_size: numOrNull(values[14]),
        validation_mean_return: numOrNull(values[15]),
        validation_median_return: numOrNull(values[16]),
        validation_win_rate: numOrNull(values[17]),
        validation_sharpe_ratio: numOrNull(values[18]),
        validation_sortino_ratio: numOrNull(values[19]),
        validation_max_drawdown: numOrNull(values[20]),
        consistency_flag: values[21],
        confidence_label: values[22],
        confidence_score: numOrNull(values[23]),
        confidence_reasons: values[24],
        summary_note: values[25],
      };
    });
  
    return NextResponse.json(results);
  } catch (err) {
    console.error("/api/pattern-validation", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
