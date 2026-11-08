"use client";
import { DataGrid, type DataGridProps, type GridValidRowModel } from "@mui/x-data-grid";
import { cn } from "@/lib/utils";

/**
 * Dense desktop table: MUI DataGrid styled with the design tokens (40px rows, 36px header,
 * surface-2 header band, 1px line rules, tabular numerals, accent focus ring).
 * Put it inside a <Panel flush>. Desktop only — render list rows under 768px.
 *
 * Money columns: `align: "right", headerAlign: "right"` and render with <Money>.
 */
export function DataTable<R extends GridValidRowModel>({ className, ...props }: DataGridProps<R> & { className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <DataGrid<R>
        rowHeight={40}
        columnHeaderHeight={36}
        disableColumnMenu
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50, 100]}
        {...props}
      />
    </div>
  );
}

/** Common column helper for right-aligned numeric/money columns. */
export const numericColumn = { align: "right", headerAlign: "right", type: "number" } as const;
