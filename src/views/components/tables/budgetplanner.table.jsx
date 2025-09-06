import React from "react";
import { Plus } from "lucide-react";

export const BudgetTable = ({
  title,
  data,
  columns = [],
  onAdd,
  onRowClick,
}) => {
  return (
    <div className="my-6 bg-gray-50 rounded-xl p-4 shadow-sm">
      {/* Header with title + add button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark transition"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-sm font-bold text-gray-700"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 hover:bg-gray-100 transition cursor-pointer"
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-2 text-sm text-gray-800"
                    >
                      {String(item[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-gray-500 italic"
                >
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
