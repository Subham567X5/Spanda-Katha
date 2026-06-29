import { contextBridge, ipcRenderer } from "electron";

/**
 * Minimal bridge for the Settings window (settings.html). Only the handful of
 * calls the settings UI needs are exposed.
 */
contextBridge.exposeInMainWorld("settingsApi", {
  getApiKey: () => ipcRenderer.invoke("settings:getApiKey"),
  setApiKey: (key: string) => ipcRenderer.invoke("settings:setApiKey", key),
  openExternal: (url: string) => ipcRenderer.invoke("settings:openExternal", url),
});
