import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  nativeImage,
} from "electron";
import { ChildProcess, fork } from "child_process";
import path from "path";
import net from "net";

import {
  getApiKey,
  hasApiKey,
  setApiKey,
  isEncryptionAvailable,
} from "./store";
import {
  createSettingsWindow,
  registerSettingsWindowIpc,
} from "./settings-window";

// NOTE: This file is bundled by esbuild into dist-electron/main.cjs. When run
// from the packaged app, __dirname points at dist-electron inside the app's
// resources. When run from source via electron:dev, __dirname points at
// dist-electron in the project root.

const IS_DEV = !app.isPackaged;
const ICON_FILE = path.join(process.resourcesPath || app.getAppPath(), "build", "icon.png");

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let currentPort: number | null = null;

/** Resolve a free TCP port on 127.0.0.1 by letting the OS assign one. */
function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/** Resolve the path to the bundled server, depending on dev vs packaged. */
function resolveServerScript(): string {
  if (IS_DEV) {
    // In dev we talk to the live `npm run dev` server on the fixed dev port.
    return "";
  }
  // Packaged: the esbuild-bundled server sits next to this main.cjs.
  return path.join(__dirname, "..", "dist", "server.cjs");
}

/** Resolve the dist folder the server should serve as static assets. */
function resolveDistPath(): string {
  return path.join(__dirname, "..", "dist");
}

/** Start (or restart) the Express server child with the current API key. */
async function startServer(): Promise<number> {
  const port = IS_DEV ? 3000 : await pickFreePort();
  currentPort = port;

  if (IS_DEV) {
    // In dev the Vite/Express dev server is already running on :3000.
    return port;
  }

  const scriptPath = resolveServerScript();
  const distPath = resolveDistPath();
  const apiKey = getApiKey();

  serverProcess = fork(scriptPath, [], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DIST_PATH: distPath,
      // Pass the key through env rather than a file so it never touches disk
      // in plaintext from our side.
      GEMINI_API_KEY: apiKey,
      ELECTRON_RUN_AS_NODE: undefined as unknown as string,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });

  // Wait for the server to signal it's listening, or fail.
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server failed to start within 15s"));
    }, 15000);

    serverProcess!.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes(`Server running on http://127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProcess!.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });

  return port;
}

/** Tear down the running server child, if any. */
function stopServer() {
  if (!serverProcess) return;
  try {
    if (process.platform === "win32") {
      // On Windows, killing the parent doesn't always reach the child; use a
      // taskkill tree to be safe.
      const { execSync } = require("child_process");
      execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: "ignore" });
    } else {
      serverProcess.kill("SIGTERM");
    }
  } catch {
    /* best effort */
  }
  serverProcess = null;
}

/** Restart the server so it picks up a freshly-saved API key. */
async function restartServer(): Promise<number | null> {
  stopServer();
  try {
    const port = await startServer();
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Reload the window against the (possibly new) port.
      await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    }
    return port;
  } catch (err) {
    console.error("Failed to restart server:", err);
    return null;
  }
}

function createWindow(port: number) {
  let icon;
  try {
    icon = nativeImage.createFromPath(ICON_FILE);
    if (icon.isEmpty()) icon = undefined;
  } catch {
    icon = undefined;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#07070d",
    title: "Elysium Writer",
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  // Open external links (http/https) in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- IPC wiring ---------------------------------------------------------------

// Settings window renderer + main window renderer both use these.
registerSettingsWindowIpc({
  getApiKey,
  setApiKey: (key: string) => {
    setApiKey(key);
    // Restart the child so the new key reaches the server env.
    restartServer();
  },
});

ipcMain.handle("settings:hasApiKey", () => hasApiKey());
ipcMain.handle("settings:isEncryptionAvailable", () => isEncryptionAvailable());

ipcMain.on("settings:open", () => {
  createSettingsWindow(mainWindow);
});

// If the renderer asks us to prompt for a key (e.g. on first launch), open it.
ipcMain.on("settings:prompt-key", () => {
  createSettingsWindow(mainWindow);
});

// --- App lifecycle ------------------------------------------------------------

app.whenReady().then(async () => {
  let port: number;
  try {
    port = await startServer();
  } catch (err) {
    console.error("Failed to start backend server:", err);
    return;
  }

  createWindow(port);

  // First-run guidance: if no key is set, nudge the user toward Settings.
  if (!hasApiKey() && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.once("did-finish-load", () => {
      mainWindow!.webContents.send("settings:prompt-key");
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(currentPort || 3000);
    }
  });
});

app.on("window-all-closed", () => {
  // Single-window desktop app: quitting on all-closed on every platform.
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});

// Ensure no orphaned Node server survives a hard exit.
process.on("exit", stopServer);
process.on("SIGINT", () => {
  stopServer();
  app.quit();
});
process.on("SIGTERM", () => {
  stopServer();
  app.quit();
});
