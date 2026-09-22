import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { getWidget, validateWidgetBoard, type BoardWidgetInput } from "@/lib/core/boards/widgets";
import { recordEvent } from "@/lib/core/ontology/facts";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Board persistence: versioned movable-board definitions with draft/publish
// lifecycle and revocable share tokens. Row rule: manage allowed for the
// owner or any OWNER; view allowed for every org member on non-deleted
// boards; share tokens grant public read-only access to one board.
// ---------------------------------------------------------------------------

const layoutItemSchema = z.object({
  id: z.string().max(80),
  x: z.number().int().min(0).max(100),
  y: z.number().int().min(0).max(1000),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(100),
});

const widgetInputSchema = z.object({
  id: z.string().max(80).optional(),
  type: z.string().min(1).max(80),
  props: z.record(z.unknown()).optional(),
});

export const boardInputSchema = z.object({
  name: z.string().min(1).max(80),
  layout: z.array(layoutItemSchema).max(50).default([]),
  widgets: z.array(widgetInputSchema).max(50).default([]),
});

export type BoardInput = z.infer<typeof boardInputSchema>;

export interface BoardProblem {
  field: string;
  message: string;
}

function widgetProblems(widgets: BoardWidgetInput[]): BoardProblem[] {
  const gate = validateWidgetBoard(widgets, "OWNER");
  return gate.problems
    .filter((p) => !p.message.includes("not visible to"))
    .map((p) => ({ field: p.index >= 0 ? `widgets.${p.index}` : "widgets", message: p.message }));
}

export function diffBoardLayout(
  prev: Array<{ id: string }>,
  next: Array<{ id: string }>,
): { added: string[]; removed: string[]; kept: string[] } {
  const p = new Set(prev.map((w) => w.id));
  const n = new Set(next.map((w) => w.id));
  return {
    added: [...n].filter((id) => !p.has(id)),
    removed: [...p].filter((id) => !n.has(id)),
    kept: [...n].filter((id) => p.has(id)),
  };
}

export function layoutNote(
  prevWidgets: Array<{ id: string }>,
  nextWidgets: Array<{ id: string }>,
  prevVersion: number,
): string {
  const d = diffBoardLayout(prevWidgets, nextWidgets);
  return `v${prevVersion + 1}: +${d.added.length} widgets, -${d.removed.length} widgets`;
}

export function canManageBoard(
  board: { ownerId: string },
  userId: string,
  role: string,
): boolean {
  return board.ownerId === userId || role === "OWNER";
}

function snapshotOf(input: BoardInput): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ name: input.name, layout: input.layout, widgets: input.widgets })) as Record<string, unknown>;
}

export async function createBoard(organizationId: string, ownerId: string, input: unknown) {
  const parsed = boardInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems = widgetProblems(parsed.data.widgets);
  if (problems.length > 0) return { ok: false as const, problems };
  const created = await db.board.create({
    data: {
      organizationId,
      ownerId,
      name: parsed.data.name,
      layout: json(parsed.data.layout),
      widgets: json(parsed.data.widgets),
      versions: {
        create: {
          organizationId,
          version: 1,
          snapshot: json(snapshotOf(parsed.data)),
          note: "initial version",
          createdById: ownerId,
        },
      },
    },
  });
  await recordEvent(organizationId, {
    kind: "ontology:board:created",
    actorId: ownerId,
    after: { boardId: created.id, name: created.name },
  });
  return { ok: true as const, value: created };
}

export async function listBoards(
  organizationId: string,
  take = 50,
  opts: { query?: string; includeArchived?: boolean } = {},
) {
  const q = (opts.query ?? "").trim().slice(0, 80);
  return db.board.findMany({
    where: {
      organizationId,
      ...(opts.includeArchived ? {} : { deletedAt: null }),
      // No `mode: insensitive` here: SQLite (exe) rejects it. Case-variant
      // matches are the caller's job; the contract is substring match.
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
    take: Math.min(Math.max(take, 1), 100),
  });
}

export async function getBoard(organizationId: string, id: string) {
  return db.board.findFirst({ where: { id, organizationId, deletedAt: null } });
}

export async function getBoardByShareToken(token: string) {
  if (!token) return null;
  return db.board.findFirst({
    where: { shareToken: token, deletedAt: null, status: "published" },
  });
}

export async function updateBoard(organizationId: string, userId: string, role: string, id: string, input: unknown) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  const parsed = boardInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems = widgetProblems(parsed.data.widgets);
  if (problems.length > 0) return { ok: false as const, problems };
  const prevWidgets = (board.widgets as Array<{ id?: string; type: string }>)
    .map((w, i) => ({ id: w.id ?? `${w.type}-${i}` }));
  const nextWidgets = parsed.data.widgets.map((w, i) => ({ id: w.id ?? `${w.type}-${i}` }));
  const note = layoutNote(prevWidgets, nextWidgets, board.version);
  const nextVersion = board.version + 1;
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.board.update({
      where: { id: board.id },
      data: {
        name: parsed.data.name,
        layout: json(parsed.data.layout),
        widgets: json(parsed.data.widgets),
        version: nextVersion,
      },
    });
    await tx.boardVersion.create({
      data: {
        organizationId,
        boardId: board.id,
        version: nextVersion,
        snapshot: json(snapshotOf(parsed.data)),
        note,
        createdById: userId,
      },
    });
    return u;
  });
  await recordEvent(organizationId, {
    kind: "ontology:board:updated",
    actorId: userId,
    before: { boardId: board.id, version: board.version },
    after: { boardId: board.id, version: nextVersion, note },
  });
  return { ok: true as const, value: updated };
}

