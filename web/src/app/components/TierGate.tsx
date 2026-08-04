"use client";
import { Tier } from "../lib/useTier";

type TierGateProps = {
  requiredTier: Tier;
  children: React.ReactNode;
  title: string;
  description?: string;
};

export default function TierGate({ children }: TierGateProps) {
  return <>{children}</>;
}
