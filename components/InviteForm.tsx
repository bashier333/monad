"use client";

import { useEffect, useState } from "react";

export default function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [result, setResult] = useState("");
  const [members, setMembers] = useState<Array<{ email: string | null; role: string }>>([]);

  async function refresh() {
    const b = (await (await fetch("/api/org/invites")).json()) as { members?: Array<{ email: string | null; role: string }> };
    setMembers(b.members ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = (await res.json()) as { magicLink?: string; note?: string; error?: string };
    setResult(res.ok ? `Invited. Send them this link: ${body.magicLink} (${body.note})` : (body.error ?? "failed"));
    if (res.ok) setEmail("");
    await refresh();
  }

  async function revoke(email: string) {
    if (!window.confirm(`Remove ${email} from this workspace?`)) return;
    setResult("");
    try {
      const res = await fetch("/api/org/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setResult(res.ok ? `Removed ${email}.` : (body.error ?? `Could not remove ${email}.`));
    } catch {
      setResult(`Could not remove ${email}.`);
    }
    await refresh();
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="ds-text-2">Viewer reads answers. Dispatcher uploads, maps, and flags. Only owners approve, manage rules, and bill.</p>
      <ul>
        {members.map((m) => (
          <li key={m.email ?? "?"}>
            {m.email} — {m.role}{" "}
            <button onClick={() => m.email && revoke(m.email)} className="underline">
              revoke
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={invite} className="flex flex-wrap gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className="rounded border p-1" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border p-1">
          <option value="VIEWER">Viewer</option>
          <option value="DISPATCHER">Dispatcher</option>
        </select>
        <button type="submit" className="rounded-md font-medium px-3 py-1 text-white" style={{ background: "var(--accent)" }}>
          Invite
        </button>
      </form>
      {result && <p className="break-all ds-text">{result}</p>}
    </div>
  );
}
