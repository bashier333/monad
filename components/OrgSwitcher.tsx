"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Org {
  id: string;
  name: string;
  role: string;
}

export default function OrgSwitcher({ currentId }: { currentId: string }) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/org")
      .then((r) => r.json())
      .then((b: { orgs?: Org[] }) => setOrgs(b.orgs ?? []))
      .catch(() => {});
  }, []);

  async function switchOrg(orgId: string) {
    const res = await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (res.ok) router.refresh();
    else setMsg("switch failed");
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    const body = (await res.json()) as { org?: Org; error?: string };
    if (!res.ok || !body.org) {
      setMsg(body.error ?? "create failed");
      return;
    }
    await switchOrg(body.org.id);
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">
        {orgs.map((o) => (
          <button
            key={o.id}
            onClick={() => void switchOrg(o.id)}
            className={`rounded border px-2 py-1 ${o.id === currentId ? "bg-black text-white" : ""}`}
          >
            {o.name} ({o.role.toLowerCase()})
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New organization name"
          aria-label="New organization name"
          className="rounded border p-1"
        />
        <button onClick={() => void create()} className="rounded border px-2 py-1">
          Create
        </button>
      </div>
      {msg && <p className="text-red-600">{msg}</p>}
    </div>
  );
}
