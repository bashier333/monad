// Monad Ontology desktop shell: spawns the bundled Next.js standalone
// server (frontend + API + ontology engine + manufacturing model) and shows
// it in a desktop window. Data lives in Postgres via DATABASE_URL, or in a
// local SQLite file when DATABASE_URL is a file: URL (the portable
// zero-config default — see monad.env and lib/core/sqlite.ts).
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");

const CONFIGURED_PORT = process.env.MONAD_PORT ? Number(process.env.MONAD_PORT) : 0;
const HOST = "127.0.0.1";

// Ephemeral loopback port per launch (unless MONAD_PORT pins one): no fixed
// port means a second copy, malware, or a stale server cannot squat or probe
// a well-known address. Loopback-only bind keeps the server off the LAN.
function pickFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, HOST, () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => resolve(port));
    });
  });
}

function standaloneDir() {
  // Same relative layout in dev and packaged (no asar): electron/main.cjs
  // sits next to .next/standalone/server.js. asar must stay off in
  // package.json: the child below runs with ELECTRON_RUN_AS_NODE (plain
  // node, no asar support), so server.js and its tree must be real files.
  // Installer speed comes from packaging excludes, not archiving.
  return path.join(__dirname, "..", ".next", "standalone");
}

// Empty-state artwork for the config-error modal; the real thing is a Node
// string, no DTS.
function splashHtml() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; }
  html, body { margin: 0; height: 100%; background: #141413; color: #faf9f5; display: grid; place-items: center; }
  .box { text-align: center; }
  .mark { width: 48px; height: 48px; margin: 0 auto 14px; border: 1px solid #3d3d3a; border-radius: 14px; display: grid; place-items: center; }
  .mark svg { display: block; }
  h1 { font-size: 15px; font-weight: 600; letter-spacing: 0; margin: 0 0 6px; }
  p { font-size: 13px; color: #9c9a92; margin: 0; }
  .spin { width: 18px; height: 18px; margin-top: 18px; border: 2px solid #3d3d3a; border-top-color: #d97757; border-radius: 50%; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
</head>
<body>
  <div class="box">
    <div class="mark">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97757" stroke-width="1.5">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="3" fill="#d97757" stroke="none"/>
      </svg>
    </div>
    <h1>Monad Ontology</h1>
    <p>Starting the model…</p>
    <div class="spin"></div>
  </div>
</body>
</html>`;
}

async function waitForHealthy(url, timeoutMs = 90000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        // Health is only good when the server itself reports DB reachable.
        if (body && body.ok === true) return "ok";
        if (body && body.ok === false) return "degraded";
      }
    } catch {
      // not up yet
    }
    if (Date.now() - start > timeoutMs) return "timeout";
    await new Promise((r) => setTimeout(r, 500));
  }
}

function parseEnvFile(p) {
  // Returns true when the file was read. Values only fill keys missing from
  // the real environment, so an explicitly exported variable always wins.
  try {
    if (!fs.existsSync(p)) return false;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
    console.log(`MONAD: loaded env from ${p}`);
    return true;
  } catch {
    return false;
  }
}

function loadEnvFile() {
  // Desktop config lives next to the exe (packaged) or repo root (dev).
  // Never commit these files. The per-user file is handled after ready
  // (ensureUserEnv) because userData needs the app module.
  const candidates = [
    path.join(path.dirname(process.execPath), "monad.env"),
    path.join(__dirname, "..", "monad.env"),
  ];
  for (const p of candidates) {
    if (parseEnvFile(p)) return true;
  }
  return false;
}

function ensureUserEnv() {
  // First-boot secrets + zero-config database, both in the per-user data
  // dir (always writable — unlike Program Files). AUTH_SECRET and the
  // database stay per-user and are never baked in. The one exception is the
  // operator's NVIDIA key for private testing builds (seeded from
  // monad.env.shipped, NVIDIA_* only) — anyone holding such an installer
  // can read it, so those builds stay private.
  const { app } = require("electron");
  const userDir = app.getPath("userData");
  const p = path.join(userDir, "monad.env");
  parseEnvFile(p);
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || secret === "dev-only-secret-replace-me" || secret.length < 32) {
    const fresh = require("node:crypto").randomBytes(32).toString("hex");
    process.env.AUTH_SECRET = fresh;
    try {
      fs.writeFileSync(p, `# Generated on first boot. Do not share this file.\nAUTH_SECRET="${fresh}"\n`, { mode: 0o600 });
      console.log("MONAD: generated fresh AUTH_SECRET in user config");
    } catch (e) {
      console.log(`MONAD: could not persist user config (${e instanceof Error ? e.message : String(e)}) — secret lives for this session only`);
    }
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${path.join(userDir, "monad.db")}`;
    console.log("MONAD: DATABASE_URL not set — using per-user SQLite file.");
  }
  seedShippedAiKey(p);
}

function seedShippedAiKey(userEnvPath) {
  // Private-testing builds ship monad.env.shipped (NVIDIA_* only, written by
  // prepare.cjs from the operator's local monad.env). First boot copies any
  // missing NVIDIA_* keys into the per-user config so every download works
  // with zero setup. Existing user values always win — never overwritten.
  // The standalone tree sits at <resources>/app/.next/standalone.
  const shipped = path.join(__dirname, "..", ".next", "standalone", "monad.env.shipped");
  let wanted = [];
  try {
    wanted = fs
      .readFileSync(shipped, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^NVIDIA_[A-Z_]+=./i.test(l));
  } catch {
    return;
  }
  if (wanted.length === 0) return;
  let current = "";
  try {
    current = fs.readFileSync(userEnvPath, "utf8");
  } catch {
    current = "";
  }
  const missing = wanted.filter((l) => {
    const k = l.slice(0, l.indexOf("="));
    if (k in process.env) return false;
    return !new RegExp(`^${k}=.+`, "m").test(current);
  });
  if (missing.length === 0) return;
  for (const l of missing) {
    const k = l.slice(0, l.indexOf("="));
    let v = l.slice(l.indexOf("=") + 1).trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
  try {
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    fs.writeFileSync(userEnvPath, `${current}${prefix}# Shipped AI key (private testing build).\n${missing.join("\n")}\n`, { mode: 0o600 });
    console.log(`MONAD: seeded ${missing.length} shipped AI key(s) into user config`);
  } catch (e) {
    console.log(`MONAD: AI key lives for this session only (${e instanceof Error ? e.message : String(e)})`);
  }
}

function machineIdentity() {
  // Windows MachineGuid → hashed server-side (never the raw value). Works on
  // any user account, no admin needed, survives renames. Fallbacks cover dev
  // shells and non-Windows builds.
  if (process.platform === "win32") {
    try {
      const out = require("node:child_process").execSync(
        "reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
        { encoding: "utf8" }
      );
      const m = out.match(/MachineGuid\s+REG_SZ\s+(.+)/);
      if (m) return `win:${m[1].trim()}`;
    } catch {
      /* fall through */
    }
  }
  const os = require("node:os");
  try {
    const info = os.userInfo();
    return `${os.hostname()}:${info.username}`;
  } catch {
    return `${os.hostname()}:anonymous`;
  }
}

// ---- auto-updater (NSIS installs only) -----------------------------------
// Portable copies have no update channel: electron-updater refuses them, so
// every failure path below degrades to "manual" and the UI offers the
// download page instead of a broken promise. No secrets cross the UI
// bridge — only the status object shaped here.
let updateState = { state: "idle", version: null, progress: null, message: null };

function setUpdateState(patch, win) {
  updateState = { ...updateState, ...patch };
  try {
    if (win && !win.isDestroyed()) win.webContents.send("monad:update-status", updateState);
  } catch {
    /* renderer gone */
  }
}

function setupAutoUpdater(win) {
  const { app, dialog, ipcMain } = require("electron");
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch {
    console.log("MONAD: updater unavailable (electron-updater not installed)");
    updateState = { state: "manual", version: null, progress: null, message: "In-app updates are not installed in this build — use Download." };
    return;
  }
  const feedUrl = process.env.UPDATE_FEED_URL;
  if (!feedUrl) {
    console.log("MONAD: updates dormant — set UPDATE_FEED_URL (e.g. https://host/api/updates) to enable");
    updateState = { state: "manual", version: null, progress: null, message: "Automatic updates are not configured for this install." };
    return;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  try {
    autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
  } catch (e) {
    console.log(`MONAD: bad update feed URL (${e instanceof Error ? e.message : String(e)})`);
    updateState = { state: "manual", version: null, progress: null, message: "The update feed URL is invalid." };
    return;
  }

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({ state: "checking", version: null, progress: null, message: null }, win);
  });
  autoUpdater.on("update-available", (info) => {
    const version = (info && info.version) || null;
    setUpdateState({ state: "available", version, progress: null, message: null }, win);
    if (!win || win.isDestroyed()) return;
    dialog
      .showMessageBox(win, {
        type: "question",
        buttons: ["Download & install on restart", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update available",
        message: `Monad Ontology ${version ?? ""} is available. Download now and install on restart?`,
      })
      .then(({ response }) => {
        if (response !== 0) return;
        setUpdateState({ state: "downloading", version, progress: 0, message: null }, win);
        autoUpdater.downloadUpdate().catch((e) => {
          console.log(`MONAD: update download failed (${e instanceof Error ? e.message : String(e)})`);
          setUpdateState({ state: "manual", version, progress: null, message: "Download failed — fetch it from the download page." }, win);
        });
      })
      .catch(() => undefined);
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = progress && typeof progress.percent === "number" ? Math.round(progress.percent) : null;
    setUpdateState({ state: "downloading", progress: percent, message: null }, win);
  });
  autoUpdater.on("update-downloaded", (info) => {
    const version = (info && info.version) || null;
    setUpdateState({ state: "downloaded", version, progress: 100, message: null }, win);
    if (!win || win.isDestroyed()) return;
    dialog
      .showMessageBox(win, {
        type: "question",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Update ready",
        message: `Monad Ontology ${version ?? ""} downloaded. Restart to install?`,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true);
      })
      .catch(() => undefined);
  });
  autoUpdater.on("update-not-available", () => {
    setUpdateState({ state: "uptodate", version: null, progress: null, message: null }, win);
  });
  autoUpdater.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`MONAD: updater error (${message}) — falling back to manual download`);
    setUpdateState({ state: "manual", version: null, progress: null, message: "Automatic update failed — fetch it from the download page." }, win);
  });

  ipcMain.handle("monad:check-for-updates", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      console.log(`MONAD: manual update check failed (${e instanceof Error ? e.message : String(e)})`);
      setUpdateState({ state: "manual", version: null, progress: null, message: "Could not reach the update feed." }, win);
    }
    return updateState;
  });
  ipcMain.handle("monad:quit-and-install", () => {
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  // One background check per launch, after boot settles. Dev shells
  // (unpacked) skip it — manual checks still work for testing the feed.
  setTimeout(() => {
    if (!app.isPackaged) return;
    autoUpdater.checkForUpdates().catch(() => undefined);
  }, 45000);
}

async function main() {
  const { app, BrowserWindow, dialog, shell, crashReporter, session } = require("electron");

  // Local crash dumps even with nowhere to upload: better than silence.
  // (Full Sentry Electron wiring is a follow-up; this needs no new dep.)
  try {
    crashReporter.start({ uploadToServer: false });
  } catch {
    /* crash reporting unavailable */
  }

  loadEnvFile();

  // Second launch must focus the running instance, not fight for the port.
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    const { app: singletonApp } = app;
    void singletonApp;
    app.quit();
    return;
  }

  await app.whenReady();

  // Taskbar grouping, badge counts, and toast attribution on Windows.
  try {
    app.setAppUserModelId("ai.monad.ontology");
  } catch {
    /* non-Windows or older Electron */
  }
  ensureUserEnv();

  // Baseline content policy for the loopback app: first-party code plus the
  // map-tile and font origins the twin needs. No plugins, no frames, no
  // remote code beyond tiles/fonts. Unsafe-inline stays because Next.js
  // hydration requires it; everything else is denied.
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url.startsWith(`http://${HOST}:`)) {
        details.responseHeaders["Content-Security-Policy"] = [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://tile.openstreetmap.org https://*.basemaps.cartocdn.com; img-src 'self' data: blob: https://tile.openstreetmap.org https://*.basemaps.cartocdn.com; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        ];
      }
      callback({ responseHeaders: details.responseHeaders });
    });
  } catch {
    /* CSP unavailable */
  }

  const PORT = CONFIGURED_PORT > 0 ? CONFIGURED_PORT : await pickFreePort().catch(() => 3987);

  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  if (!fs.existsSync(serverJs)) {
    dialog.showErrorBox("Monad Ontology", `Bundled server not found:\n${serverJs}`);
    app.quit();
    return;
  }

  // ELECTRON_RUN_AS_NODE makes the Electron binary behave as plain node;
  // without it, the binary would boot server.js as a second Electron app
  // (extra windows, port fights, runaway processes). MONAD_MACHINE_ID feeds
  // the auto-sign-in on the server side.
  const child = spawn(process.execPath, [serverJs], {
    cwd: dir,
    // MONAD_DESKTOP=1 switches the server to desktop mode: marketing URLs
    // render the workspace home and client chrome shows the ontology shell.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", MONAD_DESKTOP: "1", MONAD_MACHINE_ID: machineIdentity(), PORT: String(PORT), HOSTNAME: HOST },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => console.log(`[server] ${String(d).trim()}`));
  child.stderr.on("data", (d) => console.error(`[server] ${String(d).trim()}`));
  child.on("exit", (code) => {
    console.log(`[server] exited with code ${code}`);
  });

  // Second instance: focus the running window. Tracked here so we can clean
  // the child server on quit even when setup failed early.
  let win = null;
  let splash = null;
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  const quit = () => {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    app.quit();
  };
  app.on("window-all-closed", quit);
  app.on("before-quit", () => {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  });

  const appIcon = path.join(__dirname, "assets", "icon.ico");
  splash = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#141413",
    icon: appIcon,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, "preload.cjs") },
  });
  splash.once("ready-to-show", () => splash?.show());
  await splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`);

  const status = await waitForHealthy(`http://${HOST}:${PORT}/api/health`);
  splash.close();
  splash = null;

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Monad Ontology",
    autoHideMenuBar: true,
    backgroundColor: "#141413",
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  // Pin the native title: without this the document <title> ("Monad")
  // overwrites the window/taskbar title on every navigation.
  win.setTitle("Monad Ontology");
  win.on("page-title-updated", (e) => e.preventDefault());
  // Popups never open inside the app: allowlisted external URLs go to the
  // system browser, everything else is denied (no target=_blank escapes).
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.protocol === "https:" || u.protocol === "mailto:") {
        void shell.openExternal(url);
      }
    } catch {
      /* malformed: deny */
    }
    return { action: "deny" };
  });
  // Same-document navigation stays in-app; cross-origin top-level attempts
  // are sent out instead of loading foreign content in our window.
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(`http://${HOST}:${PORT}`)) {
      e.preventDefault();
      void shell.openExternal(url).catch(() => undefined);
    }
  });
  // Updater last: IPC + background check. Never blocks boot or navigation.
  setupAutoUpdater(win);

  if (status === "ok") {
    await win.loadURL(`http://${HOST}:${PORT}/workspace`);
    return;
  }

  // Degraded (server up, DB down) and timeout both land here: the md rule is
  // never open the workspace on failure. The screen polls /api/health and
  // navigates in automatically when the server reports ok:true.
  const reason =
    status === "degraded"
      ? "The server is up but the database is unreachable. Check DATABASE_URL, then retry — the workspace opens itself when the model reports healthy."
      : "The bundled server did not become ready. Check DATABASE_URL, then retry.";
  await win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"></head><body style="background:#141413;color:#faf9f5;font-family:-apple-system,'Segoe UI',system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;">
  <div style="text-align:center;max-width:440px;padding:0 24px;">
    <h2 style="font-size:16px;margin:0 0 8px;">Could not reach the model</h2>
    <p id="msg" style="color:#9c9a92;font-size:13px;margin:0 0 16px;">${reason}</p>
    <button id="retry" style="background:#d97757;color:#141413;border:none;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;">Retry now</button>
    <p id="spin" style="display:none;color:#9c9a92;font-size:13px;">Checking…</p>
  </div>
<script>
(function(){
  var host = ${JSON.stringify(HOST)};
  var port = ${JSON.stringify(PORT)};
  var msg = document.getElementById('msg');
  var retry = document.getElementById('retry');
  var spin = document.getElementById('spin');
  var tries = 0;
  async function check(auto){
    spin.style.display = 'block';
    try {
      var res = await fetch('http://' + host + ':' + port + '/api/health', { cache: 'no-store' });
      var body = await res.json().catch(function(){ return null; });
      if (body && body.ok === true) { location.href = 'http://' + host + ':' + port + '/workspace'; return; }
    } catch (e) { /* still down */ }
    spin.style.display = 'none';
    tries += 1;
    msg.textContent = 'Still unreachable (attempt ' + tries + '). ' + ${JSON.stringify(reason)};
    if (auto && tries < 20) setTimeout(function(){ check(true); }, 3000);
  }
  retry.addEventListener('click', function(){ tries = 0; check(false); });
  check(true);
})();
</script>
</body></html>`)}`
  );
}

void main();
