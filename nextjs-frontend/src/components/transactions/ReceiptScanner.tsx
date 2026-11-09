"use client";
import { AlertTriangle, Check, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatFils } from "@/lib/money";
import {
  MAX_RECEIPT_BYTES,
  readReceiptText,
  type OcrProgress,
} from "@/lib/ocr";
import { useReadReceipt } from "@/lib/queries";
import type { ReceiptReading } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "ocr"; progress: OcrProgress }
  | { kind: "ai" }
  | { kind: "done"; reading: ReceiptReading; refining: boolean }
  | { kind: "error"; message: string };

const hasAnything = (r: ReceiptReading) =>
  r.amountFils != null || Boolean(r.merchant) || Boolean(r.date);

/**
 * "Scan receipt" for the new-transaction form. OCR runs on this device; only the text goes to
 * the API. The form is filled at once from the API's instant text reading, then the slower AI
 * reading (free models, often 20 s+) refines it: `onRead(ai, previous)` lets the form skip
 * fields the user already changed.
 */
export function ReceiptScanner({
  onRead,
  expectedCurrency = "AED",
}: {
  onRead: (reading: ReceiptReading, previous: ReceiptReading | null) => void;
  /** Currency of the chosen account; a receipt in another currency gets a warning. */
  expectedCurrency?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const readM = useReadReceipt();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(
    () => () => void (preview && URL.revokeObjectURL(preview)),
    [preview],
  );

  async function scan(file: File) {
    const id = ++run.current;
    if (!file.type.startsWith("image/"))
      return setState({
        kind: "error",
        message: "Choose a photo or screenshot of the receipt.",
      });
    if (file.size > MAX_RECEIPT_BYTES)
      return setState({
        kind: "error",
        message: "That image is over 15 MB. Choose a smaller one.",
      });
    setPreview(URL.createObjectURL(file));
    setState({ kind: "ocr", progress: { step: "loading", progress: 0 } });
    try {
      const text = await readReceiptText(
        file,
        (progress) => run.current === id && setState({ kind: "ocr", progress }),
      );
      if (run.current !== id) return;
      if (text.replace(/\s/g, "").length < 8) {
        return setState({
          kind: "error",
          message:
            "No text found. Retake the photo flat, in good light, with the whole receipt in frame.",
        });
      }
      setState({ kind: "ai" });
      const local = await readM.mutateAsync({ text, ai: false });
      if (run.current !== id) return;
      if (hasAnything(local)) {
        onRead(local, null);
        setState({ kind: "done", reading: local, refining: true });
      }
      const ai = await readM.mutateAsync({ text, ai: true }).catch(() => null);
      if (run.current !== id) return;
      if (ai && ai.source === "ai" && hasAnything(ai)) {
        onRead(ai, hasAnything(local) ? local : null);
        setState({ kind: "done", reading: ai, refining: false });
      } else if (hasAnything(local)) {
        setState({
          kind: "done",
          reading: { ...local, aiUnavailable: true },
          refining: false,
        });
      } else {
        setState({
          kind: "error",
          message:
            "Couldn't find a total, shop or date on this receipt. Enter it by hand or try a clearer photo.",
        });
      }
    } catch (err) {
      if (run.current === id)
        setState({
          kind: "error",
          message: errorMessage(err, "Couldn't read the receipt. Try again."),
        });
    }
  }

  function reset() {
    run.current++;
    setState({ kind: "idle" });
    setPreview(null);
  }

  const busy = state.kind === "ocr" || state.kind === "ai";
  const pct =
    state.kind === "ocr"
      ? Math.round(state.progress.progress * 100)
      : state.kind === "ai"
        ? 100
        : 0;
  const label =
    state.kind === "ocr"
      ? state.progress.step === "loading"
        ? "Preparing the scanner…"
        : `Reading text… ${pct}%`
      : "Working out the total, shop and date…";

  return (
    <div className="mb-5 rounded-container border border-dashed border-line-strong bg-surface-2 p-3">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void scan(file);
        }}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img
              src={preview}
              alt="Receipt"
              className="size-12 shrink-0 rounded-md border border-line object-cover"
            />
          ) : (
            <span className="grid size-12 shrink-0 place-items-center rounded-md bg-surface text-ink-2">
              <ScanLine className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1" aria-live="polite">
            {busy ? (
              <>
                <p className="text-meta font-medium text-ink">{label}</p>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Receipt scan progress"
                >
                  <div
                    className={cn(
                      "h-full rounded-full bg-accent transition-[width]",
                      state.kind === "ai" && "animate-pulse",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            ) : state.kind === "done" ? (
              <ScanSummary
                reading={state.reading}
                refining={state.refining}
                expectedCurrency={expectedCurrency}
              />
            ) : state.kind === "error" ? (
              <p className="flex items-start gap-1.5 text-meta text-danger">
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />{" "}
                {state.message}
              </p>
            ) : (
              <>
                <p className="text-meta font-medium text-ink">
                  Fill this in from a receipt
                </p>
                <p className="text-meta text-ink-2">
                  Take a photo or pick a screenshot. The image stays on this
                  device.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 [&>button:last-child]:flex-1 sm:[&>button:last-child]:flex-none">
          {state.kind === "done" || state.kind === "error" ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear scan"
              onClick={reset}
            >
              <X />
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <ScanLine /> {state.kind === "idle" ? "Scan receipt" : "Scan again"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScanSummary({
  reading,
  refining,
  expectedCurrency,
}: {
  reading: ReceiptReading;
  refining: boolean;
  expectedCurrency: string;
}) {
  const foreign = reading.currency && reading.currency !== expectedCurrency;
  const found = [
    reading.merchant,
    reading.amountFils != null
      ? formatFils(reading.amountFils, reading.currency ?? expectedCurrency)
      : null,
    reading.date,
  ].filter(Boolean);
  return (
    <div className="text-meta">
      <p className="flex items-start gap-1.5 font-medium text-ink">
        <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
        <span className="min-w-0 break-words">
          Filled in: {found.join(", ")}
        </span>
      </p>
      <p className="text-ink-2">
        {refining
          ? "Checking with AI for items and anything missed…"
          : reading.source === "ai"
            ? "Checked with AI. Check the fields before saving."
            : reading.aiUnavailable
              ? "AI is busy, so this was read from the text only. Check the fields before saving."
              : "Read from the text. Check the fields before saving."}
      </p>
      {foreign ? (
        <p className="mt-1 flex items-start gap-1.5 text-warn">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          This receipt is in {reading.currency}. The amount was copied as shown;
          convert it to {expectedCurrency} before saving.
        </p>
      ) : null}
    </div>
  );
}
