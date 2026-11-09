"use client";
import { Avatar } from "@/components/ui/Avatar";
import { useMemberAvatars } from "@/lib/queries";

/** A household member's chosen DiceBear avatar (initials if the member isn't known). */
export function MemberAvatar({
  userId,
  name,
  ...rest
}: {
  userId?: string | null;
  name: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const lookup = useMemberAvatars();
  return <Avatar name={name} avatar={lookup(userId, name)} {...rest} />;
}
