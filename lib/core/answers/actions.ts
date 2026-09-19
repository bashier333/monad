export type NlActionKind = "flag" | "alert" | "rerun" | "export" | "invite";

export interface NlAction {
  action: NlActionKind;
  params: {
    field?: string;
    threshold?: number;
    targetKey?: string;
    group?: string;
    email?: string;
    role?: string;
    pack?: string;
  };
  raw: string;
}

const NUM_RE = /\$?(\d[\d,]*(?:\.\d+)?)/;

export function parseAction(raw: string, pack: "freight" | "agency" = "freight"): NlAction | null {
  const q = raw.toLowerCase().trim();
  const numMatch = q.match(NUM_RE);
  const num = numMatch ? Number(numMatch[1].replace(/,/g, "")) : undefined;
  const groupWord = pack === "agency" ? "project" : "lane";

  if (/\b(flag|exclude)\b/.test(q) && num !== undefined) {
    const field = /detention/.test(q) ? "detention" : /fee/.test(q) ? "fee" : /fuel/.test(q) ? "fuel" : "labor";
    return { action: "flag", params: { field, threshold: num, pack }, raw };
  }
  if (/\b(notify|alert|watch)\b/.test(q)) {
    const groupMatch = q.match(new RegExp(`\\b${groupWord}\\s+([a-z0-9 ]+?)(?:\\s+(drops|drops below|falls|late))`));
    return {
      action: "alert",
      params: { group: groupMatch?.[1]?.trim() ?? undefined, pack },
      raw,
    };
  }
  if (/\bre-?run\b|\brerun\b|\brun again\b/.test(q) || (/\brun\b/.test(q) && /\b(rules?|corrections?|weeks?)\b/.test(q))) {
    return { action: "rerun", params: { pack }, raw };
  }
  if (/\bexport\b/.test(q)) {
    return { action: "export", params: { pack }, raw };
  }
  if (/\binvite\b/.test(q) || /\badd\s+[\w.+-]+@[\w-]+\.[\w.]+\s+as\s+(dispatcher|viewer|owner)\b/.test(q)) {
    const emailMatch = q.match(/\b([\w.+-]+@[\w-]+\.[\w.]+)\b/);
    const roleMatch = /dispatcher/.test(q) ? "DISPATCHER" : /viewer/.test(q) ? "VIEWER" : /owner/.test(q) ? "OWNER" : undefined;
    return { action: "invite", params: { email: emailMatch?.[1], role: roleMatch, pack }, raw };
  }
  return null;
}

export function describeAction(a: NlAction): string {
  switch (a.action) {
    case "flag":
      return `Flag all ${a.params.field} over $${a.params.threshold} as draft corrections (an owner approves them).`;
    case "alert":
      return a.params.group
        ? `Create an alert: notify when ${a.params.group} drops below its threshold.`
        : `Create an alert — name the ${a.params.pack === "agency" ? "project" : "lane"} to watch.`;
    case "rerun":
      return "Re-run this week with your corrections applied.";
    case "export":
      return "Generate a CSV export of this view.";
    case "invite":
      return a.params.email
        ? `Draft an invite for ${a.params.email}${a.params.role ? ` as ${a.params.role.toLowerCase()}` : ""} (you confirm before it sends).`
        : "Draft an invite — give the email address.";
  }
}

export function validateActionParams(a: NlAction): string | null {
  if (a.action === "alert" && !a.params.group) return "name the group to watch";
  if (a.action === "invite" && !a.params.email) return "email address required";
  if (a.action === "flag" && (a.params.threshold === undefined || a.params.threshold <= 0)) return "threshold must be positive";
  return null;
}
