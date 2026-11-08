// Global toast helper. Call notify() from anywhere (components, mutation callbacks).
// Rendered by <Toaster/> inside AppProviders (Radix Toast).
import { errorMessage } from "@/lib/api";

export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => {
    listeners.delete(l);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export interface NotifyInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

function push(input: NotifyInput): number {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, variant: "info", ...input }];
  emit();
  return id;
}

/**
 * notify("Saved") · notify.success("Transaction added") · notify.error(err)
 * notify.error accepts an ApiError/Error/unknown and shows its message.
 */
export const notify = Object.assign((title: string | NotifyInput) => push(typeof title === "string" ? { title } : title), {
  success: (title: string, description?: string) => push({ title, description, variant: "success" }),
  info: (title: string, description?: string) => push({ title, description, variant: "info" }),
  error: (err: unknown, title = "Something went wrong") =>
    push({
      title: typeof err === "string" ? err : title,
      description: typeof err === "string" ? undefined : errorMessage(err),
      variant: "error",
      duration: 7000,
    }),
});
