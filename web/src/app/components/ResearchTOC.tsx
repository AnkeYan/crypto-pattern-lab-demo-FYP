"use client";

// ResearchTOC — Research workspace Table of Contents
// Desktop: sticky sidebar (left of content) with section links + active highlighting
// Mobile: horizontal scrollable pill bar at top of research section

import { useEffect, useState } from "react";

type Section = {
  id: string;
  label: string;
  labelZh: string;
  tier: "free" | "pro" | "research";
};

const SECTIONS: Section[] = [
  { id: "summary",           label: "AI Summary",            labelZh: "AI 摘要",       tier: "free"     },
  { id: "results",           label: "Pattern Results",       labelZh: "模式統計表",    tier: "free"     },
  { id: "fear-greed",        label: "Fear & Greed",          labelZh: "恐懼貪婪",      tier: "free"     },
  { id: "rsi",               label: "RSI Analysis",          labelZh: "RSI 超賣",      tier: "pro"      },
  { id: "bollinger",         label: "Bollinger Band",        labelZh: "布林帶",        tier: "pro"      },
  { id: "seasonality",       label: "Month Seasonality",     labelZh: "月份季節性",    tier: "pro"      },
  { id: "consecutive-drop",  label: "Consecutive Drop",      labelZh: "連跌分析",      tier: "pro"      },
  { id: "correlation",       label: "Rolling Correlation",   labelZh: "滾動相關係數",  tier: "pro"      },
  { id: "garch",             label: "GARCH Volatility",      labelZh: "波動率預測",    tier: "research" },
  { id: "drawdown-recovery", label: "Drawdown Recovery",     labelZh: "回撤恢復",      tier: "research" },
  { id: "halving",           label: "Halving Cycle",         labelZh: "減半週期",      tier: "research" },
  { id: "monte-carlo",       label: "Monte Carlo",           labelZh: "蒙特卡洛",      tier: "research" },
];

const TIER_DOT: Record<string, string> = {
  free:     "bg-green-400",
  pro:      "bg-cyan-400",
  research: "bg-purple-400",
};
const TIER_LABEL: Record<string, string> = {
  free: "Free", pro: "Pro", research: "Research",
};

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 96; // header height + some breathing room
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

type Props = {
  mobileOnly?: boolean;
  desktopOnly?: boolean;
};

export default function ResearchTOC({ mobileOnly, desktopOnly }: Props) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the first entry that is intersecting (topmost visible section)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  if (mobileOnly) return (
    <div className="xl:hidden -mx-4 px-4 mb-6 overflow-x-auto">
      <div className="flex gap-1.5 w-max pb-1">
        {SECTIONS.map(({ id, label, tier }) => {
          const isActive = activeId === id;
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0 ${
                isActive
                  ? "bg-white/[0.08] border-white/[0.15] text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TIER_DOT[tier]} ${isActive ? "opacity-100" : "opacity-50"}`} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    /* ── Desktop: sticky left sidebar ── */
    <div className="hidden xl:block w-44 flex-shrink-0 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3 px-1">
          Sections
        </p>

        {/* Tier legend */}
        <div className="flex flex-col gap-1 mb-4 px-1">
          {(["free", "pro", "research"] as const).map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TIER_DOT[t]}`} />
              <span className="text-xs text-gray-500">{TIER_LABEL[t]}</span>
            </div>
          ))}
        </div>

        <nav className="space-y-0.5">
          {SECTIONS.map(({ id, label, labelZh, tier }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-md text-xs transition-colors group ${
                  isActive
                    ? "bg-white/[0.06] text-white"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${TIER_DOT[tier]} ${isActive ? "opacity-100" : "opacity-40 group-hover:opacity-70"}`} />
                <span className="leading-tight">
                  <span className="block">{label}</span>
                  <span className={`block text-xs ${isActive ? "text-gray-400" : "text-gray-600"}`}>{labelZh}</span>
                </span>
              </button>
            );
          })}
        </nav>
    </div>
  );
}
