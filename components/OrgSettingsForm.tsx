"use client";

import { useState } from "react";
import LocaleSuggest from "@/components/LocaleSuggest";

export default function OrgSettingsForm({
  initial,
}: {
  initial: {
    weekStartsOn: number;
    timezone: string;
    anomalyThresholdPts: number;
    anomalyEmail: boolean;
    agencyWeekStartsOn: number;
    agencyAnomalyThresholdPts: number;
    agencyAnomalyEmail: boolean;
    locale: string;
    predictOptOut: boolean;
  };
}) {
  const [weekStartsOn, setWeekStartsOn] = useState(String(initial.weekStartsOn));
  const [timezone, setTimezone] = useState(initial.timezone);
  const [threshold, setThreshold] = useState(String(initial.anomalyThresholdPts));
  const [anomalyEmail, setAnomalyEmail] = useState(initial.anomalyEmail);
  const [agencyWeekStartsOn, setAgencyWeekStartsOn] = useState(String(initial.agencyWeekStartsOn));
  const [agencyThreshold, setAgencyThreshold] = useState(String(initial.agencyAnomalyThresholdPts));
  const [agencyAnomalyEmail, setAgencyAnomalyEmail] = useState(initial.agencyAnomalyEmail);
  const [locale, setLocale] = useState(initial.locale);
  const [predictOptOut, setPredictOptOut] = useState(initial.predictOptOut);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/org/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStartsOn: Number(weekStartsOn),
          timezone,
          anomalyThresholdPts: Number(threshold),
          anomalyEmail,
          agencyWeekStartsOn: Number(agencyWeekStartsOn),
          agencyAnomalyThresholdPts: Number(agencyThreshold),
          agencyAnomalyEmail,
          locale,
          predictOptOut,
        }),
      });
      setMsg(res.ok ? "Saved." : "Save failed. Check values (week 0-6, threshold 1-50).");
    } catch {
      setMsg("Save failed. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3 text-sm">
      <label>
        Week starts
        <select value={weekStartsOn} onChange={(e) => setWeekStartsOn(e.target.value)} className="ml-1 rounded border p-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        Timezone
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="ml-1 rounded border p-1" />
      </label>
      <label>
        Anomaly threshold (pts)
        <input value={threshold} onChange={(e) => setThreshold(e.target.value)} className="ml-1 w-16 rounded border p-1" />
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={anomalyEmail} onChange={(e) => setAnomalyEmail(e.target.checked)} />
        Email me on anomalies
      </label>
      <label>
        Studio week starts
        <select value={agencyWeekStartsOn} onChange={(e) => setAgencyWeekStartsOn(e.target.value)} className="ml-1 rounded border p-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        Studio anomaly threshold (pts)
        <input value={agencyThreshold} onChange={(e) => setAgencyThreshold(e.target.value)} className="ml-1 w-16 rounded border p-1" />
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={agencyAnomalyEmail} onChange={(e) => setAgencyAnomalyEmail(e.target.checked)} />
        Email me on studio anomalies
      </label>
      <label>
        Language
        <select value={locale} onChange={(e) => setLocale(e.target.value)} className="ml-1 rounded border p-1">
          {["en", "es", "de"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={predictOptOut} onChange={(e) => setPredictOptOut(e.target.checked)} />
        Turn off forecasts
      </label>
      <button type="submit" disabled={busy} className="rounded-md font-medium px-3 py-1 text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {busy ? "Saving…" : "Save"}
      </button>
      <LocaleSuggest setWeek={setWeekStartsOn} setTz={setTimezone} />
      {msg && <span>{msg}</span>}
    </form>
  );
}
