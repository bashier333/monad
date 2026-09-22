import { z } from "zod";

// ---------------------------------------------------------------------------
// Board widget catalog: the typed contract every board widget satisfies.
// Boards (Phase F canvas) render FROM this registry — a widget cannot exist
// on a board unless it is defined here with its query contract, props
// schema, selection-bus events, roles and perf budget. 70 Workshop-parity
// types (F2-04151+). Verified by lib/core/boards/widgets.test.ts +
// docs live under (marketing)/docs (repo layout); the catalog doc there
// must name every key.
// ---------------------------------------------------------------------------

export const BOARD_BUS_EVENTS = [
  "selection.set",
  "filter.set",
  "refresh.request",
  "action.open",
  "navigate",
] as const;

export type BoardBusEvent = (typeof BOARD_BUS_EVENTS)[number];

export const WIDGET_DATA_SOURCES = [
  "objects",
  "traverse",
  "facts",
  "events",
  "measures",
  "search",
  "agent",
  "none",
] as const;

export type WidgetDataSource = (typeof WIDGET_DATA_SOURCES)[number];

export const SOURCE_ROUTES: Record<WidgetDataSource, string | null> = {
  objects: "/api/ontology/objects",
  traverse: "/api/ontology/traverse",
  facts: "/api/ontology/objects/[id]/facts",
  events: "/api/ontology/events",
  measures: "/api/ontology/measures/evaluate",
  search: "/api/ontology/search",
  agent: "/api/agent/run",
  none: null,
};

export interface WidgetDef {
  type: string;
  family: "display" | "visualization" | "filtering" | "event" | "aip" | "system";
  title: string;
  description: string;
  dataSource: WidgetDataSource;
  eventsIn: BoardBusEvent[];
  eventsOut: BoardBusEvent[];
  roles: Array<"OWNER" | "DISPATCHER" | "VIEWER">;
  perfBudgetKb: number;
  lazy: boolean;
  emptyState: string;
  keyboardOps: string;
  propsSchema: z.ZodTypeAny;
}

const baseProps = (extra: Record<string, z.ZodTypeAny> = {}) =>
  z.object({
    title: z.string().max(80).optional(),
    limit: z.number().int().min(1).max(200).default(20),
    ...extra,
  });

// Media sources must be https (no mixed content, no file:// exfiltration).
const httpsUrl = () =>
  z
    .string()
    .url("src must be a valid URL")
    .refine((u) => u.startsWith("https://"), "src must be https")
    .optional();

const filterProps = (extra: Record<string, z.ZodTypeAny> = {}) =>
  z.object({
    title: z.string().max(80).optional(),
    targetWidget: z.string().max(80).optional(),
    ...extra,
  });

function display(
  type: string,
  title: string,
  description: string,
  dataSource: WidgetDataSource,
  extra: { props?: Record<string, z.ZodTypeAny>; eventsOut?: BoardBusEvent[]; roles?: WidgetDef["roles"] } = {},
): WidgetDef {
  return {
    type,
    family: "display",
    title,
    description,
    dataSource,
    eventsIn: ["selection.set", "filter.set", "refresh.request"],
    eventsOut: extra.eventsOut ?? ["selection.set"],
    roles: extra.roles ?? ["OWNER", "DISPATCHER", "VIEWER"],
    perfBudgetKb: 150,
    lazy: false,
    emptyState: `No ${title.toLowerCase()} match the current filters.`,
    keyboardOps: "Tab reaches rows; Enter selects and publishes selection.set; / focuses search.",
    propsSchema: baseProps(extra.props),
  };
}

