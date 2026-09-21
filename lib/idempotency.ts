// Stable idempotency keys for action execution (client, shared by the
// actions runner and the automations console). The key is a hash of action +
// object + approval + canonical inputs: double-clicks and retries replay the
// original receipt instead of writing twice. A new key requires new inputs.
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stableKey(
  actionKey: string,
  objectId: string,
  approvalId: string | undefined,
  inputs: Record<string, unknown>,
): string {
  return `${actionKey}:${objectId}:${approvalId ?? "direct"}:${fnv1a(canonical(inputs))}`;
}
