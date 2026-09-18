export function toISODate(s: string): string | null {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export function weekBounds(anyDayISO: string, weekStartsOn: number): { start: string; end: string } {
  const d = new Date(`${anyDayISO}T00:00:00Z`);
  const dow = d.getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - back);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}
