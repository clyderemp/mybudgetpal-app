"use client";
import { AlertCircle, FileUp } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Panel, Spinner } from "@/components/ui";
import { useUploadStatement } from "@/lib/queries";
import type { StatementImport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ACCEPT, checkFile, uploadErrorMessage } from "./importMeta";

/** Drag-and-drop (or click / Enter) zone that uploads a PDF or CSV statement. */
export function UploadDropzone({ onUploaded }: { onUploaded: (imp: StatementImport) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadStatement();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const start = (file: File | undefined) => {
    if (!file || upload.isPending) return;
    const problem = checkFile(file);
    setFileName(file.name);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    upload.mutate(file, {
      onSuccess: (imp) => onUploaded(imp),
      onError: (err) => setError(uploadErrorMessage(err)),
    });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    start(e.dataTransfer.files?.[0]);
  };

  const busy = upload.isPending;

  return (
    <Panel title="Upload a statement" description="PDF or CSV from your bank, up to 4 MB. Nothing is saved until you review and import.">
      <button
        type="button"
        disabled={busy}
        aria-describedby={error ? "import-upload-error" : undefined}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-container border border-dashed px-4 py-8 text-center transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2 hover:border-ink-3",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-container border border-line bg-surface text-ink-2">
          {busy ? <Spinner className="size-5" /> : <FileUp className="size-5" aria-hidden />}
        </span>
        {busy ? (
          <span className="flex min-w-0 max-w-full flex-col gap-0.5" aria-live="polite">
            <span className="text-sm font-semibold text-ink">Reading statement</span>
            <span className="truncate text-meta text-ink-2">{fileName}</span>
          </span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">{dragging ? "Drop to upload" : "Drop a statement here, or choose a file"}</span>
            <span className="text-meta text-ink-2">PDF or CSV, up to 4 MB</span>
          </span>
        )}
        {!busy ? (
          <span className="inline-flex h-8 items-center rounded-control border border-line-strong bg-surface px-2.5 text-meta font-semibold text-ink">
            Choose file
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          start(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error ? (
        <div id="import-upload-error" role="alert" className="mt-3 flex items-start gap-2 text-meta text-ink">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p className="min-w-0">
            {fileName ? <span className="font-medium break-all">{fileName}: </span> : null}
            {error}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
