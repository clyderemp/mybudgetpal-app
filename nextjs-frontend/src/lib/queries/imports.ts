"use client";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  ImportPatch,
  ImportRowPatch,
  ImportSummary,
  ListResponse,
  MerchantRule,
  MerchantRuleCreate,
  MerchantRuleUpdate,
  StatementImport,
} from "../types";
import { invalidateMoney } from "./keys";

/** Statement import query keys (kept here so keys.ts stays untouched). */
export const qkImports = {
  all: ["imports"] as const,
  list: ["imports", "list"] as const,
  detail: (id: string) => ["imports", "detail", id] as const,
  merchantRules: ["merchant-rules"] as const,
};

/** Store the server's latest copy of an import and refresh the history list. */
function storeImport(qc: QueryClient, imp: StatementImport) {
  qc.setQueryData(qkImports.detail(imp.id), imp);
  return qc.invalidateQueries({ queryKey: qkImports.list });
}

/** Import history, newest first (summaries without rows). */
export function useImports() {
  return useQuery({
    queryKey: qkImports.list,
    queryFn: ({ signal }) => api.get<ListResponse<ImportSummary>>("/imports", undefined, { signal }),
  });
}

/** One import with its rows. */
export function useImport(id: string | null | undefined) {
  return useQuery({
    queryKey: qkImports.detail(id ?? ""),
    queryFn: ({ signal }) => api.get<StatementImport>(`/imports/${id}`, undefined, { signal }),
    enabled: Boolean(id),
  });
}

/** POST /imports (multipart, field "file"). */
export function useUploadStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file, file.name);
      return api.post<StatementImport>("/imports", fd);
    },
    onSuccess: (imp) => storeImport(qc, imp),
  });
}

/** Map sections to accounts and/or re-run matching. */
export function usePatchImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: `import-${id}` },
    mutationFn: (body: ImportPatch) => api.patch<StatementImport>(`/imports/${id}`, body),
    onSuccess: (imp) => storeImport(qc, imp),
  });
}

/**
 * Per-row edits and bulk actions (one request). Optimistic: the cached rows update at once and
 * roll back on failure. Mutations for one import run in order (shared scope) so a slow response
 * never overwrites a newer edit.
 */
export function usePatchImportRows(id: string) {
  const qc = useQueryClient();
  const key = qkImports.detail(id);
  return useMutation({
    scope: { id: `import-${id}` },
    mutationFn: (rows: ImportRowPatch[]) => api.patch<StatementImport>(`/imports/${id}/rows`, { rows }),
    onMutate: async (rows) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StatementImport>(key);
      if (previous) {
        const byId = new Map(rows.map((r) => [r.id, r]));
        qc.setQueryData<StatementImport>(key, {
          ...previous,
          rows: previous.rows.map((r) => {
            const p = byId.get(r.id);
            if (!p) return r;
            const { id: _id, ...changes } = p;
            void _id;
            const defined = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
            return { ...r, ...defined, edited: true };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _rows, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (imp) => {
      // Only apply if no newer edit is queued behind this one (avoids flicker back to older values).
      const pending = qc.getMutationCache().findAll({ predicate: (m) => m.options.scope?.id === `import-${id}` && m.state.status === "pending" });
      if (pending.length <= 1) qc.setQueryData(key, imp);
      return qc.invalidateQueries({ queryKey: qkImports.list });
    },
  });
}

export function useCommitImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: `import-${id}` },
    mutationFn: () => api.post<StatementImport>(`/imports/${id}/commit`),
    onSuccess: (imp) => Promise.all([storeImport(qc, imp), invalidateMoney(qc)]),
  });
}

/** Committed: removes the batch's transactions. Draft: discards it. */
export function useRollbackImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<StatementImport>(`/imports/${id}/rollback`),
    onSuccess: (imp) => Promise.all([storeImport(qc, imp), invalidateMoney(qc)]),
  });
}

/* ---------------- Merchant rules ---------------- */

export function useMerchantRules() {
  return useQuery({
    queryKey: qkImports.merchantRules,
    queryFn: ({ signal }) => api.get<ListResponse<MerchantRule>>("/merchant-rules", undefined, { signal }),
  });
}

export function useCreateMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MerchantRuleCreate) => api.post<MerchantRule>("/merchant-rules", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkImports.merchantRules }),
  });
}

export function useUpdateMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: MerchantRuleUpdate & { id: string }) => api.patch<MerchantRule>(`/merchant-rules/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkImports.merchantRules }),
  });
}

export function useDeleteMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/merchant-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qkImports.merchantRules }),
  });
}
