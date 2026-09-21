// Client-side desktop (exe) mode flag. Fetched once per page load and
// shared by every chrome gate so the shell and nav agree.
let cached: Promise<boolean> | null = null;

export function getDesktopMode(): Promise<boolean> {
  if (!cached) {
    cached = fetch("/api/desktop")
      .then((r) => r.json())
      .then((b: { desktop?: unknown }) => b.desktop === true)
      .catch(() => false);
  }
  return cached;
}
