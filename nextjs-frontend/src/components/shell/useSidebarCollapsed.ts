"use client";
import { useCallback, useSyncExternalStore } from "react";

const KEY = "mbp.sidebar.collapsed";
const EVENT = "mbp:sidebar";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Desktop sidebar rail state, persisted per browser (UI preference only). */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* storage unavailable: state just won't persist */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [collapsed, set];
}
