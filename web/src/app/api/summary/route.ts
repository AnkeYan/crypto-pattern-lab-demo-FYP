

// 這個檔案負責：接收分析數據 → 發送給 Gemini → 返回 AI summary


import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const data = await req.json();

  // 格式化數據：百分比欄位乘以100加%，比率類保留原始精度
  const formatted = data.map((r: {
    symbol: string; threshold: number; holding_days: number; sample_size: number;
    mean_return: number; median_return: number; win_rate: number;
    sharpe_ratio: number; sortino_ratio: number; skewness: number; kurtosis: number;
    max_drawdown: number; avg_drawdown: number;
  }) => ({
    symbol:        r.symbol,
    threshold:     `${(r.threshold * 100).toFixed(0)}%`,
    holding_days:  r.holding_days,
    sample_size:   r.sample_size,
    mean_return:   `${(r.mean_return * 100).toFixed(2)}%`,
    median_return: `${(r.median_return * 100).toFixed(2)}%`,
    win_rate:      `${(r.win_rate * 100).toFixed(2)}%`,
    sharpe_ratio:  r.sharpe_ratio,
    sortino_ratio: r.sortino_ratio,
    skewness:      r.skewness,
    kurtosis:      r.kurtosis,
    max_drawdown:  `${(r.max_drawdown * 100).toFixed(2)}%`,
    avg_drawdown:  `${(r.avg_drawdown * 100).toFixed(2)}%`,
  }));

  const prompt = `
You are a professional crypto quantitative research analyst. Analyze the following backtested pattern results and write a structured research summary.

Rules:
- Every single finding MUST cite exact numbers from the data (e.g. "BTC 7d win rate 60.7%", "Sharpe 0.173")
- Do NOT use vague language like "relatively high" or "generally positive" without a number
- If two assets show different results, highlight the contrast with both numbers
- Base ALL conclusions strictly on the data provided — no assumptions beyond the data
- Risk Notes MUST include Max Drawdown and Avg Drawdown numbers for the worst-performing case
- Key Findings MUST compare Sharpe vs Sortino for at least one asset (higher Sortino vs Sharpe = upside-skewed volatility = good)
- Use conservative research language: prefer "suggests", "may indicate", "historically showed", or "exploratory" over absolute claims
- Do NOT present any pattern as a guaranteed edge, reliable alpha, or trade recommendation
- If a row has sample_size below 30, explicitly call it a limited sample and weaken the confidence of the statement
- If results are mixed across assets or holding periods, explicitly say the signal is inconsistent rather than forcing a strong conclusion
- State clearly that this summary is based on historical in-sample statistics only and is not an out-of-sample validation

Use this exact format:

## Crypto Quantitative Research Summary

**Key Findings**
- [finding with exact numbers from data]
- [finding with exact numbers from data]
- [finding with exact numbers from data]

**Risk Notes**
- [Max Drawdown and Avg Drawdown with exact numbers for the riskiest case]
- [another risk with exact numbers from data]

**Conclusion**
[1 cautious sentence on overall signal quality, citing the strongest and weakest result by win rate and Sortino ratio, while acknowledging this is historical in-sample evidence rather than proof of a persistent edge]

Data:
${JSON.stringify(formatted, null, 2)}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    }
  );

  const json = await res.json();

  // If Gemini returns an error, surface it so we can debug
  if (!res.ok || json.error) {
    const errMsg = json.error?.message ?? `HTTP ${res.status}`;
    return NextResponse.json({ summary: `[API Error] ${errMsg}` }, { status: 500 });
  }

  const summary = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary available.";

  return NextResponse.json({ summary });
}