import { useSyncExternalStore } from "react";

// SHA-256 of the owner passphrase. Only the hash ships in the bundle.
const OWNER_HASH = "a5e54cbfca0ffb9f0967e032cd23f5af0cd2954a2a70a888fa59ca50b71373cc";
const KEY = "owner-token";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function read() {
  try {
    return localStorage.getItem(KEY) === OWNER_HASH;
  } catch {
    return false;
  }
}

export async function unlockOwner(passphrase: string) {
  const ok = (await sha256(passphrase.trim())) === OWNER_HASH;
  if (ok) {
    try {
      localStorage.setItem(KEY, OWNER_HASH);
    } catch {
      /* storage blocked: owner mode lasts until reload */
    }
    emit();
  }
  return ok;
}

export function lockOwner() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function useIsOwner() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
}
