export function normalizeName(raw: string, aliases: Map<string, string>): string {
  const key = raw.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return aliases.get(key) ?? key;
}
