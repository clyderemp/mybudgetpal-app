"use client";
import { Suspense } from "react";
import { SkeletonList } from "@/components/ui";
import { BillsView } from "@/features/bills/BillsView";

export default function BillsPage() {
  return (
    <Suspense fallback={<SkeletonList rows={6} />}>
      <BillsView />
    </Suspense>
  );
}
