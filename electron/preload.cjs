// Minimal audited renderer bridge: read-only facts, no Node.js, no raw
// IPC. The renderer never gets require(), ipcRenderer, or shell access;
// anything the UI needs from the shell must be added here deliberately, one
// field at a time, and reviewed like an API.
//
// Deliberate addition (updater, reviewed): three narrow update operations.
// No file paths, no URLs, no secrets cross this bridge — only status
// objects shaped below and user-confirmed actions (check now, restart).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("monadDesktop", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});

contextBridge.exposeInMainWorld("monad", {
  checkForUpdates: () => ipcRenderer.invoke("monad:check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("monad:quit-and-install"),
  onUpdateStatus: (cb) => {
    const handler = (_event, status) => cb(status);
    ipcRenderer.on("monad:update-status", handler);
    return () => ipcRenderer.removeListener("monad:update-status", handler);
  },
});