function viz(
  type: string,
  title: string,
  description: string,
  dataSource: WidgetDataSource,
  extra: { props?: Record<string, z.ZodTypeAny>; lazy?: boolean; budgetKb?: number } = {},
): WidgetDef {
  return {
    type,
    family: "visualization",
    title,
    description,
    dataSource,
    eventsIn: ["selection.set", "filter.set", "refresh.request"],
    eventsOut: ["selection.set", "filter.set"],
    roles: ["OWNER", "DISPATCHER", "VIEWER"],
    perfBudgetKb: extra.budgetKb ?? 220,
    lazy: extra.lazy ?? true,
    emptyState: `Nothing to plot for ${title.toLowerCase()} yet.`,
    keyboardOps: "Tab reaches the chart; arrow keys move between points; Enter filters the board.",
    propsSchema: baseProps(extra.props),
  };
}

function filter(
  type: string,
  title: string,
  description: string,
  extra: { props?: Record<string, z.ZodTypeAny> } = {},
): WidgetDef {
  return {
    type,
    family: "filtering",
    title,
    description,
    dataSource: "none",
    eventsIn: [],
    eventsOut: ["filter.set"],
    roles: ["OWNER", "DISPATCHER", "VIEWER"],
    perfBudgetKb: 40,
    lazy: false,
    emptyState: "",
    keyboardOps: "Fully keyboard operable; changes announce through a live region.",
    propsSchema: filterProps(extra.props),
  };
}

function eventWidget(
  type: string,
  title: string,
  description: string,
  extra: { action?: boolean; roles?: WidgetDef["roles"] } = {},
): WidgetDef {
  return {
    type,
    family: "event",
    title,
    description,
    dataSource: "none",
    eventsIn: ["selection.set"],
    eventsOut: ["action.open", "refresh.request", "navigate"],
    roles: extra.roles ?? ["OWNER", "DISPATCHER"],
    perfBudgetKb: 60,
    lazy: false,
    emptyState: "",
    keyboardOps: "Buttons are real buttons with visible focus; forms label every field.",
    propsSchema: z.object({
      title: z.string().max(80).optional(),
      actionKey: extra.action === false ? z.string().max(80).optional() : z.string().min(1).max(80),
      confirmText: z.string().max(120).optional(),
    }),
  };
}

function aip(
  type: string,
  title: string,
  description: string,
  extra: { props?: Record<string, z.ZodTypeAny> } = {},
): WidgetDef {
  return {
    type,
    family: "aip",
    title,
    description,
    dataSource: "agent",
    eventsIn: ["selection.set", "filter.set"],
    eventsOut: ["selection.set", "action.open"],
    roles: ["OWNER", "DISPATCHER", "VIEWER"],
    perfBudgetKb: 180,
    lazy: true,
    emptyState: "Ask a question grounded in the current board selection.",
    keyboardOps: "Tab reaches prompt and history; responses render as plain text with cited links.",
    propsSchema: baseProps({ systemPrompt: z.string().max(2000).optional(), ...extra.props }),
  };
}

function system(
  type: string,
  title: string,
  description: string,
  dataSource: WidgetDataSource,
  extra: { roles?: WidgetDef["roles"] } = {},
): WidgetDef {
  return {
    type,
    family: "system",
    title,
    description,
    dataSource,
    eventsIn: ["refresh.request"],
    eventsOut: ["navigate"],
    roles: extra.roles ?? ["OWNER", "DISPATCHER"],
    perfBudgetKb: 100,
    lazy: false,
    emptyState: "Nothing recorded yet.",
    keyboardOps: "Lists are Tab-navigable; rows activate with Enter.",
    propsSchema: baseProps(),
  };
}

