"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type WorkspaceHeaderProps = {
  activeView: "research" | "validation" | "signals";
  maxWidthClass?: string;
};

type SearchTarget = {
  label: string;
  href: string;
  keywords: string[];
  type: "workspace" | "section" | "topic";
};

const SEARCH_TARGETS: SearchTarget[] = [
  {
    label: "Research Workspace",
    href: "/",
    keywords: ["research", "home", "workspace", "main"],
    type: "workspace",
  },
  {
    label: "Validation Workspace",
    href: "/validation",
    keywords: ["validation", "validate", "anti-overfitting", "overfitting"],
    type: "workspace",
  },
  {
    label: "AI Summary",
    href: "/#summary",
    keywords: ["summary", "ai summary", "gemini"],
    type: "section",
  },
  {
    label: "Win Rate Chart",
    href: "/#chart",
    keywords: ["chart", "win rate", "bar chart"],
    type: "section",
  },
  {
    label: "Pattern Results Table",
    href: "/#results",
    keywords: ["results", "table", "pattern results", "metrics"],
    type: "section",
  },
  {
    label: "Fear & Greed Panel",
    href: "/#fear-greed",
    keywords: ["fear", "greed", "sentiment", "fear greed"],
    type: "section",
  },
  {
    label: "Rolling Correlation",
    href: "/#correlation",
    keywords: ["correlation", "rolling correlation", "eth btc", "sol btc"],
    type: "section",
  },
  {
    label: "GARCH Forecast",
    href: "/#garch",
    keywords: ["garch", "volatility", "forecast", "volatility forecast"],
    type: "section",
  },
  {
    label: "RSI Oversold Analysis",
    href: "/#rsi",
    keywords: ["rsi", "relative strength", "oversold", "momentum", "超賣", "相對強弱"],
    type: "section",
  },
  {
    label: "Monte Carlo Simulation",
    href: "/#monte-carlo",
    keywords: ["monte carlo", "simulation", "price paths", "forecast", "probability", "模擬"],
    type: "section",
  },
  {
    label: "Bollinger Band Analysis",
    href: "/#bollinger",
    keywords: ["bollinger", "bollinger band", "lower band", "breakout", "oversold", "布林帶"],
    type: "section",
  },
  {
    label: "Month Seasonality",
    href: "/#seasonality",
    keywords: ["seasonality", "month seasonality", "monthly return", "calendar", "uptober", "季節性", "月份", "月報酬"],
    type: "section",
  },
  {
    label: "Consecutive Drop Analysis",
    href: "/#consecutive-drop",
    keywords: ["consecutive drop", "consecutive down", "streak", "n-day drop", "連跌", "連續下跌"],
    type: "section",
  },
  {
    label: "Drawdown Recovery Analysis",
    href: "/#drawdown-recovery",
    keywords: ["drawdown recovery", "recovery", "drawdown", "回撤", "恢復", "回到前高"],
    type: "section",
  },
  {
    label: "Halving Cycle Analysis",
    href: "/#halving",
    keywords: ["halving", "halving cycle", "bitcoin halving", "block reward", "減半", "減半週期"],
    type: "section",
  },
  {
    label: "Walk-Forward Validation",
    href: "/validation#walk-forward",
    keywords: ["walk forward", "walk-forward", "rolling validation", "folds", "market cycles", "滾動驗證"],
    type: "section",
  },
  {
    label: "ACF / PACF Autocorrelation",
    href: "/validation#acf",
    keywords: ["acf", "pacf", "autocorrelation", "ljung", "ljung-box", "random walk", "white noise", "自相關"],
    type: "section",
  },
  {
    label: "Signal Intelligence Workspace",
    href: "/signals",
    keywords: ["signals", "signal intelligence", "market context", "regime", "confluence"],
    type: "workspace",
  },
  {
    label: "Market Regime",
    href: "/signals#regime",
    keywords: ["regime", "bull", "bear", "sideways", "market state", "trend", "牛市", "熊市", "橫盤"],
    type: "section",
  },
  {
    label: "Signal Confluence Score",
    href: "/signals#confluence",
    keywords: ["confluence", "confluence score", "oversold signals", "signal combination", "信號匯聚"],
    type: "section",
  },
  {
    label: "Multi-Factor Setup Score",
    href: "/signals#multifactor",
    keywords: ["multifactor", "multi-factor", "setup score", "factor breakdown", "多因子", "設置評分", "入場設置"],
    type: "section",
  },
  {
    label: "Regime Transition Probabilities",
    href: "/signals#regime-transition",
    keywords: ["regime transition", "markov", "transition probability", "regime switch", "狀態轉換", "馬可夫", "轉換概率"],
    type: "section",
  },
  {
    label: "Research Report (PDF)",
    href: "/report",
    keywords: ["report", "pdf", "print", "export", "research report", "報告", "列印"],
    type: "section",
  },
  {
    label: "BTC Research",
    href: "/?symbol=BTC#results",
    keywords: ["btc", "bitcoin"],
    type: "topic",
  },
  {
    label: "ETH Research",
    href: "/?symbol=ETH#results",
    keywords: ["eth", "ethereum"],
    type: "topic",
  },
  {
    label: "SOL Research",
    href: "/?symbol=SOL#results",
    keywords: ["sol", "solana"],
    type: "topic",
  },
];

