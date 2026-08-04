import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

// 回傳三種數據：
// 1. folds    — walk-forward fold 結果（AUC / accuracy per year per symbol）
// 2. importance — 因子重要性排名（per symbol）
// 3. predictions — 當前 XGBoost 預測勝率（per symbol）

function numOrNull(v: string): number | null {
  if (v === "" || v === "None" || v === "nan") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function strOrNull(v: string): string | null {
  return v === "" || v === "None" || v === "nan" ? null : v;
}

export async function GET() {
  try {
    // ── Load xgb_results.csv ─────────────────────────────────────────────────
    const resultsContent = await readFile(
      process.cwd() + "/public/data/xgb_results.csv",
      "utf-8"
    );

    const rLines = resultsContent.trim().split("\n");
    const rHeader = rLines[0].split(",");
    const rIdxOf = (col: string) => rHeader.indexOf(col);

    const folds: object[]      = [];
    const importance: object[] = [];

    for (const line of rLines.slice(1)) {
      const parts    = line.split(",");
      const row_type = parts[rIdxOf("row_type")] ?? "";
      const symbol   = parts[rIdxOf("symbol")]   ?? "";

      if (row_type === "fold") {
        folds.push({
          symbol,
          test_year:   numOrNull(parts[rIdxOf("test_year")]  ?? ""),
          n_train:     numOrNull(parts[rIdxOf("n_train")]    ?? ""),
          n_test:      numOrNull(parts[rIdxOf("n_test")]     ?? ""),
          auc:         numOrNull(parts[rIdxOf("auc")]        ?? ""),
          accuracy:    numOrNull(parts[rIdxOf("accuracy")]   ?? ""),
          train_start: strOrNull(parts[rIdxOf("train_start")] ?? ""),
          train_end:   strOrNull(parts[rIdxOf("train_end")]   ?? ""),
        });
      } else if (row_type === "importance") {
        importance.push({
          symbol,
          feature:      strOrNull(parts[rIdxOf("feature")]      ?? ""),
          feature_name: strOrNull(parts[rIdxOf("feature_name")] ?? ""),
          importance:   numOrNull(parts[rIdxOf("importance")]   ?? ""),
          rank:         numOrNull(parts[rIdxOf("rank")]         ?? ""),
        });
      }
    }

    // ── Load xgb_predictions.csv ──────────────────────────────────────────────
    const predContent = await readFile(
      process.cwd() + "/public/data/xgb_predictions.csv",
      "utf-8"
    );

    const pLines  = predContent.trim().split("\n");
    const pHeader = pLines[0].split(",");
    const pIdxOf  = (col: string) => pHeader.indexOf(col);

    const predictions = pLines.slice(1).map((line) => {
      const parts = line.split(",");
      return {
        symbol:       parts[pIdxOf("symbol")]       ?? "",
        date:         parts[pIdxOf("date")]         ?? "",
        xgb_win_prob: numOrNull(parts[pIdxOf("xgb_win_prob")] ?? ""),
        calib_score:  numOrNull(parts[pIdxOf("calib_score")]  ?? ""),
      };
    });

    return NextResponse.json({ folds, importance, predictions });
  } catch (err) {
    console.error("/api/xgboost", err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