export const WIDGETS: WidgetDef[] = [
  display("object-table", "Object table", "Paginated rows of one object type with per-row evidence links.", "objects", { props: { typeKey: z.string().min(1).max(64), columns: z.array(z.string().max(64)).max(20).optional() } }),
  display("object-list", "Object list", "Compact list of objects with match explanations.", "search", { props: { typeKey: z.string().min(1).max(64).optional() } }),
  display("object-view", "Object view", "One object with all properties, facts and links.", "objects", { props: { objectId: z.string().max(64).optional() } }),
  display("property-list", "Property list", "Key/value properties of the selected object.", "objects", { props: { showEmpty: z.boolean().optional() } }),
  display("links", "Links", "Linked objects grouped by link type with traversal depth.", "traverse", { props: { depth: z.number().int().min(0).max(4).optional() } }),
  display("object-set-title", "Object set title", "Count + freshness line for the current object set.", "objects"),
  viz("chart-xy", "Chart XY", "Bars/lines/scatter over aggregated object values.", "measures", { props: { x: z.string().max(64).optional(), y: z.string().max(64).optional(), form: z.enum(["bar", "line", "scatter"]).optional() } }),
  viz("vega-chart", "Vega chart", "Declarative Vega-Lite spec over a function result.", "measures", { props: { spec: z.record(z.unknown()).optional() }, budgetKb: 220 }),
  viz("map", "Map", "Validated geopoints with popups into the explorer.", "objects", { props: { latField: z.string().max(64).optional(), lngField: z.string().max(64).optional() } }),
  viz("gantt-chart", "Gantt chart", "Shipments and tasks across time with status color.", "objects", { props: { startField: z.string().max(64).optional(), endField: z.string().max(64).optional() } }),
  viz("pie-chart", "Pie chart", "Share breakdowns (≤5 slices, no rainbow series).", "measures", { props: { slices: z.number().int().min(2).max(5).optional() } }),
  viz("stepper", "Stepper", "Stage progress for a pipeline object.", "objects", { props: { stages: z.array(z.string().max(40)).max(10).optional() } }),
  display("markdown", "Markdown", "Operator-authored notes bound to the board.", "none", { props: { body: z.string().max(5000).optional() } }),
  viz("metric-card", "Metric card", "One big number with delta and source pin.", "measures", { props: { format: z.enum(["int", "money", "pct"]).optional() }, budgetKb: 60, lazy: false }),
  viz("pivot-table", "Pivot table", "Grouped aggregations with row/column dimensions.", "measures", { props: { rows: z.array(z.string().max(64)).max(5).optional(), columns: z.array(z.string().max(64)).max(5).optional() } }),
  viz("timeline", "Timeline", "Events and facts in time order with actor labels.", "events", { props: { objectId: z.string().max(64).optional() } }),
  display("resource-list", "Resource list", "Files, briefs and exports attached to the selection.", "objects"),
  display("media-preview", "Media preview", "Preview of an attached file with metadata.", "objects", { props: { fileId: z.string().max(64).optional() } }),
  display("spreadsheet-display", "Spreadsheet display", "Grid view of staged import rows with quarantine flags.", "objects", { props: { runId: z.string().max(64).optional(), showQuarantined: z.boolean().optional() } }),
  display("video-display", "Video display", "Linked video briefing with transcript excerpt.", "none", { props: { src: httpsUrl(), transcript: z.string().max(5000).optional() } }),
  display("audio-transcription", "Audio + transcription", "Call recording with searchable transcript.", "none", { props: { src: httpsUrl(), showTranscript: z.boolean().optional() } }),
  display("pdf-viewer", "PDF viewer", "Weekly brief PDF with page navigation.", "none", { props: { src: httpsUrl(), page: z.number().int().min(1).optional() } }),
  display("image-annotation", "Image annotation", "Photo evidence with pinned notes.", "objects", { props: { fileId: z.string().max(64).optional(), objectId: z.string().max(64).optional() } }),
  display("free-form-analysis", "Free-form analysis", "Analyst scratchpad saved per board.", "none", { props: { placeholder: z.string().max(80).optional(), maxLength: z.number().int().min(100).max(20000).optional() } }),
  viz("time-series-analysis", "Time series analysis", "Trailing sums, WoW deltas and forecast bands.", "measures", { props: { windowDays: z.number().int().min(1).max(365).optional(), metric: z.string().max(64).optional() } }),
  display("data-freshness", "Data freshness", "Per-source last-sync + STALE badges.", "none", { props: { sources: z.array(z.string().max(64)).max(20).optional() } }),
  display("edit-history", "Edit history", "Correction chain for the selected figure.", "events", { props: { objectId: z.string().max(64).optional() } }),
  display("linked-resources", "Linked resources", "Packs, blueprints and docs linked to this board.", "none", { props: { kinds: z.array(z.enum(["pack", "blueprint", "doc"])).max(3).optional() } }),
  display("action-log-timeline", "Action log timeline", "Executed actions with actors and diffs.", "events", { props: { actionKey: z.string().max(80).optional(), objectId: z.string().max(64).optional() } }),
  filter("filter-list", "Filter list", "Checkbox facets bound to a widget.", { props: { field: z.string().max(64).optional(), options: z.array(z.string().max(64)).max(50).optional() } }),
  filter("object-dropdown", "Object dropdown", "Single-object picker publishing selection.set.", { props: { typeKey: z.string().min(1).max(64).optional() } }),
  filter("string-selector", "String selector", "Single string value published as a filter.", { props: { options: z.array(z.string().max(64)).max(50).optional() } }),
  filter("date-time-picker", "Date/time picker", "Time window published as a filter.", { props: { field: z.string().max(64).optional() } }),
  filter("text-input", "Text input", "Free text published as a search filter.", { props: { placeholder: z.string().max(80).optional() } }),
  filter("numeric-input", "Numeric input", "Threshold value published as a filter.", { props: { min: z.number().optional(), max: z.number().optional() } }),
  filter("filter-pills", "Filter pills", "Active filters with one-tap removal.", {}),
  filter("search-bar", "Search bar", "Board-wide object search.", { props: { placeholder: z.string().max(80).optional() } }),
  filter("prominent-terms", "Prominent terms", "Top search terms as quick filters.", { props: { count: z.number().int().min(1).max(10).optional() } }),
  filter("user-select", "User select", "Org member picker for assignment filters.", {}),
  eventWidget("button-group", "Button group", "Buttons opening action forms for the selection."),
  eventWidget("media-uploader", "Media uploader", "File upload triggering an ingest action on receipt."),
  eventWidget("comments", "Comments", "Threaded operator notes on the selection.", { action: false }),
  eventWidget("tabs", "Tabs", "Tabbed panes switching widget groups.", { action: false }),
  eventWidget("inline-action-form", "Inline action form", "Action form rendered inline, validated live."),
  eventWidget("audio-recorder", "Audio recorder", "Voice note attached to the selection.", { action: false }),
  aip("aip-analyst", "AIP analyst", "Grounded Q&A over the board selection with citations."),
  aip("aip-chatbot", "AIP chatbot", "Standing assistant scoped to board objects and functions."),
  aip("aip-generated-content", "AIP generated content", "Drafted summaries with derivation chains shown."),
  viz("observability-chart", "Observability chart", "Runs, latency and error telemetry per board.", "events", { props: { metric: z.enum(["runs", "latency", "errors"]).optional() } }),
  display("iframe", "Iframe", "Embedded allowlisted external view.", "none"),
  display("embedded-module", "Embedded module", "Another board module embedded read-only.", "none"),
  eventWidget("drag-drop", "Drag and drop", "Drag objects across widgets to link or assign.", { action: false }),
  eventWidget("app-pairing", "App pairing", "Paired view into answers, briefs or packs.", { action: false }),
  eventWidget("commands", "Commands", "Command bar executing board actions.", { action: false }),
  display("scenario-manager", "Scenario manager", "What-if branches staged, compared and merged.", "objects"),
  display("scenario-selector", "Scenario selector", "Active scenario picker for the board.", "objects"),
  display("scenario-summary", "Scenario summary", "Before/after KPIs of the active scenario.", "measures"),
  display("mobile-navbar", "Mobile navbar", "Compact navigation for narrow viewports.", "none"),
  display("qr-reader", "QR reader", "Scan lot/shipment codes into the selection.", "none"),
  display("current-location", "Current location", "Operator geolocation as a map filter.", "none"),
  system("layout-grid", "Layout grid", "Drag/resize canvas positions (board chrome).", "none", { roles: ["OWNER", "DISPATCHER", "VIEWER"] }),
  system("variable-bar", "Variable bar", "Function-backed board variables with recompute state.", "measures"),
  system("event-inspector", "Event inspector", "Selection-bus traffic for debugging boards.", "events"),
  system("version-history", "Version history", "Board layout versions with one-click revert.", "none"),
  system("publish-flow", "Publish flow", "Review + publish board changes to viewers.", "none"),
  system("permission-pane", "Permission pane", "Per-widget role visibility matrix.", "none", { roles: ["OWNER"] }),
  system("performance-profiler", "Performance profiler", "Per-widget load budgets vs measured p95.", "events"),
  system("usage-metrics", "Usage metrics", "Widget views and filter uses per board.", "events"),
  system("state-saver", "State saver", "Persisted selections and filters per user.", "none"),
  system("translations-pane", "Translations pane", "Operator-facing copy variants (future i18n).", "none"),
];

