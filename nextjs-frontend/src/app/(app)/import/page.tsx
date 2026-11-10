"use client";
import { Suspense } from "react";
import { SkeletonList } from "@/components/ui";
import { ImportView } from "@/features/import/ImportView";

export default function ImportPage() {
  return (
    <Suspense fallback={<SkeletonList rows={8} />}>
      <ImportView />
    </Suspense>
  );
}
