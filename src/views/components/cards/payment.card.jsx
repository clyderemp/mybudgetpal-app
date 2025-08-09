import React, { useState } from "react";
import { Eye, EyeOff, Plus, Pencil, Trash2 } from "lucide-react";
import { usePaymentCardUtils } from "@/utils/paymentCard.utils";

const PaymentCard = ({ data, onEdit, onDelete }) => {
  const [showFullNumber, setShowFullNumber] = useState(false);

  if (!data) {
    return (
      <div className="min-w-[280px] h-[170px] bg-dashed border-2 border-gray-300 rounded-xl flex flex-col justify-center items-center text-gray-500 cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-all">
        <Plus size={32} />
        <p className="mt-2 font-medium">Add Card</p>
      </div>
    );
  }

  const {
    owner,
    number = "0000000000000000",
    exp = "--/--",
    provider = null,
    bank = "",
    accountType: type,
  } = data;

  const formattedNumber = showFullNumber
    ? usePaymentCardUtils.formatCardNumber(number)
    : usePaymentCardUtils.maskCardNumber(number);

  const providerLogo = provider
    ? usePaymentCardUtils.getProviderLogo(provider)
    : null;
  const bankLogo = usePaymentCardUtils.getBankLogo(bank);
  const cardColor = usePaymentCardUtils.getCardColor(bank);
  const accountHolder = usePaymentCardUtils.getAccountHolderDetails(owner);
  const accountType = usePaymentCardUtils.getAccountType(type);

  return (
    <div
      className={`group relative min-w-[320px] h-[200px] bg-gradient-to-r ${cardColor} rounded-xl p-6 text-white shadow-lg cursor-pointer hover:shadow-2xl transition-shadow flex flex-col justify-between`}
    >
      {/* Hoverable edit/delete buttons */}
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit?.(data)}
          className="p-1 bg-white bg-opacity-20 hover:bg-opacity-40 rounded"
          title="Edit"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => onDelete?.("delete", data)}
          className="p-1 bg-white bg-opacity-20 hover:bg-opacity-40 rounded"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Top: Bank left, Provider right */}
      <div className="flex justify-between items-center">
        {/* Left: Bank logo + Account type */}
        <div className="flex items-center gap-2">
          {bankLogo ? (
            <img src={bankLogo} alt={bank} className="h-6 object-contain" />
          ) : (
            <div className="h-6" />
          )}
          {accountType && (
            <span className="text-xs text-white font-medium">
              {accountType}
            </span>
          )}
        </div>

        {/* Right: Provider logo */}
        {providerLogo && (
          <img
            src={providerLogo}
            alt={provider}
            className="h-6 object-contain bg-white p-1 rounded-sm"
          />
        )}
      </div>

      {/* Card number with eye toggle */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-xl tracking-widest font-mono">
          {formattedNumber}
        </div>
        <button
          onClick={() => setShowFullNumber((prev) => !prev)}
          className="ml-2 focus:outline-none"
          title={showFullNumber ? "Hide number" : "Show number"}
        >
          {showFullNumber ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Bottom: Account holder left, Expiry right */}
      <div className="flex justify-between text-sm opacity-90 mt-4">
        <span>{accountHolder}</span>
        <span>{exp}</span>
      </div>
    </div>
  );
};

export default PaymentCard;
