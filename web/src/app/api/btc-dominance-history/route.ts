import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath =
      process.cwd() + "/public/data/btc_dominance_history.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        date: values[0].split(" ")[0].split("T")[0],
        btc_dominance: Number(values[1]),
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[/api/btc-dominance-history]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
