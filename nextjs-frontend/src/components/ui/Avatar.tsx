import { avatarUri, type AvatarChoice } from "@/lib/avatars";
import { cn } from "@/lib/utils";

const PALETTE = ["#0F766E", "#2A5DB0", "#7A4BB0", "#975A16", "#276749", "#4A5568"];

export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const sizes = { xs: "size-5 text-[10px]", sm: "size-6 text-[11px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

/**
 * DiceBear avatar when `avatar` is given, else initials with a stable colour per name
 * (white text, AA on every palette colour).
 */
export function Avatar({
  name,
  avatar,
  size = "md",
  className,
  title,
}: {
  name: string | null | undefined;
  avatar?: AvatarChoice | null;
  size?: keyof typeof sizes;
  className?: string;
  title?: string;
}) {
  const n = name ?? "";
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local data: URI, nothing to optimise
      <img
        src={avatarUri(avatar)}
        alt={title ?? n}
        title={title ?? n}
        className={cn("inline-block shrink-0 select-none rounded-full bg-surface-2", sizes[size], className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={title ?? n}
      title={title ?? n}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", sizes[size], className)}
      style={{ backgroundColor: colorFor(n) }}
    >
      <span aria-hidden>{initials(n)}</span>
    </span>
  );
}

/** Overlapping avatars (household members). `ringClassName` matches the background behind it. */
export function AvatarStack({
  names,
  avatars,
  size = "sm",
  max = 4,
  ringClassName = "ring-surface",
  className,
}: {
  names: string[];
  /** Same order as `names`; missing entries fall back to initials. */
  avatars?: (AvatarChoice | null | undefined)[];
  size?: keyof typeof sizes;
  max?: number;
  ringClassName?: string;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} avatar={avatars?.[i]} size={size} className={cn("ring-2", ringClassName)} />
      ))}
      {rest > 0 ? (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-2 ring-2", sizes[size], ringClassName)}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
