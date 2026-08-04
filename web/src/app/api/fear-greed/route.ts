import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/fear_greed_results.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");
    const headers = lines[0].split(",");

    const idx = (name: string) => headers.indexOf(name);

    const results = lines.slice(1).map((line) => {
      const v = line.split(",");
      const num = (col: string) => {
        const val = v[idx(col)];
        return val === "" || val === undefined ? null : Number(val);
      };
      return {
        symbol:       v[idx("symbol")],
        threshold:    num("threshold"),
        holding_days: num("holding_days"),
        sample_size:  num("sample_size"),
        corr_fg_same_day: num("corr_fg_same_day"),
        p_fg_same_day:    num("p_fg_same_day"),
        corr_fg_pre7:     num("corr_fg_pre7"),
        p_fg_pre7:        num("p_fg_pre7"),
        ef_n:        num("ef_n"),
        ef_mean:     num("ef_mean"),
        ef_win_rate: num("ef_win_rate"),
        fe_n:        num("fe_n"),
        fe_mean:     num("fe_mean"),
        fe_win_rate: num("fe_win_rate"),
        ne_n:        num("ne_n"),
        ne_mean:     num("ne_mean"),
        ne_win_rate: num("ne_win_rate"),
        gr_n:        num("gr_n"),
        gr_mean:     num("gr_mean"),
        gr_win_rate: num("gr_win_rate"),
        eg_n:        num("eg_n"),
        eg_mean:     num("eg_mean"),
        eg_win_rate: num("eg_win_rate"),
      };
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/fear-greed]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
