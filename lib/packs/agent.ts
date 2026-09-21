import { buildAgentContext, defaultReadType, type AgentContext, type AgentContextNode } from "@/lib/core/agent/context";
import { clearanceForRole, visibleObjects, type Marking } from "@/lib/packs/manufacturing/service";

// Manufacturing-aware context reader: mfg_* types flow through the
// policy-enforced read path (deny by default) with marking clearance;
// everything else uses the generic studio read.
export function policyAwareReadType(
  organizationId: string,
  typeKey: string,
  take: number,
  clearance?: Marking
): Promise<AgentContextNode[]> {
  if (!typeKey.startsWith("mfg_")) return defaultReadType(organizationId, typeKey, take);
  return visibleObjects(organizationId, typeKey, take, clearance ? { clearance } : {}).then((rows) =>
    rows.map((o) => ({ id: o.id, key: o.key, type: o.typeKey, data: o.data }))
  );
}

export function manufacturingAgentContext(
  organizationId: string,
  typeKeys?: string[],
  opts: { actorRole?: string } = {}
): Promise<AgentContext> {
  const clearance = opts.actorRole ? clearanceForRole(opts.actorRole) : undefined;
  return buildAgentContext(organizationId, {
    typeKeys,
    readType: clearance
      ? (org, type, take) => policyAwareReadType(org, type, take, clearance)
      : policyAwareReadType,
  });
}
