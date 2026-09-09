import { useSyncExternalStore } from "react";

const storageKey = "ngertiin-attempt-sound";
const changeEvent = "ngertiin-sound-change";
let fallbackEnabled: boolean | undefined;

function getSoundEnabled(): boolean {
  if (fallbackEnabled !== undefined) return fallbackEnabled;
  try {
    return localStorage.getItem(storageKey) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void): () => void {
  function onStorage(event: StorageEvent): void {
    if (event.key === storageKey || event.key === null) {
      fallbackEnabled = undefined;
      onChange();
    }
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, onChange);
  };
}

function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(storageKey, enabled ? "on" : "off");
    fallbackEnabled = undefined;
  } catch {
    fallbackEnabled = enabled;
    // Keep the preference usable for this session when storage is unavailable.
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function useSoundPreference() {
  const soundEnabled = useSyncExternalStore(subscribe, getSoundEnabled, () => true);
  return { soundEnabled, setSoundEnabled };
}
