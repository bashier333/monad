import { normalizeName } from "@/lib/core/names";

export const normalizePlace = normalizeName;

export function laneKey(origin: string, destination: string): string {
  return `${origin} → ${destination}`;
}

const STATE_ABBR: Record<string, string> = {
  TEXAS: "TX",
  OKLAHOMA: "OK",
  ARIZONA: "AZ",
  "NEW MEXICO": "NM",
  LOUISIANA: "LA",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  FLORIDA: "FL",
  GEORGIA: "GA",
  TENNESSEE: "TN",
};

export function seedAliases(): Map<string, string> {
  const m = new Map<string, string>();
  const cities: Array<[string, string]> = [
    ["DAL", "DALLAS TX"],
    ["DFW", "DALLAS TX"],
    ["HOU", "HOUSTON TX"],
    ["IAH", "HOUSTON TX"],
    ["SAT", "SAN ANTONIO TX"],
    ["AUS", "AUSTIN TX"],
    ["ELP", "EL PASO TX"],
    ["PHX", "PHOENIX AZ"],
    ["OKC", "OKLAHOMA CITY OK"],
    ["FTW", "FORT WORTH TX"],
  ];
  for (const [alias, canonical] of cities) m.set(alias, canonical);
  for (const [, canonical] of cities) {
    const bare = canonical.replace(/ (TX|OK|AZ|NM|LA|AR|CA|FL|GA|TN)$/, "");
    if (bare !== canonical && !m.has(bare)) m.set(bare, canonical);
  }
  for (const [name, abbr] of Object.entries(STATE_ABBR)) {
    for (const city of ["DALLAS", "HOUSTON", "SAN ANTONIO", "AUSTIN", "FORT WORTH", "EL PASO"]) {
      if (abbr === "TX") m.set(`${city} ${name}`, `${city} TX`);
    }
    if (name === "OKLAHOMA") m.set(`OKLAHOMA CITY ${name}`, "OKLAHOMA CITY OK");
    if (name === "ARIZONA") m.set(`PHOENIX ${name}`, "PHOENIX AZ");
  }
  return m;
}
