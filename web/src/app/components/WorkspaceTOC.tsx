"use client";

// WorkspaceTOC — FYP 副本版（純導航，無 Tier 顏色/badge/legend）
// Desktop: sticky sidebar with section links + active highlighting
// Mobile: horizontal scrollable pill bar

import { useEffect, useState } from "react";

export type TocSection = {
  id: string;
  label: string;
  labelZh: string;
  tier?: string; // 副本不使用，僅保留型別相容性
};

type Props = {
  sections: TocSection[];
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  accentColor?: string;
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
        {sections.map(({ id, label }) => {
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

  if (desktopOnly) return (
    <div className="hidden xl:block w-44 flex-shrink-0 sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto">
      <p className={`text-xs font-semibold tracking-widest uppercase mb-3 px-1 ${accentColor}`}>
        Sections
      </p>
      <nav className="space-y-0.5">
        {sections.map(({ id, label, labelZh }) => {
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

  return (
    <>
      <WorkspaceTOC sections={sections} mobileOnly accentColor={accentColor} />
      <WorkspaceTOC sections={sections} desktopOnly accentColor={accentColor} />
    </>
  );
}
