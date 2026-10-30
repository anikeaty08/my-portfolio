import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  addEventListener("hashchange", cb);
  return () => removeEventListener("hashchange", cb);
};

/** The current location hash, kept in sync with the address bar. */
export function useHash() {
  return useSyncExternalStore(subscribe, () => location.hash, () => "");
}

/** `#/article/<id>` opens an article page. Anything else is the home page. */
export function articleIdFromHash(hash: string) {
  const m = /^#\/article\/([\w-]+)/.exec(hash);
  return m ? m[1] : null;
}

export const articleHref = (id: string) => `#/article/${id}`;

/** Scrolls to an element, retrying briefly because lazy sections may not be mounted yet. */
export function scrollToId(id: string, tries = 20) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView();
  else if (tries > 0) setTimeout(() => scrollToId(id, tries - 1), 80);
}