export async function revertBoard(organizationId: string, userId: string, role: string, id: string, version: number) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  const snap = await db.boardVersion.findUnique({ where: { boardId_version: { boardId: id, version } } });
  if (!snap || snap.organizationId !== organizationId) {
    return { ok: false as const, error: `no snapshot for version ${version}` };
  }
  const res = await updateBoard(organizationId, userId, role, id, snap.snapshot as object);
  if (!res.ok) return res;
  await recordEvent(organizationId, {
    kind: "ontology:board:reverted",
    actorId: userId,
    after: { boardId: id, toVersion: version },
  });
  return res;
}

export async function deleteBoard(organizationId: string, userId: string, role: string, id: string) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  await db.board.update({ where: { id: board.id }, data: { deletedAt: new Date(), shareToken: null } });
  await recordEvent(organizationId, {
    kind: "ontology:board:deleted",
    actorId: userId,
    before: { boardId: id, name: board.name },
  });
  return { ok: true as const, value: { id } };
}

export async function publishBoard(
  organizationId: string,
  userId: string,
  role: string,
  id: string,
  status: "draft" | "published",
) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  const updated = await db.board.update({ where: { id: board.id }, data: { status } });
  await recordEvent(organizationId, {
    kind: "ontology:board:published",
    actorId: userId,
    after: { boardId: id, status },
  });
  return { ok: true as const, value: updated };
}

export async function rotateShareToken(organizationId: string, userId: string, role: string, id: string) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  if (board.status !== "published") {
    return { ok: false as const, error: "publish the board before sharing it" };
  }
  const token = `brd_${randomBytes(18).toString("hex")}`;
  const updated = await db.board.update({ where: { id: board.id }, data: { shareToken: token } });
  await recordEvent(organizationId, {
    kind: "ontology:board:shared",
    actorId: userId,
    after: { boardId: id },
  });
  return { ok: true as const, value: updated };
}

export async function revokeShareToken(organizationId: string, userId: string, role: string, id: string) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  await db.board.update({ where: { id: board.id }, data: { shareToken: null } });
  await recordEvent(organizationId, {
    kind: "ontology:board:share-revoked",
    actorId: userId,
    after: { boardId: id },
  });
  return { ok: true as const, value: { id } };
}

export async function findStaleBoards(organizationId: string, idleMs = 90 * 24 * 3600 * 1000): Promise<string[]> {
  const cutoff = new Date(Date.now() - idleMs);
  const rows = await db.board.findMany({
    where: { organizationId, deletedAt: null, status: "draft", updatedAt: { lt: cutoff } },
    select: { id: true },
    take: 500,
  });
  return rows.map((r) => r.id);
}

export async function toggleFavorite(organizationId: string, userId: string, role: string, id: string, favorite: boolean) {
  const board = await getBoard(organizationId, id);
  if (!board) return { ok: false as const, error: "board not found" };
  if (!canManageBoard(board, userId, role)) return { ok: false as const, error: "forbidden" };
  const updated = await db.board.update({ where: { id: board.id }, data: { isFavorite: favorite } });
  await recordEvent(organizationId, {
    kind: favorite ? "ontology:board:favorited" : "ontology:board:unfavorited",
    actorId: userId,
    after: { boardId: id },
  });
  return { ok: true as const, value: updated };
}

export function boardWidgetTypes(widgets: Array<{ type: string }>): string[] {
  return [...new Set(widgets.map((w) => w.type))].filter((t) => getWidget(t) !== null);
}

export interface ActivityItem {
  source: "ontology" | "event-log";
  kind: string;
  at: Date;
  detail: string;
}

// Activity feed (activity-feed widget): newest-first union of the governed
// ontology audit chain and automation/ingest event log. Summaries only —
// full rows live behind their own viewers.
export async function recentActivity(organizationId: string, take = 30): Promise<ActivityItem[]> {
  const n = Math.min(Math.max(take, 1), 100);
  const [events, logs] = await Promise.all([
    db.ontoEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: n,
      select: { kind: true, objectId: true, createdAt: true },
    }),
    db.eventLog.findMany({
      where: { orgId: organizationId },
      orderBy: { createdAt: "desc" },
      take: n,
      select: { type: true, status: true, createdAt: true },
    }),
  ]);
  const items: ActivityItem[] = [
    ...events.map((e) => ({
      source: "ontology" as const,
      kind: e.kind,
      at: e.createdAt,
      detail: e.objectId || e.kind,
    })),
    ...logs.map((l) => ({
      source: "event-log" as const,
      kind: l.type,
      at: l.createdAt,
      detail: `${l.type} (${l.status})`,
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, n);
}
