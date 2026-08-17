import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = process.cwd() + "/public/data/mvrv_history.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        symbol: values[0],
        date: values[1].split(" ")[0].split("T")[0], // normalize to YYYY-MM-DD
        mvrv: Number(values[2]),
        f13_norm: Number(values[3]),
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[/api/mvrv-history]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
