export interface DetectedMapping {
  mapping: Record<string, number>;
  confidence: Record<string, number>;
}

export interface RowIssue {
  field: string;
  code: string;
  message: string;
}

export interface SourceAdapter {
  sourceTypes: string[];
  detect(headers: string[]): DetectedMapping;
  apply(
    headers: string[],
    rows: string[][],
    mapping: Record<string, number>,
  ): Array<{ rowNumber: number; record: Record<string, string> }>;
  validate(record: Record<string, string>, seen: Set<string>, sourceType: string): RowIssue[];
  loadKey(record: Record<string, string>): string | null;
  dateOf?(record: Record<string, string>): string;
}

const registry = new Map<string, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter): void {
  for (const t of adapter.sourceTypes) registry.set(t, adapter);
}

export function getAdapter(sourceType: string): SourceAdapter | null {
  return registry.get(sourceType) ?? null;
}

export function registeredSourceTypes(): string[] {
  return [...registry.keys()];
}
