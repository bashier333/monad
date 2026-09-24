"use client";

import { useState } from "react";

export default function LocaleSuggest({ setWeek, setTz }: { setWeek: (v: string) => void; setTz: (v: string) => void }) {
  const [msg, setMsg] = useState("");

  function suggest() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
      const sundayFirst = ["US", "CA", "JP"].includes(new Intl.Locale(navigator.language).region ?? "");
      setWeek(sundayFirst ? "0" : "1");
      setTz(tz);
      setMsg(`Suggested from your locale: week starts ${sundayFirst ? "Sunday" : "Monday"}, ${tz}. Hit Save.`);
    } catch {
      setMsg("Could not read locale.");
    }
  }

  return (
    <span className="text-sm">
      <button onClick={suggest} className="underline">
        Use my locale
      </button>
      {msg && <span className="ml-2 ds-text-2">{msg}</span>}
    </span>
  );
}
