import type { BoardBusEvent } from "@/lib/core/boards/widgets";
import { BOARD_BUS_EVENTS } from "@/lib/core/boards/widgets";
import type { BoardFilters, FieldFilter } from "@/lib/core/boards/filters";

// ---------------------------------------------------------------------------
// Board selection bus: the runtime behind every widget's eventsIn/eventsOut
// contract. Pure and synchronous — the canvas (Phase F) subscribes views to
// it; tests drive it without a DOM. Unknown event types are rejected, never
// swallowed; every accepted event is timestamped for audit replay.
// ---------------------------------------------------------------------------

export interface BusEvent {
  type: BoardBusEvent;
  payload: Record<string, unknown>;
  at: string;
}

export interface SelectionState {
  selectedIds: string[];
  filters: BoardFilters;
  pendingAction: { actionKey: string; objectId?: string } | null;
  lastNavigation: string | null;
  revision: number;
}

const BUS = new Set<string>(BOARD_BUS_EVENTS);

export function initialSelectionState(): SelectionState {
  return { selectedIds: [], filters: {}, pendingAction: null, lastNavigation: null, revision: 0 };
}

export function applyBusEvent(
  state: SelectionState,
  event: { type: string; payload?: Record<string, unknown> },
  nowIso = new Date().toISOString(),
): { ok: true; state: SelectionState; event: BusEvent } | { ok: false; error: string } {
  if (!BUS.has(event.type)) {
    return { ok: false, error: `unknown bus event: ${event.type}` };
  }
  const payload = event.payload ?? {};
  const bump = (s: SelectionState): SelectionState => ({ ...s, revision: state.revision + 1 });
  switch (event.type as BoardBusEvent) {
    case "selection.set": {
      const ids = Array.isArray(payload.ids) ? payload.ids.filter((i): i is string => typeof i === "string") : null;
      if (!ids) return { ok: false, error: "selection.set needs payload.ids string[]" };
      const next = bump({ ...state, selectedIds: [...new Set(ids)].slice(0, 500) });
      return { ok: true, state: next, event: { type: "selection.set", payload: { ids: next.selectedIds }, at: nowIso } };
    }
    case "filter.set": {
      const key = typeof payload.key === "string" && payload.key !== "" ? payload.key : null;
      if (!key) return { ok: false, error: "filter.set needs a non-empty payload.key" };
      const filters = { ...state.filters };
      const v = payload.value;
      if (v === undefined || v === null || v === "") delete filters[key];
      else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") filters[key] = v;
      else if (typeof v === "object") filters[key] = v as FieldFilter;
      else return { ok: false, error: "filter.set value must be a scalar or {op, value}" };
      const next = bump({ ...state, filters });
      return { ok: true, state: next, event: { type: "filter.set", payload: { key, value: filters[key] ?? null }, at: nowIso } };
    }
    case "refresh.request": {
      const next = bump(state);
      return { ok: true, state: next, event: { type: "refresh.request", payload: {}, at: nowIso } };
    }
    case "action.open": {
      const actionKey = typeof payload.actionKey === "string" && payload.actionKey !== "" ? payload.actionKey : null;
      if (!actionKey) return { ok: false, error: "action.open needs payload.actionKey" };
      const objectId = typeof payload.objectId === "string" ? payload.objectId : undefined;
      const next = bump({ ...state, pendingAction: { actionKey, objectId } });
      return { ok: true, state: next, event: { type: "action.open", payload: { actionKey, objectId: objectId ?? null }, at: nowIso } };
    }
    case "navigate": {
      const href = typeof payload.href === "string" && payload.href !== "" ? payload.href : null;
      if (!href) return { ok: false, error: "navigate needs payload.href" };
      const next = bump({ ...state, lastNavigation: href });
      return { ok: true, state: next, event: { type: "navigate", payload: { href }, at: nowIso } };
    }
  }
}

export function createBoardBus() {
  let state = initialSelectionState();
  const listeners = new Set<(event: BusEvent, state: SelectionState) => void>();
  return {
    getState: () => state,
    publish(event: { type: string; payload?: Record<string, unknown> }) {
      const res = applyBusEvent(state, event);
      if (!res.ok) return res;
      state = res.state;
      for (const fn of listeners) fn(res.event, state);
      return res;
    },
    subscribe(fn: (event: BusEvent, state: SelectionState) => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
