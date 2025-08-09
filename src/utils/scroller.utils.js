import { useCacheUtils } from "./cache.utils";

const saveScrollPosition = (element, key = "default") => {
  if (!element) return;
  const scrollTop = element.scrollTop;
  localStorage.setItem(`scroll-pos-${key}`, scrollTop.toString());
};

const restoreScrollPosition = (element, key = "default") => {
  if (!element) return;
  const saved = localStorage.getItem(`scroll-pos-${key}`);
  if (saved) {
    element.scrollTop = parseInt(saved, 10);
  }
};

export const useScrollerUtils = { saveScrollPosition, restoreScrollPosition };
