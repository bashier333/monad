// Board layout undo/redo: bounded history stack over layout+widget states.
// Pure — the canvas pushes on every committed drag/resize; Ctrl+Z walks back.

export interface LayoutSnapshot {
  layout: unknown[];
  widgets: unknown[];
}

export interface LayoutHistory {
  past: LayoutSnapshot[];
  future: LayoutSnapshot[];
}

const CAP = 50;

export function pushHistory(history: LayoutHistory, present: LayoutSnapshot): LayoutHistory {
  return { past: [...history.past, present].slice(-CAP), future: [] };
}

export function undoLayout(
  history: LayoutHistory,
  present: LayoutSnapshot,
): { history: LayoutHistory; present: LayoutSnapshot } | null {
  if (history.past.length === 0) return null;
  const prev = history.past[history.past.length - 1]!;
  return {
    history: { past: history.past.slice(0, -1), future: [present, ...history.future].slice(0, CAP) },
    present: prev,
  };
}

export function redoLayout(
  history: LayoutHistory,
  present: LayoutSnapshot,
): { history: LayoutHistory; present: LayoutSnapshot } | null {
  if (history.future.length === 0) return null;
  const [next, ...rest] = history.future;
  return {
    history: { past: [...history.past, present].slice(-CAP), future: rest },
    present: next!,
  };
}

export function emptyHistory(): LayoutHistory {
  return { past: [], future: [] };
}
