export interface AdjEdge {
  fromId: string;
  linkKey: string;
  toId: string;
}

export type Adjacency = Map<string, AdjEdge[]>;

export function buildAdjacency(edges: AdjEdge[]): Adjacency {
  const adj: Adjacency = new Map();
  for (const e of edges) {
    const list = adj.get(e.fromId) ?? [];
    list.push(e);
    adj.set(e.fromId, list);
  }
  return adj;
}

export interface TraverseOpts {
  maxDepth?: number;
  linkKeys?: string[];
  direction?: "out" | "in" | "both";
  visitCap?: number;
}

export interface TraverseResult {
  nodes: string[];
  edges: AdjEdge[];
  truncated: boolean;
  visits: number;
}

export function bfs(
  out: Adjacency,
  incoming: Adjacency,
  startId: string,
  opts: TraverseOpts = {}
): TraverseResult {
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 2, 0), 4);
  const visitCap = opts.visitCap ?? 2000;
  const direction = opts.direction ?? "out";
  const allow = opts.linkKeys ? new Set(opts.linkKeys) : null;
  const visited = new Set<string>([startId]);
  const foundEdges: AdjEdge[] = [];
  let visits = 0;
  let truncated = false;
  let frontier: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
  const neighbors = (id: string): AdjEdge[] => {
    const list: AdjEdge[] = [];
    if (direction === "out" || direction === "both") list.push(...(out.get(id) ?? []));
    if (direction === "in" || direction === "both") list.push(...(incoming.get(id) ?? []));
    return allow ? list.filter((e) => allow.has(e.linkKey)) : list;
  };
  while (frontier.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of frontier) {
      if (depth >= maxDepth) continue;
      for (const e of neighbors(id)) {
        visits += 1;
        if (visits > visitCap) {
          truncated = true;
          return { nodes: [...visited], edges: foundEdges, truncated, visits };
        }
        foundEdges.push(e);
        const other = e.fromId === id ? e.toId : e.fromId;
        if (!visited.has(other)) {
          visited.add(other);
          next.push({ id: other, depth: depth + 1 });
        }
      }
    }
    frontier = next;
  }
  return { nodes: [...visited], edges: foundEdges, truncated, visits };
}

export function shortestPath(
  out: Adjacency,
  incoming: Adjacency,
  fromId: string,
  toId: string,
  maxDepth = 4
): string[] | null {
  if (fromId === toId) return [fromId];
  const prev = new Map<string, string>();
  const seen = new Set<string>([fromId]);
  let frontier = [fromId];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const all = [...(out.get(id) ?? []), ...(incoming.get(id) ?? [])];
      for (const e of all) {
        const other = e.fromId === id ? e.toId : e.fromId;
        if (seen.has(other)) continue;
        seen.add(other);
        prev.set(other, id);
        if (other === toId) {
          const path = [toId];
          let cur = toId;
          while (cur !== fromId) {
            cur = prev.get(cur)!;
            path.unshift(cur);
          }
          return path;
        }
        next.push(other);
      }
    }
    frontier = next;
  }
  return null;
}

export function connectedComponents(edges: AdjEdge[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const nxt = parent.get(cur)!;
      parent.set(cur, root);
      cur = nxt;
    }
    return root;
  };
  for (const e of edges) {
    for (const n of [e.fromId, e.toId]) if (!parent.has(n)) parent.set(n, n);
    const a = find(e.fromId);
    const b = find(e.toId);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<string, string[]>();
  for (const n of parent.keys()) {
    const r = find(n);
    const g = groups.get(r) ?? [];
    g.push(n);
    groups.set(r, g);
  }
  return [...groups.values()];
}

export interface LinkSuggestion {
  objectId: string;
  sharedNeighbors: number;
}

export function suggestLinks(out: Adjacency, incoming: Adjacency, objectId: string, limit = 10): LinkSuggestion[] {
  const direct = new Set<string>([objectId]);
  for (const e of [...(out.get(objectId) ?? []), ...(incoming.get(objectId) ?? [])]) {
    direct.add(e.fromId === objectId ? e.toId : e.fromId);
  }
  const counts = new Map<string, number>();
  for (const neighbor of direct) {
    if (neighbor === objectId) continue;
    for (const e of [...(out.get(neighbor) ?? []), ...(incoming.get(neighbor) ?? [])]) {
      const other = e.fromId === neighbor ? e.toId : e.fromId;
      if (direct.has(other)) continue;
      counts.set(other, (counts.get(other) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([objectId, sharedNeighbors]: [string, number]) => ({ objectId, sharedNeighbors }))
    .sort((a, b) => b.sharedNeighbors - a.sharedNeighbors)
    .slice(0, limit);
}

export function degreeRank(edges: AdjEdge[], limit = 20): Array<{ id: string; degree: number }> {
  const counts = new Map<string, number>();
  for (const e of edges) {
    counts.set(e.fromId, (counts.get(e.fromId) ?? 0) + 1);
    counts.set(e.toId, (counts.get(e.toId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, degree]) => ({ id, degree }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, limit);
}
