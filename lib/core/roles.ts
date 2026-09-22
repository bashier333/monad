import type { Role } from "@prisma/client";

export type Action =
  | "answer:view"
  | "upload:import"
  | "correction:propose"
  | "correction:approve"
  | "rule:manage"
  | "ontology:manage"
  | "org:invite"
  | "billing:manage"
  | "board:view"
  | "board:manage";

const matrix: Record<Action, Role[]> = {
  "answer:view": ["OWNER", "DISPATCHER", "VIEWER"],
  "upload:import": ["OWNER", "DISPATCHER"],
  "correction:propose": ["OWNER", "DISPATCHER"],
  "correction:approve": ["OWNER"],
  "rule:manage": ["OWNER"],
  "ontology:manage": ["OWNER"],
  "org:invite": ["OWNER"],
  "billing:manage": ["OWNER"],
  "board:view": ["OWNER", "DISPATCHER", "VIEWER"],
  "board:manage": ["OWNER", "DISPATCHER"],
};

export function can(role: Role, action: Action): boolean {
  return matrix[action].includes(role);
}

export function requireCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    const err = new Error(`Forbidden: role ${role} cannot ${action}`) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
