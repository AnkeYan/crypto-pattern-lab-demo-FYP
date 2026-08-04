// 這個檔案負責：Client 端按鈕 → 呼叫 /api/summary → 顯示 AI summary（支援 Markdown 渲染）

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

type PatternResult = {
  symbol: string;
  threshold: number;
  holding_days: number;
  sample_size: number;
  mean_return: number;
  median_return: number;
  win_rate: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  skewness: number;
  kurtosis: number;
  max_drawdown: number;
  avg_drawdown: number;
};

export default function SummaryButton({ data }: { data: PatternResult[] }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setSummary(json.summary);
    setLoading(false);
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleClick}
          disabled={loading}
          className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Generating..." : "✨ Generate AI Summary"}
        </button>
        <p className="text-xs text-gray-500 leading-relaxed">
          Based on Pattern Results data · Powered by Gemini 2.5 Flash<br />
          基於 Pattern Results 數據 · 僅供研究參考，非投資建議
        </p>
      </div>
      {summary && (
        <div className="mt-4 bg-gray-800 rounded-xl p-6 text-gray-200 leading-relaxed">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="text-green-400 font-bold text-lg mt-6 mb-2 first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-green-300 font-semibold mt-4 mb-1">{children}</h3>
              ),
              strong: ({ children }) => (
                <strong className="text-white font-semibold">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-2 my-3 ml-2">{children}</ul>
              ),
              li: ({ children }) => (
                <li className="text-gray-300">{children}</li>
              ),
              p: ({ children }) => (
                <p className="my-3 text-gray-200">{children}</p>
              ),
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}