export const AGENCY_FIELDS = [
  "recordKey",
  "project",
  "client",
  "date",
  "sentDate",
  "signedDate",
  "person",
  "task",
  "hours",
  "rate",
  "revenue",
  "amount",
  "round",
  "asset",
  "status",
] as const;

export type AgencyField = (typeof AGENCY_FIELDS)[number];

export const AGENCY_ALIASES: Record<AgencyField, string[]> = {
  recordKey: ["id", "ref", "reference", "key", "load id"],
  project: ["name", "project name", "job", "job name", "production", "show"],
  client: ["customer", "brand", "account", "company"],
  date: ["day", "created", "due date", "deadline", "submitted", "start", "start date", "timestamp"],
  sentDate: ["sent", "sent date", "sent for review", "submitted for review"],
  signedDate: ["signed", "signed date", "approved date", "approval date", "approved"],
  person: ["user", "employee", "editor", "designer", "assignee", "reviewer", "commenter", "by"],
  task: ["description", "notes", "comment", "title", "text", "message"],
  hours: ["hrs", "time", "duration", "quantity", "qty"],
  rate: ["hourly rate", "hourlyrate", "price", "cost"],
  revenue: ["total", "gross", "budget"],
  amount: ["total amount", "totalamt", "paid", "cost"],
  round: ["round number", "revision", "version", "r"],
  asset: ["asset name", "file", "filename", "deliverable"],
  status: ["state", "stage", "signed"],
};
