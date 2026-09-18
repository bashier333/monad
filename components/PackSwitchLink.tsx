"use client";

import { useRouter } from "next/navigation";

export default function PackSwitchLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <button
      className="underline"
      onClick={() => {
        if (window.confirm("Switch packs? Your packs keep separate data — nothing mixes, nothing is lost.")) {
          router.push(href);
        }
      }}
    >
      {label}
    </button>
  );
}
