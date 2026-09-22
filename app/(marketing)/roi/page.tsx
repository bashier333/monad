"use client";

import { useState } from "react";
import { roiEstimate } from "@/lib/core/growth";

export default function RoiPage() {
  const [hours, setHours] = useState("4");
  const [rate, setRate] = useState("75");
  const [rework, setRework] = useState("200");
  const price = 499;
  const r = roiEstimate({
    hoursPerWeekManual: Number(hours) || 0,
    hourlyRate: Number(rate) || 0,
    reworkCostPerWeek: Number(rework) || 0,
    teamPricePerMonth: price,
  });

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">ROI calculator</h1>
      <p className="text-sm text-gray-600">Your numbers in, savings out. Half your manual hours + 20% of rework, vs ${price}/mo.</p>
      <div className="grid gap-2 text-sm">
        <label>
          Manual margin hours / week
          <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" className="ml-2 w-24 rounded border p-1" />
        </label>
        <label>
          Blended hourly rate ($)
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="ml-2 w-24 rounded border p-1" />
        </label>
        <label>
          Weekly rework cost ($)
          <input value={rework} onChange={(e) => setRework(e.target.value)} inputMode="decimal" className="ml-2 w-24 rounded border p-1" />
        </label>
      </div>
      <p className="rounded border p-4 text-sm">{r.summary}</p>
    </main>
  );
}
