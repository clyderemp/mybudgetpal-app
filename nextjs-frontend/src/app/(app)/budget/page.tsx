"use client";
import { Suspense } from "react";
import { SkeletonList } from "@/components/ui";
import { BudgetView } from "@/features/budget/BudgetView";

export default function BudgetPage() {
  return (
    <Suspense fallback={<SkeletonList rows={6} />}>
      <BudgetView />
    </Suspense>
  );
}
