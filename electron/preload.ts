import { contextBridge, ipcRenderer } from "electron";

/**
 * The only API surface the renderer process may touch. Keeping it tiny reduces
 * the attack surface of the app. The renderer uses this to detect that it is
 * running inside Electron and to open the Settings window.
 *
 * The actual API key never crosses this bridge — it lives only in the main
 * process and the child server.
 */
contextBridge.exposeInMainWorld("elysium", {
  /** True when running inside the Electron desktop shell. */
  isDesktop: true,
  /** Whether a Gemini API key is currently configured. */
  hasApiKey: () => ipcRenderer.invoke("settings:hasApiKey"),
  /** Open the Settings window (where the user can set the API key). */
  openSettings: () => ipcRenderer.send("settings:open"),
  /** Listen for requests from main to surface a "key needed" prompt. */
  onPromptApiKey: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("settings:prompt-key", listener);
    return () => ipcRenderer.removeListener("settings:prompt-key", listener);
  },
});
