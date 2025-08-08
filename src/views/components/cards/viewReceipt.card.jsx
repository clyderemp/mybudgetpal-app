import React from "react";
import { useDateUtils } from "@/utils/date.utils";

const ViewReceiptCard = ({ receipt }) => {
  if (!receipt) return null;

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatCurrency = (value, currency) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(value);

  return (
    <div className="max-w-full bg-white mt-2 p-6 rounded-xl shadow-md font-mono text-gray-800 border border-gray-300">
      {/* Merchant / Title */}
      <h2 className="text-xl font-bold text-center mb-1">{receipt.merchant}</h2>

      {/* Date */}
      <p className="text-center text-xs text-gray-500 mb-2">
        Date:{" "}
        {`${useDateUtils.getFormattedDateString(
          receipt.date
        )} (${useDateUtils.getDaysAgo(receipt.date)})`}
      </p>

      {/* Category */}
      <p className="text-sm mb-2">
        <strong>Category:</strong> {receipt.category}
      </p>

      {/* Payment Method */}
      <p className="text-sm mb-2">
        <strong>Payment Method:</strong> {receipt.paymentMethod}
      </p>

      {/* Note (if available) */}
      {receipt.note && (
        <p className="text-sm mb-2 italic text-gray-600">{receipt.note}</p>
      )}

      {/* Value */}
      <p className="border-t border-dashed border-gray-400 pt-2 mb-4 text-lg font-bold flex justify-between">
        <span>Amount</span>
        <span>{formatCurrency(receipt.value, receipt.currency)}</span>
      </p>

      {/* Items (if available) */}
      {receipt.items && receipt.items.length > 0 && (
        <div className="border-t border-dashed border-gray-400 pt-2">
          <h3 className="text-sm font-semibold mb-2">Items</h3>
          {receipt.items.map(({ name, qty, price }, idx) => (
            <div
              key={idx}
              className="flex justify-between text-sm mb-1 last:mb-0"
            >
              <span>
                {qty} x {name}
              </span>
              <span>{formatCurrency(qty * price, receipt.currency)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer dashed border */}
      <div className="mt-4 border-b-4 border-dashed border-gray-300"></div>
    </div>
  );
};

export default ViewReceiptCard;
