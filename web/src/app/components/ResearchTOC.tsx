"use client";

// ResearchTOC — FYP 副本版（無 Tier 顏色點和 legend）
// Desktop: sticky sidebar with section links + active highlighting
// Mobile: horizontal scrollable pill bar

import { useEffect, useState } from "react";

type Section = {
  id: string;
  label: string;
  labelZh: string;
};

const SECTIONS: Section[] = [
  { id: "summary",          label: "AI Summary",        labelZh: "AI 摘要"    },
  { id: "results",          label: "Pattern Results",   labelZh: "模式統計表" },
  { id: "fear-greed",       label: "Fear & Greed",      labelZh: "恐懼貪婪"   },
  { id: "rsi",              label: "RSI Analysis",      labelZh: "RSI 超賣"   },
  { id: "bollinger",        label: "Bollinger Band",    labelZh: "布林帶"     },
  { id: "seasonality",      label: "Month Seasonality", labelZh: "月份季節性" },
  { id: "consecutive-drop", label: "Consecutive Drop",  labelZh: "連跌分析"   },
  { id: "halving",          label: "Halving Cycle",     labelZh: "減半週期"   },
];

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 96;
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
        {SECTIONS.map(({ id, label }) => {
          const isActive = activeId === id;
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0 ${
                isActive
                  ? "bg-white/[0.08] border-white/[0.15] text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="hidden xl:block w-44 flex-shrink-0 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
      <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3 px-1">
        Sections
      </p>

      <nav className="space-y-0.5">
        {SECTIONS.map(({ id, label, labelZh }) => {
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
