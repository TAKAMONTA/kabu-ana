"use client";

import { AnomalyTicker } from "@/components/signals/AnomalyTicker";
import { ClaudeBriefCard } from "@/components/signals/ClaudeBriefCard";
import { EnergyNewsBoard } from "@/components/signals/EnergyNewsBoard";
import { GeopolRiskGauge } from "@/components/signals/GeopolRiskGauge";
import { PriceStrip } from "@/components/signals/PriceStrip";
import { SeismicTable } from "@/components/signals/SeismicTable";
import { SignalsNav } from "@/components/signals/SignalsNav";

export default function SignalsPage() {
  return (
    <main className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom)+32px)] pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">マーケット・シグナル</h1>
            <p className="mt-1 text-sm text-muted-foreground">外部環境とAIブリーフを30秒で確認</p>
          </div>
          <SignalsNav active="signals" />
        </div>
        <AnomalyTicker />
        <PriceStrip />
        <EnergyNewsBoard />
        <SeismicTable />
        <GeopolRiskGauge />
        <ClaudeBriefCard />
      </div>
    </main>
  );
}
