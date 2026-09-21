import { NextResponse } from "next/server";
import { MANUFACTURING_LINKS, MANUFACTURING_TYPES } from "@/lib/packs/manufacturing/ontology";
import { MANUFACTURING_ACTIONS } from "@/lib/packs/manufacturing/actions";

// Public one-click download of the Monad ontology definition (types, links,
// governed actions). Pack constants only — no organization data, no auth.
export async function GET() {
  const body = {
    name: "monad-ontology",
    version: 1,
    exportedAt: new Date().toISOString(),
    types: MANUFACTURING_TYPES,
    links: MANUFACTURING_LINKS,
    actions: MANUFACTURING_ACTIONS.map((a) => ({
      key: a.key,
      label: a.label,
      targetTypeKey: a.targetTypeKey,
      approvalPolicy: a.approvalPolicy,
      requiredCount: a.requiredCount,
      description: a.description,
      inputs: a.inputs,
      effects: a.effects,
    })),
  };
  return NextResponse.json(body, {
    headers: { "content-disposition": 'attachment; filename="ontology.json"' },
  });
}
