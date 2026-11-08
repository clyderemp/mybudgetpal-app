import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { friendlyMessage, isApiError } from "./api";

/**
 * Map ApiError.fields onto react-hook-form fields. Returns a top-level message for
 * anything not mapped (show it in a FormError banner or toast).
 */
export function applyApiErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, known: Path<T>[]): string | null {
  if (!isApiError(err)) return err instanceof Error ? err.message : "Something went wrong";
  let mapped = false;
  if (err.fields) {
    const fields = Object.entries(err.fields);
    for (const [field, msg] of fields) {
      if ((known as string[]).includes(field)) {
        // Single-field errors with a known code get the friendly copy; otherwise
        // capitalise the backend's terse text ("invalid or expired" -> "Invalid or expired").
        const pretty = msg ? msg.charAt(0).toUpperCase() + msg.slice(1) : msg;
        setError(field as Path<T>, { type: "server", message: fields.length === 1 ? friendlyMessage(err.code, pretty) : pretty });
        mapped = true;
      }
    }
  }
  return mapped ? null : friendlyMessage(err.code, err.message);
}
