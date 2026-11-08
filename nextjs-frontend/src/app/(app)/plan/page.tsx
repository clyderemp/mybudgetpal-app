"use client";
import { Suspense } from "react";
import { SkeletonList } from "@/components/ui/Skeleton";
import { PlanView } from "@/features/plan/PlanView";

export default function PlanPage() {
  return (
    <Suspense fallback={<SkeletonList rows={4} />}>
      <PlanView />
    </Suspense>
  );
}
