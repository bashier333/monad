export interface UsageSnapshot {
  answers: number;
  uploads: number;
  corrections: number;
  daysSinceFirstAnswer: number | null;
}

export function pqlScore(u: UsageSnapshot): { score: number; pql: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (u.answers >= 5) {
    score += 40;
    reasons.push("5+ answers viewed");
  } else if (u.answers >= 1) {
    score += 15;
    reasons.push("first answer viewed");
  }
  if (u.uploads >= 2) {
    score += 25;
    reasons.push("2+ uploads");
  } else if (u.uploads >= 1) {
    score += 10;
    reasons.push("1 upload");
  }
  if (u.corrections >= 1) {
    score += 25;
    reasons.push("correction made (engaged)");
  }
  if (u.daysSinceFirstAnswer !== null && u.daysSinceFirstAnswer <= 1) {
    score += 10;
    reasons.push("first answer in <1 day");
  }
  return { score: Math.min(100, score), pql: score >= 60, reasons };
}

export function churnRisk(u: UsageSnapshot & { daysSinceLastAnswer: number | null }): {
  risk: "low" | "medium" | "high";
  reasons: string[];
} {
  const reasons: string[] = [];
  if (u.daysSinceLastAnswer === null) {
    return { risk: "high", reasons: ["no answers yet"] };
  }
  if (u.daysSinceLastAnswer > 14) {
    reasons.push(`no answer in ${u.daysSinceLastAnswer} days`);
    return { risk: "high", reasons };
  }
  if (u.daysSinceLastAnswer > 7) {
    reasons.push(`no answer in ${u.daysSinceLastAnswer} days`);
    return { risk: "medium", reasons };
  }
  if (u.corrections === 0 && u.answers >= 3) {
    reasons.push("answers but no corrections (passive)");
    return { risk: "medium", reasons };
  }
  return { risk: "low", reasons: ["active this week"] };
}

export function roiEstimate(input: {
  hoursPerWeekManual: number;
  hourlyRate: number;
  reworkCostPerWeek: number;
  teamPricePerMonth: number;
}): { monthlySavings: number; paybackDays: number; summary: string } {
  const weeklySavings = Math.max(0, input.hoursPerWeekManual * input.hourlyRate * 0.5 + input.reworkCostPerWeek * 0.2);
  const monthlySavings = Math.round(weeklySavings * 4.33 * 100) / 100;
  const paybackDays =
    monthlySavings <= 0 ? Infinity : Math.max(1, Math.round((input.teamPricePerMonth / monthlySavings) * 30));
  return {
    monthlySavings,
    paybackDays,
    summary: `≈ $${monthlySavings}/mo saved (half the manual hours + 20% of rework) vs $${input.teamPricePerMonth}/mo — pays back in ~${paybackDays} day(s).`,
  };
}
