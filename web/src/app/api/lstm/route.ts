import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

function numOrNull(v: string): number | null {
  if (v === "" || v === "None" || v === "nan") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function GET() {
  try {
    const resultsContent = await readFile(
      process.cwd() + "/public/data/lstm_results.csv", "utf-8"
    );
    const rLines  = resultsContent.trim().split("\n");
    const rHeader = rLines[0].split(",");
    const rIdx    = (col: string) => rHeader.indexOf(col);

    const folds = rLines.slice(1).map((line) => {
      const p = line.split(",");
      return {
        symbol:      p[rIdx("symbol")]     ?? "",
        test_year:   numOrNull(p[rIdx("test_year")]   ?? ""),
        n_train:     numOrNull(p[rIdx("n_train")]     ?? ""),
        n_test:      numOrNull(p[rIdx("n_test")]      ?? ""),
        auc:         numOrNull(p[rIdx("auc")]         ?? ""),
        dir_acc:     numOrNull(p[rIdx("dir_acc")]     ?? ""),
        train_start: p[rIdx("train_start")] ?? "",
        train_end:   p[rIdx("train_end")]   ?? "",
      };
    });

    const predContent = await readFile(
      process.cwd() + "/public/data/lstm_predictions.csv", "utf-8"
    );
    const pLines  = predContent.trim().split("\n");
    const pHeader = pLines[0].split(",");
    const pIdx    = (col: string) => pHeader.indexOf(col);

    const predictions = pLines.slice(1).map((line) => {
      const p = line.split(",");
      return {
        symbol:         p[pIdx("symbol")] ?? "",
        date:           p[pIdx("date")]   ?? "",
        lstm_win_prob:  numOrNull(p[pIdx("lstm_win_prob")] ?? ""),
      };
    });

    return NextResponse.json({ folds, predictions });
  } catch (err) {
    console.error("/api/lstm", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
