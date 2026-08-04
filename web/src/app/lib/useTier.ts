"use client";
export type Tier = "free" | "pro" | "research";
export const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, research: 2 };
export function useTier(): Tier { return "research"; }
export function hasAccess(_userTier: Tier, _requiredTier: Tier): boolean { return true; }
export function setDevTier(_tier: Tier): void {}
