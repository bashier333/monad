import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { buildPackManifest } from "@/lib/core/ontology/branch-store";
import { toLinkML, toShacl } from "@/lib/core/ontology/blueprint-views";

// ?format=json (default) | linkml | shacl. The native JSON blueprint is the
// canonical round-trippable model; LinkML and SHACL are lossy export VIEWS
// (no actions, approvals, policies, or latitude — see blueprint-views.ts).
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const manifest = await buildPackManifest(active.organization.id);
  if (format === "linkml") {
    const pack = {
      types: manifest.types.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        properties: t.properties.map((p) => ({
          key: p.key,
          label: p.label,
          kind: p.kind,
          required: p.required,
          unique: p.unique,
          config: (p.config as Record<string, unknown> | null) ?? undefined,
        })),
      })),
      links: manifest.links.map((l) => ({
        key: l.key,
        fromTypeKey: l.fromTypeKey,
        toTypeKey: l.toTypeKey,
        cardinality: l.cardinality,
        inverseKey: l.inverseKey,
      })),
      exportedAt: manifest.exportedAt,
    };
    return new Response(toLinkML(pack), {
      headers: { "content-type": "text/yaml; charset=utf-8", "content-disposition": "attachment; filename=ontology-pack.linkml.yaml" },
    });
  }
  if (format === "shacl") {
    const pack = {
      types: manifest.types.map((t) => ({
        key: t.key,
        label: t.label,
        description: t.description,
        properties: t.properties.map((p) => ({
          key: p.key,
          label: p.label,
          kind: p.kind,
          required: p.required,
          unique: p.unique,
          config: (p.config as Record<string, unknown> | null) ?? undefined,
        })),
      })),
      links: manifest.links.map((l) => ({
        key: l.key,
        fromTypeKey: l.fromTypeKey,
        toTypeKey: l.toTypeKey,
        cardinality: l.cardinality,
        inverseKey: l.inverseKey,
      })),
      exportedAt: manifest.exportedAt,
    };
    return NextResponse.json(toShacl(pack));
  }
  if (format !== "json") return NextResponse.json({ error: "format must be json|linkml|shacl" }, { status: 400 });
  return NextResponse.json({ pack: manifest });
}
