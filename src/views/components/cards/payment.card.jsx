import React, { useState } from "react";
import { Eye, EyeOff, Plus, Pencil, Trash2 } from "lucide-react";
import {
  PAYMENT_PROVIDERS,
  BANKS,
} from "@/constants/paymentProviders.constants";
import { useAuth } from "@/context/auth.provider";

const formatCardNumber = (num = "") => {
  return (
    num
      .replace(/\D/g, "")
      .match(/.{1,4}/g)
      ?.join(" ") || "0000 0000 0000 0000"
  );
};

const maskCardNumber = (num = "") => {
  const clean = num.replace(/\D/g, "");
  const last4 = clean.slice(-4);
  return `xxxx xxxx xxxx ${last4}`;
};

const getProviderLogo = (provider) => {
  const match = PAYMENT_PROVIDERS.find(
    (p) => p.provider.toLowerCase() === provider?.toLowerCase()
  );
  return match?.logoUrl || null;
};

const getBankLogo = (bankName) => {
  const bank = BANKS.UAE.find((b) =>
    b.name.toLowerCase().includes(bankName?.toLowerCase())
  );
  return bank?.logoUrl || null;
};

const getCardColor = (bankName) => {
  const bank = BANKS.UAE.find((b) =>
    b.name.toLowerCase().includes(bankName?.toLowerCase())
  );
  return bank?.color || "bg-primary";
};

const getAccountHolderDetails = (ownerID) => {
  const { accountUsers } = useAuth();
  const accountHolder = accountUsers?.[ownerID];
  return `${accountHolder?.fname || ""} ${accountHolder?.lname || ""}`.trim();
};

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
  } = data;

  const formattedNumber = showFullNumber
    ? formatCardNumber(number)
    : maskCardNumber(number);

  const providerLogo = provider ? getProviderLogo(provider) : null;
  const bankLogo = getBankLogo(bank);
  const cardColor = getCardColor(bank);
  const accountHolder = getAccountHolderDetails(owner);

  return (
    <div
      className={`group relative min-w-[280px] h-[200px] bg-gradient-to-r ${cardColor} rounded-xl p-6 text-white shadow-lg cursor-pointer hover:shadow-2xl transition-shadow flex flex-col justify-between`}
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
        {bankLogo ? (
          <img src={bankLogo} alt={bank} className="h-6 object-contain" />
        ) : (
          <div className="h-6" />
        )}
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