function typeLabel(type: SearchTarget["type"]) {
  switch (type) {
    case "workspace":
      return "Workspace";
    case "section":
      return "Section";
    default:
      return "Topic";
  }
}

export default function WorkspaceHeader({
  activeView,
  maxWidthClass = "max-w-6xl",
}: WorkspaceHeaderProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  const trimmedQuery = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!trimmedQuery) return [];

    return SEARCH_TARGETS.filter((target) => {
      const haystacks = [target.label.toLowerCase(), ...target.keywords.map((keyword) => keyword.toLowerCase())];
      return haystacks.some((text) => text.includes(trimmedQuery));
    }).slice(0, 5);
  }, [trimmedQuery]);

  function navigateToTarget(href: string) {
    setQuery("");
    setHighlightedIndex(0);

    if (href.startsWith("/#")) {
      const hash = href.slice(1);
      if (pathname === "/") {
        window.location.hash = hash;
      } else {
        router.push(href);
      }
      return;
    }

    router.push(href);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (matches.length > 0) {
      const target = matches[highlightedIndex] ?? matches[0];
      navigateToTarget(target.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!trimmedQuery || matches.length === 0) {
      if (e.key === "Escape") {
        setQuery("");
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % matches.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + matches.length) % matches.length);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setHighlightedIndex(0);
    }
  }

  return (
    <header className="sticky top-0 z-40 px-4 md:px-8 border-b border-white/5 bg-gray-950/95 backdrop-blur">
      <div className={`${maxWidthClass} mx-auto h-14 md:h-20 flex items-center gap-4 md:gap-6`}>
        <Link href="/" className="text-base md:text-4xl font-semibold tracking-wide text-gray-300 whitespace-nowrap shrink-0 leading-none">
          CryptoPatternLab
        </Link>

        <div className="hidden md:block flex-1 min-w-0 max-w-xl mx-auto">
          <div className="relative">
            <form onSubmit={handleSubmit}>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search coin, pattern, or topic..."
                className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-white/[0.14] focus:bg-white/[0.06]"
              />
            </form>

            {trimmedQuery && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-white/[0.08] bg-gray-950/95 shadow-2xl backdrop-blur">
                {matches.length > 0 ? (
                  <ul className="py-1">
                    {matches.map((target, index) => (
                      <li key={`${target.type}:${target.label}`}>
                        <button
                          type="button"
                          onClick={() => navigateToTarget(target.href)}
                          className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${
                            index === highlightedIndex ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                          }`}
                        >
                          <span className="text-sm text-gray-100">{target.label}</span>
                          <span className="text-xs uppercase tracking-wide text-gray-500">{typeLabel(target.type)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No matches found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <nav className="ml-auto md:ml-0 flex items-center gap-4 md:gap-10 shrink-0 pr-1" aria-label="Workspace views">
          <Link
            href="/"
            className={`inline-flex items-center border-b px-0.5 py-1 text-sm font-medium whitespace-nowrap transition-colors ${
              activeView === "research"
                ? "border-cyan-400/85 text-cyan-300"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:border-white/[0.12]"
            }`}
          >
            Research
          </Link>

          <Link
            href="/validation"
            className={`inline-flex items-center border-b px-0.5 py-1 text-sm font-medium whitespace-nowrap transition-colors ${
              activeView === "validation"
                ? "border-cyan-400/85 text-cyan-300"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:border-white/[0.12]"
            }`}
          >
            Validation
          </Link>

          <Link
            href="/signals"
            className={`inline-flex items-center border-b px-0.5 py-1 text-sm font-medium whitespace-nowrap transition-colors ${
              activeView === "signals"
                ? "border-purple-400/85 text-purple-300"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:border-white/[0.12]"
            }`}
          >
            Signals
          </Link>
        </nav>
      </div>
    </header>
  );
}
