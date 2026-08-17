import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath =
      process.cwd() + "/public/data/active_addresses_history.csv";
    const fileContent = await readFile(filePath, "utf-8");

    const lines = fileContent.trim().split("\n");

    const rows = lines.slice(1).map((line) => {
      const values = line.split(",");
      return {
        date: values[0].split(" ")[0].split("T")[0],
        addr_count: Number(values[1]),
        ma30: Number(values[2]),
        ratio: Number(values[3]),
        f11_norm: Number(values[4]),
      };
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[/api/active-addresses-history]", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
