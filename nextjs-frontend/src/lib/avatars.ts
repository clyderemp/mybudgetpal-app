import { createAvatar } from "@dicebear/core";
import {
  adventurer,
  avataaars,
  bigSmile,
  bottts,
  funEmoji,
  lorelei,
  micah,
  notionists,
  openPeeps,
  personas,
  pixelArt,
  thumbs,
} from "@dicebear/collection";

/**
 * DiceBear styles users can pick from. Rendered locally to a data: URI, so no avatar request
 * ever leaves the browser and the CSP (img-src 'self' data:) stays unchanged.
 * Keep the ids in sync with AVATAR_STYLES in fastapi-backend/app/schemas/auth.py.
 */
export const AVATAR_STYLES = {
  notionists: { label: "Notionists", style: notionists },
  adventurer: { label: "Adventurer", style: adventurer },
  avataaars: { label: "Avataaars", style: avataaars },
  "big-smile": { label: "Big smile", style: bigSmile },
  bottts: { label: "Robots", style: bottts },
  "fun-emoji": { label: "Emoji", style: funEmoji },
  lorelei: { label: "Lorelei", style: lorelei },
  micah: { label: "Micah", style: micah },
  "open-peeps": { label: "Open Peeps", style: openPeeps },
  personas: { label: "Personas", style: personas },
  "pixel-art": { label: "Pixel art", style: pixelArt },
  thumbs: { label: "Thumbs", style: thumbs },
} as const;

export type AvatarStyleId = keyof typeof AVATAR_STYLES;
export const DEFAULT_AVATAR_STYLE: AvatarStyleId = "notionists";
export const AVATAR_STYLE_IDS = Object.keys(AVATAR_STYLES) as AvatarStyleId[];

export interface AvatarChoice {
  style: string;
  seed: string;
}

const cache = new Map<string, string>();

/** data: URI for a style + seed (memoised; unknown styles fall back to the default). */
export function avatarUri({ style, seed }: AvatarChoice): string {
  const key = `${style}\u0000${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = AVATAR_STYLES[(style in AVATAR_STYLES ? style : DEFAULT_AVATAR_STYLE) as AvatarStyleId];
  // Only seed + a fixed size are passed: no user-controlled SVG options reach the renderer.
  const uri = createAvatar(def.style as Parameters<typeof createAvatar>[0], { seed, size: 96 }).toDataUri();
  if (cache.size > 500) cache.clear();
  cache.set(key, uri);
  return uri;
}

/** A fresh random seed for the "shuffle" button. */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
