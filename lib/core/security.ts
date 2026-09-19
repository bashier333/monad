import { createHash } from "crypto";

export function capString(v: unknown, max: number): string {
  const s = typeof v === "string" ? v : "";
  return s.length > max ? s.slice(0, max) : s;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hashEmail(email: string): string {
  return `sha256:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16)}`;
}

export function isSafeRedirect(target: string): boolean {
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  if (target.includes("\\")) return false;
  if (/[\r\n]/.test(target)) return false;
  return true;
}

export function isCuid(id: string): boolean {
  return /^c[0-9a-z]{10,}$/.test(id);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInviteRole(role: unknown): "DISPATCHER" | "VIEWER" {
  return role === "DISPATCHER" ? "DISPATCHER" : "VIEWER";
}

export function validateInviteEmail(email: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || !EMAIL_RE.test(e) || e.length > 254) return { ok: false, error: "valid email required" };
  return { ok: true, email: e };
}

export function appOrigin(reqUrl: string): string {
  const configured = process.env.APP_URL ?? "";
  if (configured) return configured.replace(/\/$/, "");
  return new URL(reqUrl).origin;
}
