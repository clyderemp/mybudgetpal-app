import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Join household" };

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
