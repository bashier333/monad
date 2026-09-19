export interface OnboardingCopy {
  subject: string;
  html: string;
}

export function day0Email(origin: string): OnboardingCopy {
  return {
    subject: "Your first answer in under a day",
    html: `<p>Upload one export and see which ${"lanes/projects"} made money — or load a sample week in one click.</p><p><a href="${origin}/upload">Upload</a></p>`,
  };
}

export function day3Email(origin: string, hasData: boolean): OnboardingCopy {
  return {
    subject: hasData ? "Your worst group this week" : "Stuck on mapping? 2-minute fix",
    html: hasData
      ? `<p>Open your answers — worst first — and flag anything that looks wrong. Flags become rules.</p><p><a href="${origin}/answers">Answers</a></p>`
      : `<p>Most mapping issues are one renamed column. The mapping screen shows confidence per field.</p><p><a href="${origin}/upload">Fix mapping</a></p>`,
  };
}

export function day7Email(origin: string): OnboardingCopy {
  return {
    subject: "Your Monday brief is ready",
    html: `<p>Winners, losers, and what moved — in one paragraph, with the trail behind every number.</p><p><a href="${origin}/briefs">Briefs</a></p>`,
  };
}
