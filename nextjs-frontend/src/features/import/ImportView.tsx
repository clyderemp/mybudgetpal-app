"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ImportHistory } from "./ImportHistory";
import { ImportReview } from "./ImportReview";
import { UploadDropzone } from "./UploadDropzone";

/** /import: upload + history, or the review of one import (?id=…, survives refresh). */
export function ImportView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");

  if (id) return <ImportReview key={id} id={id} />;

  return (
    <>
      <PageHeader title="Import statement" description="Add transactions from a bank statement. You check every row before anything is saved." />
      <div className="flex flex-col gap-5">
        <UploadDropzone onUploaded={(imp) => router.push(`/import?id=${encodeURIComponent(imp.id)}`)} />
        <ImportHistory />
      </div>
    </>
  );
}
