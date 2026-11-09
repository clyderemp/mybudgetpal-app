import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import type { ReceiptReading } from "../types";

/** Sends OCR text (never the image) to the API. `ai: false` = instant local parse only. */
export function useReadReceipt() {
  return useMutation({
    mutationFn: ({ text, ai }: { text: string; ai: boolean }) =>
      api.post<ReceiptReading>("/receipts/read", { text: text.slice(0, 8000), ai }),
  });
}
