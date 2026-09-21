import { listTypes } from "@/lib/core/ontology/registry";
import { listObjects } from "@/lib/core/ontology/objects";

export interface AgentContextNode {
  id: string;
  key: string;
  type: string;
  data: Record<string, unknown>;
}

export interface AgentContext {
  nodes: AgentContextNode[];
  types: Array<{ key: string; label: string; properties: string[] }>;
  truncated: boolean;
}

export const AGENT_MAX_PER_TYPE = 100;
export const AGENT_MAX_NODES = 2000;

export type ReadType = (organizationId: string, typeKey: string, take: number) => Promise<AgentContextNode[]>;

export async function defaultReadType(organizationId: string, typeKey: string, take: number): Promise<AgentContextNode[]> {
  const res = await listObjects(organizationId, typeKey, { take });
  return res.rows.map((o) => ({ id: o.id, key: o.key, type: o.typeKey, data: (o.data as Record<string, unknown>) ?? {} }));
}

// OAG: ontology-augmented generation context. Structured and
// permission-filtered objects, never raw text chunks. Callers inject a
// readType implementation; the manufacturing pack routes mfg_* types through
// the policy-enforced read path (deny by default).
export async function buildAgentContext(
  organizationId: string,
  opts: { typeKeys?: string[]; readType?: ReadType } = {}
): Promise<AgentContext> {
  const readType = opts.readType ?? defaultReadType;
  const types = await listTypes(organizationId);
  const wanted = opts.typeKeys && opts.typeKeys.length > 0 ? types.filter((t) => opts.typeKeys!.includes(t.key)) : types;
  const typeSummaries = wanted.map((t) => ({
    key: t.key,
    label: t.label,
    properties: (t.properties as Array<{ key: string }>).map((p) => p.key),
  }));
  const nodes: AgentContextNode[] = [];
  let truncated = false;
  for (const t of wanted) {
    if (nodes.length >= AGENT_MAX_NODES) {
      truncated = true;
      break;
    }
    for (const o of await readType(organizationId, t.key, AGENT_MAX_PER_TYPE)) {
      nodes.push(o);
    }
  }
  return { nodes, types: typeSummaries, truncated };
}

export function renderContextForPrompt(ctx: AgentContext): string {
  const lines: string[] = [];
  lines.push("OBJECT TYPES:");
  for (const t of ctx.types) lines.push(`- ${t.key} (${t.label}): ${t.properties.join(", ")}`);
  lines.push("");
  lines.push("OBJECTS (cite ids in answers):");
  for (const n of ctx.nodes.slice(0, 400)) {
    lines.push(`- [${n.id}] ${n.type}:${n.key} ${JSON.stringify(n.data).slice(0, 300)}`);
  }
  if (ctx.truncated || ctx.nodes.length > 400) lines.push(`... ${ctx.nodes.length} objects total (showing first 400)`);
  return lines.join("\n");
}