export const WIDGET_KEYS = WIDGETS.map((w) => w.type);

export function getWidget(type: string): WidgetDef | null {
  return WIDGETS.find((w) => w.type === type) ?? null;
}

export function validateWidgetProps(type: string, props: unknown) {
  const def = getWidget(type);
  if (!def) return { ok: false as const, error: `unknown widget ${type}` };
  const parsed = (def.propsSchema as z.ZodTypeAny).safeParse(props ?? {});
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  return { ok: true as const, value: parsed.data };
}

export interface BoardWidgetInput {
  id?: string;
  type: string;
  props?: unknown;
}

// Board-level gate: the canvas calls this before rendering or persisting.
// Unknown types, invalid props, over-limit boards, viewer-invisible action
// widgets, duplicate ids and dangling filter targets are all reported with
// positions — never rendered broken.
export function validateWidgetBoard(
  widgets: BoardWidgetInput[],
  role: "OWNER" | "DISPATCHER" | "VIEWER" = "VIEWER",
): { ok: boolean; problems: Array<{ index: number; type: string; message: string }> } {
  const problems: Array<{ index: number; type: string; message: string }> = [];
  if (widgets.length === 0) problems.push({ index: -1, type: "*", message: "board has no widgets" });
  if (widgets.length > 50) problems.push({ index: -1, type: "*", message: "board exceeds 50 widgets" });
  const ids = new Map<string, number>();
  widgets.forEach((w, index) => {
    if (w.id) {
      if (ids.has(w.id)) {
        problems.push({ index, type: w.type, message: `duplicate widget id ${w.id} (first at ${ids.get(w.id)})` });
      } else {
        ids.set(w.id, index);
      }
    }
  });
  widgets.forEach((w, index) => {
    const def = getWidget(w.type);
    if (!def) {
      problems.push({ index, type: w.type, message: `unknown widget ${w.type}` });
      return;
    }
    const parsed = validateWidgetProps(w.type, w.props);
    if (!parsed.ok) problems.push({ index, type: w.type, message: parsed.error });
    if (!def.roles.includes(role)) {
      problems.push({ index, type: w.type, message: `${w.type} is not visible to ${role}` });
    }
    // Filtering widgets bind to a target widget by id; dangling targets
    // fail here so the canvas never wires a filter into the void.
    if (def.family === "filtering") {
      const target = (w.props as { targetWidget?: unknown } | undefined)?.targetWidget;
      if (typeof target === "string" && target !== "" && !ids.has(target)) {
        problems.push({ index, type: w.type, message: `filter target ${target} is not on this board` });
      }
    }
  });
  return { ok: problems.length === 0, problems };
}
