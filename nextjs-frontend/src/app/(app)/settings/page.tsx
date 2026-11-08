"use client";
import { Suspense } from "react";
import { SkeletonList } from "@/components/ui/Skeleton";
import { SettingsView } from "@/features/settings/SettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SkeletonList rows={4} />}>
      <SettingsView />
    </Suspense>
  );
}
