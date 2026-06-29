import { BrowserWindow, ipcMain, shell } from "electron";
import path from "path";

let settingsWin: BrowserWindow | null = null;

/** Create (or focus) the Settings window where the user enters the API key. */
export function createSettingsWindow(parent: BrowserWindow | null) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 520,
    height: 480,
    title: "Settings — Elysium Writer",
    backgroundColor: "#07070d",
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: parent || undefined,
    modal: !!(parent && !parent.isDestroyed()),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "settings-preload.cjs"),
    },
  });

  settingsWin.loadFile(path.join(__dirname, "settings.html"));

  // Force external links to open in the system browser, not the Electron window.
  settingsWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  settingsWin.on("closed", () => {
    settingsWin = null;
  });
}

/** Register IPC used by the Settings window's renderer (settings.html). */
export function registerSettingsWindowIpc(handlers: {
  getApiKey: () => string;
  setApiKey: (key: string) => void;
}) {
  ipcMain.handle("settings:getApiKey", () => handlers.getApiKey());
  ipcMain.handle("settings:setApiKey", (_e, key: string) => {
    handlers.setApiKey(key);
    return true;
  });
  ipcMain.handle("settings:openExternal", (_e, url: string) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return true;
  });
}
