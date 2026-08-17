"use client";

// WorkspaceTOC — 通用 sidebar/pill TOC，供 Validation/Signals/Factors 使用
// 用 tier 顏色點區分 Free/Pro/Research

import { useEffect, useState } from "react";

export type TocSection = {
  id: string;
  label: string;
  labelZh: string;
  tier: "free" | "pro" | "research";
};

const TIER_DOT: Record<string, string> = {
  free:     "bg-green-400",
  pro:      "bg-cyan-400",
  research: "bg-purple-400",
};

type Props = {
  sections: TocSection[];
  /** Show only on mobile (below xl) */
  mobileOnly?: boolean;
  /** Show only on desktop (xl+) */
  desktopOnly?: boolean;
  accentColor?: string; // tailwind text color class for "Sections" heading, e.g. "text-cyan-500"
};

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 96;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

export default function WorkspaceTOC({
  sections,
  mobileOnly,
  desktopOnly,
  accentColor = "text-gray-500",
}: Props) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  if (mobileOnly) return (
    <div className="xl:hidden -mx-4 px-4 mb-6 overflow-x-auto">
      <div className="flex gap-1.5 w-max pb-1">
        {sections.map(({ id, label, tier }) => {
          const isActive = activeId === id;
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors flex-shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? "bg-white/[0.08] border-white/[0.15] text-white"
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TIER_DOT[tier]}`} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (desktopOnly) return (
    <div className="hidden xl:block w-44 flex-shrink-0 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
      <p className={`text-xs font-semibold tracking-widest uppercase mb-3 px-1 ${accentColor}`}>
        Sections
      </p>

      <nav className="space-y-0.5">
        {sections.map(({ id, label, labelZh, tier }) => {
          const isActive = activeId === id;
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                isActive
                  ? "bg-white/[0.06] text-white"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]"
              }`}
            >
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${TIER_DOT[tier]}`} />
              <span className="leading-tight">
                <span className="block">{label}</span>
                <span className={`block text-xs ${isActive ? "text-gray-400" : "text-gray-600"}`}>{labelZh}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Tier legend */}
      <div className="mt-4 px-2 space-y-1 border-t border-white/[0.05] pt-3">
        {(["free", "pro", "research"] as const).map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[t]}`} />
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>
    </div>
  );

  // Default: render both (desktop sidebar + mobile pills together)
  return (
    <>
      <WorkspaceTOC sections={sections} mobileOnly accentColor={accentColor} />
      <WorkspaceTOC sections={sections} desktopOnly accentColor={accentColor} />
    </>
  );
}
