import type { AgencyField } from "@/lib/packs/agency/fields";

export interface AgencyPreset {
  vendor: string;
  headers: Partial<Record<AgencyField, string[]>>;
}

export const AGENCY_PRESETS: AgencyPreset[] = [
  {
    vendor: "harvest",
    headers: {
      project: ["Project"],
      client: ["Client"],
      date: ["Date"],
      person: ["Person", "User"],
      task: ["Task", "Notes"],
      hours: ["Hours"],
    },
  },
  {
    vendor: "asana",
    headers: {
      recordKey: ["Task ID", "GID"],
      project: ["Projects", "Project"],
      task: ["Task name", "Name"],
      person: ["Assignee"],
      date: ["Created At", "Due date"],
    },
  },
  {
    vendor: "frameio",
    headers: {
      project: ["Project"],
      asset: ["Asset", "Filename"],
      person: ["Reviewer", "Commenter"],
      date: ["Uploaded", "Created"],
      task: ["Comment"],
      round: ["Version"],
    },
  },
  {
    vendor: "quickbooks",
    headers: {
      recordKey: ["Invoice #", "RefNumber"],
      project: ["Customer", "Project"],
      amount: ["Amount", "Total"],
      date: ["TxnDate", "Due date"],
    },
  },
  {
    vendor: "generic-agency",
    headers: {
      project: ["Project"],
      date: ["Date"],
      person: ["Person"],
      hours: ["Hours"],
      amount: ["Amount"],
      revenue: ["Revenue"],
    },
  },
];
