"use client";

import { useEffect, useState, useCallback } from "react";

type DomRow = {
  date: string;
  btc_dominance: number;
};

function domSvg(data: DomRow[], width = 560, height = 100): string {
  if (data.length < 2) return "";
  const vals = data.map((d) => d.btc_dominance);
  const minV = Math.max(0, Math.min(...vals) - 2);
  const maxV = Math.min(100, Math.max(...vals) + 2);
  const range = maxV - minV || 1;
  const padL = 8, padR = 8, padT = 8, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const toY = (v: number) => padT + h - ((v - minV) / range) * h;
  const toX = (i: number) => padL + (i / (data.length - 1)) * w;

  const pts = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.btc_dominance).toFixed(1)}`).join(" ");

  // Area
  const areaPoints = `${padL},${padT + h} ${pts} ${padL + w},${padT + h}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<polygon points="${areaPoints}" fill="#f59e0b" opacity="0.15"/>
<polyline points="${pts}" fill="none" stroke="#f59e0b" stroke-width="2"/>
</svg>`;
}

function changeBar7d(data: DomRow[]): string {
  if (data.length < 8) return "";
  const current = data[data.length - 1].btc_dominance;
  const prev7 = data[data.length - 8]?.btc_dominance ?? current;
  const change = current - prev7;
  const absChange = Math.abs(change);
  const barWidth = Math.min(absChange * 15, 80);
  const color = change > 0 ? "#4ade80" : "#f87171";
  const sign = change > 0 ? "+" : "";
  return `<svg width="120" height="20" viewBox="0 0 120 20">
<rect x="0" y="6" width="${barWidth.toFixed(1)}" height="8" fill="${color}" rx="2" opacity="0.8"/>
<text x="${barWidth + 4}" y="14" font-size="10" fill="${color}">${sign}${change.toFixed(2)}%</text>
</svg>`;
}

export default function BtcDominancePanel() {
  const [data, setData] = useState<DomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const rows = await fetch("/api/btc-dominance-history").then((r) => r.json());
      setData(rows.sort((a: DomRow, b: DomRow) => a.date.localeCompare(b.date)));
    } catch {
      setError("Failed to load BTC dominance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latest = data[data.length - 1];
  const prev7 = data[data.length - 8];
  const change7d = latest && prev7 ? latest.btc_dominance - prev7.btc_dominance : null;

  const domLabel =
    !latest ? null
    : latest.btc_dominance > 60 ? { text: "BTC dominance high · 市場避險", color: "text-green-400" }
    : latest.btc_dominance < 45 ? { text: "Altcoin season · 山寨幣季節", color: "text-purple-400" }
    : { text: "Balanced · 均衡市場", color: "text-slate-300" };

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">F15 · BTC Dominance</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            BTC market cap share · BTC 市場佔有率
          </p>
        </div>
        <span className="px-2.5 py-1 text-xs rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 font-medium">
          Dashboard Only
        </span>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm py-4">{error}</p>
      ) : !latest ? (
        <p className="text-slate-400 text-sm py-4">No data available.</p>
      ) : (
        <div className="space-y-4">
          {/* Snapshot */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">BTC Dominance · 佔有率</p>
              <p className={`text-2xl font-mono font-bold ${domLabel?.color}`}>
                {latest.btc_dominance.toFixed(2)}%
              </p>
              <p className={`text-xs mt-0.5 ${domLabel?.color}`}>{domLabel?.text}</p>
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">7d Change · 7日變化</p>
              {change7d !== null ? (
                <>
                  <p className={`text-2xl font-mono font-bold ${change7d > 0 ? "text-green-400" : change7d < 0 ? "text-red-400" : "text-slate-300"}`}>
                    {change7d > 0 ? "+" : ""}{change7d.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {change7d > 0.5 ? "↑ Risk-off · 避險" : change7d < -0.5 ? "↓ Risk-on · 偏好風險" : "→ Stable · 穩定"}
                  </p>
                </>
              ) : (
                <p className="text-slate-400 text-sm">—</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-700/40 p-3">
              <p className="text-xs text-slate-400 mb-1">Data Range · 數據範圍</p>
              <p className="text-sm font-mono text-slate-300">30d</p>
              <p className="text-xs text-slate-500 mt-0.5">F15 not in XGBoost</p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg bg-slate-700/30 p-3 overflow-x-auto">
            <p className="text-xs text-slate-400 mb-2">BTC Dominance History (30d) · 30日走勢</p>
            <div dangerouslySetInnerHTML={{ __html: domSvg(data, 560, 100) }} />
          </div>

          {/* 說明框 */}
          <div className="rounded-lg bg-slate-700/30 border border-slate-600/40 p-4 text-sm text-slate-300 space-y-2">
            <p className="font-medium text-slate-100">📖 How to Read · 怎麼看</p>
            <p>
              BTC 佔有率是「加密市場整體情緒指南針」——BTC 佔比上升，代表資金流向比特幣（避險模式），山寨幣（ETH/SOL）承壓；BTC 佔比下降，代表資金輪動到山寨幣（進攻模式）。
              <br />
              <span className="text-xs text-slate-500">
                BTC dominance rising = risk-off rotation into BTC → bearish for ETH/SOL. Falling = altcoin season signal.
              </span>
            </p>
            <p>
              <span className="text-slate-400">⚠️ 限制：</span>
              F15 目前只有 30 天歷史數據，不足以進入 XGBoost 訓練（XGBoost 需要多年數據才有效）。F15 只作 Dashboard 展示因子，等數據累積到 1 年以上才加入模型。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
