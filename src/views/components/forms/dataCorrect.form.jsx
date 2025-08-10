import React, { useState } from "react";
import CustomInput from "@/views/components/customs/customInput";
import CustomButton from "@/views/components/customs/customButton";
import { useTextUtils } from "@/utils/text.utils";
import { useAuth } from "@/context/auth.provider";

const fields = ["expenses", "credit", "income", "savings"];

const DataCorrectionForm = ({ initialData, onSave, onCancel }) => {
  const { user, exchangeRate } = useAuth();

  // Get saved corrections
  const savedCorrections = user?.correctionParams?.[initialData?.user] || {};

  // Combine initial value and correction to get corrected value
  const getCorrected = (field) =>
    (initialData?.[field] || 0) + (savedCorrections?.[field] || 0);

  const [formValues, setFormValues] = useState({
    expenses: getCorrected("expenses"),
    credit: getCorrected("credit"),
    income: getCorrected("income"),
    savings: getCorrected("savings"),
  });

  const handleChange = (field, value) => {
    const parsed = parseFloat(value) || 0;

    setFormValues((prev) => ({
      ...prev,
      [field]: parsed,
    }));
  };

  const handleSubmit = () => {
    // Calculate corrections to return
    const correctionValues = fields.reduce((acc, field) => {
      const original = parseFloat(initialData?.[field]) || 0;
      const corrected = parseFloat(formValues[field]) || 0;
      acc[field] = corrected - original;
      return acc;
    }, {});
    onSave?.(correctionValues);
  };

  const formatMoney = (value) =>
    useTextUtils.getMoneyText?.(value, exchangeRate?.code);

  return (
    <div className="bg-white p-4 space-y-4 w-full">
      <h2 className="text-lg font-medium mb-4">🛠️ Correct Analytics Values</h2>

      <div className="grid grid-cols-4 font-semibold border-b pb-2 text-sm text-gray-600">
        <span>Label</span>
        <span>Original</span>
        <span>Corrected</span>
        <span>Correction</span>
      </div>

      {fields.map((field) => {
        const original = parseFloat(initialData?.[field]) || 0;
        const corrected = parseFloat(formValues[field]) || 0;
        const correction = corrected - original;

        return (
          <div
            key={field}
            className="grid grid-cols-4 items-center py-2 border-b text-sm gap-4"
          >
            <div className="capitalize">{field}</div>

            {/* Original Value */}
            <div className="text-gray-500">{formatMoney(original)}</div>

            {/* Corrected Value (Editable) */}
            <div>
              <CustomInput
                type="number"
                value={formValues[field]}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            </div>

            {/* Correction */}
            <div
              className={`${
                correction === 0
                  ? "text-gray-400"
                  : correction > 0
                  ? "text-primary"
                  : "text-red-600"
              }`}
            >
              {formatMoney(correction)}
            </div>
          </div>
        );
      })}

      <div className="flex justify-end gap-2 pt-4">
        <CustomButton label="Cancel" onClick={onCancel} color="secondary" />
        <CustomButton label="Save Corrections" onClick={handleSubmit} />
      </div>
    </div>
  );
};

export default DataCorrectionForm;
