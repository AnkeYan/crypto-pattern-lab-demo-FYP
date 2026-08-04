import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/garch_results.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");

    const results = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        symbol: values[0],
        last_price: Number(values[1]),
        annualized_vol: Number(values[2]),
        forecast_vol_1d: Number(values[3]),
        forecast_vol_7d: Number(values[4]),
        mu: Number(values[5]),
        alpha: Number(values[6]),
        beta: Number(values[7]),
        nu: Number(values[8]),
        persistence: Number(values[9]),
        forecast_vol_h1: Number(values[10]),
        forecast_vol_h2: Number(values[11]),
        forecast_vol_h3: Number(values[12]),
        forecast_vol_h4: Number(values[13]),
        forecast_vol_h5: Number(values[14]),
        forecast_vol_h6: Number(values[15]),
        forecast_vol_h7: Number(values[16]),
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/garch]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
