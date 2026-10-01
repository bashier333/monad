// Hub navigation maps: the six rooms inside each of the five sidebar
// worlds. Pure data, NO "use client" — server pages import this directly.
// (Importing data constants from a client module silently breaks at runtime:
// the server receives a module proxy without the values. That outage is why
// this file exists separately from components/HubNav.tsx.)
export interface HubItem {
  href: string;
  label: string;
}

export const HUBS: {
  workspace: HubItem[];
  board: HubItem[];
  connect: HubItem[];
  inbox: HubItem[];
  settings: HubItem[];
} = {
  workspace: [
    { href: "/search", label: "Search" },
    { href: "/activity", label: "Activity" },
    { href: "/answers", label: "Answers" },
    { href: "/briefs", label: "Briefs" },
    { href: "/packs", label: "Packs" },
    { href: "/pilots", label: "Pilots" },
  ],
  board: [
    { href: "/ontology/twin", label: "Twin" },
    { href: "/ontology/explore", label: "Explore" },
    { href: "/ontology", label: "Schema" },
    { href: "/ontology/actions", label: "Actions" },
    { href: "/ontology/scenarios", label: "Scenarios" },
    { href: "/ontology/audit", label: "Audit" },
  ],
  connect: [
    { href: "/sync", label: "Connectors" },
    { href: "/packs", label: "Packs" },
    { href: "/answers", label: "Answers" },
    { href: "/briefs", label: "Briefs" },
    { href: "/ontology/board", label: "Board" },
    { href: "/help", label: "Docs" },
  ],
  inbox: [
    { href: "/ontology/inbox", label: "Approvals" },
    { href: "/corrections", label: "Corrections" },
    { href: "/rules", label: "Rules" },
    { href: "/ontology/actions", label: "Actions" },
    { href: "/ontology/automations", label: "Automations" },
    { href: "/ontology/ops", label: "Ops" },
  ],
  settings: [
    { href: "/settings#organization", label: "Organization" },
    { href: "/settings#team", label: "Team" },
    { href: "/settings#ai-key", label: "AI key" },
    { href: "/settings#billing", label: "Billing" },
    { href: "/settings#sessions", label: "Sessions" },
    { href: "/settings#data", label: "Data" },
  ],
};
