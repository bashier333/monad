export interface PackManifest {
  id: string;
  name: string;
  version: number;
  entities: string[];
  sources: string[];
  vocabulary: Record<string, string>;
  migrationNotes: string[];
}

export function validatePackManifest(m: PackManifest): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(m.id)) problems.push(`id must be slug-case: ${m.id}`);
  if (!m.name) problems.push("name is required");
  if (!Number.isInteger(m.version) || m.version < 1) problems.push("version must be a positive integer");
  if (m.entities.length === 0) problems.push("at least one entity required");
  if (m.sources.length === 0) problems.push("at least one source required");
  if (!m.vocabulary.group) problems.push("vocabulary.group is required");
  return problems;
}
