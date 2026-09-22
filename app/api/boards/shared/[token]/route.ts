import { NextResponse } from "next/server";
import { getBoardByShareToken } from "@/lib/core/boards/store";

// Public read-only board view behind a revocable share token. Published
// boards only; owner identity is never exposed.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const board = await getBoardByShareToken(token);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    board: {
      id: board.id,
      name: board.name,
      layout: board.layout,
      widgets: board.widgets,
      version: board.version,
      updatedAt: board.updatedAt,
    },
  });
}
