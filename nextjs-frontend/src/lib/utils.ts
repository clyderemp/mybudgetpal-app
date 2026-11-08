import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge aware of the custom design tokens (so `text-meta` is a size, not a colour). */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["meta", "title", "kpi"],
      radius: ["container", "control", "chip", "card"],
      shadow: ["pop"],
    },
  },
});

/** Merge class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
