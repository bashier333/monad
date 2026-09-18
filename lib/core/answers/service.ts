import { toISODate } from "@/lib/core/dates";
import { cacheBust, cacheGet, cacheSet } from "@/lib/core/cache";
import { db } from "@/lib/core/db";

export interface AnswerMeta {
  weekStart: string;
  weekEnd: string;
  currency: string;
  distanceUnit: string;
  engineVersion: string;
  dataAsOf: Date | null;
}

export async function getAliases(
  organizationId: string,
  seed: Map<string, string>,
): Promise<Map<string, string>> {
  const cached = cacheGet<Array<{ alias: string; canonical: string }>>(`aliases:${organizationId}`);
  const rows = cached ?? (await db.placeAlias.findMany({ where: { organizationId } }));
  if (!cached) cacheSet(`aliases:${organizationId}`, rows, 60_000);
  const aliases = new Map(seed);
  for (const a of rows) aliases.set(a.alias, a.canonical);
  return aliases;
}

export function bustAliasCache(organizationId: string): void {
  cacheBust(`aliases:${organizationId}`);
}

export function bustAnswerCache(organizationId: string): void {
  cacheBust(`answer:freight:${organizationId}:`);
  cacheBust(`answer:agency:${organizationId}:`);
  cacheBust(`answer:${organizationId}:`);
}

export function resolveWeek(weekParam: string | null): string {
  const anchor = weekParam ? toISODate(weekParam) : toISODate(new Date().toISOString().slice(0, 10));
  if (!anchor) throw new Error("invalid week parameter (use YYYY-MM-DD)");
  return anchor;
}
