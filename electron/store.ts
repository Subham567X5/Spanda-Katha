import { app, safeStorage } from "electron";
import path from "path";
import fs from "fs";

/**
 * Persisted user settings for the desktop app.
 *
 * The Gemini API key is the critical secret: in the web build it came from AI
 * Studio's secrets panel, which no longer exists in a packaged app. We store it
 * encrypted with Electron's `safeStorage` (OS keychain-backed) inside the
 * per-user userData directory.
 */

interface SettingsShape {
  /** Base64-encoded, safeStorage-encrypted API key. */
  apiKeyEnc?: string;
  /** Fallback plaintext key, used only when safeStorage is unavailable. */
  apiKeyPlain?: string;
}

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

function read(): SettingsShape {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to read settings file:", err);
  }
  return {};
}

function write(data: SettingsShape) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write settings file:", err);
  }
}

/** True when the OS supports native safeStorage encryption. */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/** Returns the decrypted Gemini API key, or "" if none is set. */
export function getApiKey(): string {
  const data = read();
  if (data.apiKeyEnc && isEncryptionAvailable()) {
    try {
      const buf = Buffer.from(data.apiKeyEnc, "base64");
      return safeStorage.decryptString(buf);
    } catch (err) {
      console.error("Failed to decrypt API key:", err);
    }
  }
  return data.apiKeyPlain || "";
}

/** Returns true if a non-empty API key is stored. */
export function hasApiKey(): boolean {
  return getApiKey().trim().length > 0;
}

/** Encrypts (when possible) and stores the Gemini API key. */
export function setApiKey(key: string): void {
  const trimmed = (key || "").trim();
  const data = read();
  // Always clear both slots first, then repopulate the right one.
  delete data.apiKeyEnc;
  delete data.apiKeyPlain;

  if (!trimmed) {
    write(data);
    return;
  }

  if (isEncryptionAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(trimmed);
      data.apiKeyEnc = encrypted.toString("base64");
    } catch (err) {
      console.error("safeStorage encryption failed, falling back to plaintext:", err);
      data.apiKeyPlain = trimmed;
    }
  } else {
    data.apiKeyPlain = trimmed;
  }

  write(data);
}
