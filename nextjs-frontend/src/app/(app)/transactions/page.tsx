"use client";
import { Suspense } from "react";
import { SkeletonList } from "@/components/ui";
import { TransactionsView } from "@/features/transactions/TransactionsView";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<SkeletonList rows={8} />}>
      <TransactionsView />
    </Suspense>
  );
}
