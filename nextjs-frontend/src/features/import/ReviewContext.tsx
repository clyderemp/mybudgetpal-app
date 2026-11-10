"use client";
import { createContext, useContext } from "react";
import type { Account, Category, ImportRow, ImportRowPatch, ImportSection } from "@/lib/types";

export interface ReviewCtx {
  /** True once the import is committed or rolled back (or while committing). */
  readOnly: boolean;
  accounts: Account[];
  accountsById: Map<string, Account>;
  categories: Category[];
  categoriesById: Map<string, Category>;
  sectionsByIndex: Map<number, ImportSection>;
  /** Per-row validation messages from a failed commit (row id → message). */
  rowErrors: Record<string, string>;
  patchRows: (rows: ImportRowPatch[]) => void;
  openRuleDialog: (row: ImportRow) => void;
}

const Ctx = createContext<ReviewCtx | null>(null);
export const ReviewProvider = Ctx.Provider;

export function useReview(): ReviewCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReview must be used inside ReviewProvider");
  return v;
}
