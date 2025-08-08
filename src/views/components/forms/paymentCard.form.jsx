import React, { useState } from "react";
import CustomInput from "../customs/customInput";
import { useAuth } from "@/context/auth.provider";
import {
  PAYMENT_PROVIDERS,
  BANKS,
} from "@/constants/paymentProviders.constants";
import CustomButton from "../customs/customButton";
import { PAYMENT_METHODS } from "@/constants/transaction.constants";
import { ACCOUNT_TYPES } from "@/constants/transaction.constants";
import CustomExpiryDateInput from "../customs/customExpDateInput";

const PaymentCardForm = ({ data, onSubmit }) => {
  const { accountUsers } = useAuth();

  const [formData, setFormData] = useState(data ?? {});

  const handleChange = (name) => (e) => {
    const value = e.target ? e.target.value : e; // handle select and input
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {/* Card Type */}
      <CustomInput
        type="dropdown"
        value={formData.cardType}
        onChange={handleChange("cardType")}
        placeholder="Card Type"
        options={PAYMENT_METHODS}
      />

      {formData?.cardType && (
        <>
          {/* Account Type Dropdown */}
          <CustomInput
            type="dropdown"
            value={formData.accountType}
            onChange={handleChange("accountType")}
            placeholder="Account Type"
            options={ACCOUNT_TYPES}
          />

          {/* Account Holder Dropdown */}
          <CustomInput
            type="dropdown"
            value={formData.owner}
            onChange={handleChange("owner")}
            placeholder="Account Holder"
            options={Object.entries(accountUsers).map(([id, user]) => ({
              value: id,
              label: `${user.fname} ${user.lname}`,
            }))}
          />
          <div className="flex space-x-4 items-center">
            {/* Card Number */}
            <CustomInput
              type="text"
              value={formData.number}
              onChange={handleChange("number")}
              placeholder="Card Number"
              className="flex-1" // optional: make it take remaining width
            />

            {/* Expiry Date */}
            <CustomExpiryDateInput
              value={formData.exp}
              onChange={(newExp) =>
                handleChange("exp")({ target: { value: newExp } })
              }
            />
          </div>

          {/* Provider Dropdown */}
          <CustomInput
            type="dropdown"
            value={formData.provider}
            onChange={handleChange("provider")}
            placeholder="Provider"
            options={PAYMENT_PROVIDERS.map((p) => ({
              value: p.provider,
              label: p.provider,
            }))}
          />

          {/* Bank Dropdown */}
          <CustomInput
            type="dropdown"
            value={formData.bank}
            onChange={handleChange("bank")}
            placeholder="Bank"
            options={BANKS.UAE.map((b) => ({
              value: b.name,
              label: b.name,
            }))}
          />
        </>
      )}

      {/* Submit Button */}
      <CustomButton label="Save" onClick={handleSubmit} className="px-4 py-2" />
    </form>
  );
};

export default PaymentCardForm;
