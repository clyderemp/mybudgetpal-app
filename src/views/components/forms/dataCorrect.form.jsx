import React, { useState } from "react";
import CustomInput from "@/views/components/customs/customInput";
import CustomButton from "@/views/components/customs/customButton";
import { useTextUtils } from "@/utils/text.utils";
import { useAuth } from "@/context/auth.provider";

const fields = ["expenses", "credit", "income", "savings"];

const DataCorrectionForm = ({ initialData, onSave, onCancel }) => {
  const { exchangeRate } = useAuth();

  const getRaw = (field) => parseFloat(initialData?.raw?.[field]) || 0;
  const getCorrected = (field) =>
    parseFloat(initialData?.corrections?.[field]) || 0;

  // Initial input values come from corrected values (i.e., corrections = final values)
  const [formValues, setFormValues] = useState(() => {
    const initial = {};
    fields.forEach((field) => {
      initial[field] = getCorrected(field) || getRaw(field);
    });
    return initial;
  });

  const handleChange = (field, value) => {
    const parsed = parseFloat(value) || 0;
    setFormValues((prev) => ({
      ...prev,
      [field]: parsed,
    }));
  };

  const handleSubmit = () => {
    // Return corrected values (not diffs)
    onSave?.(formValues);
  };

  const formatMoney = (value) =>
    useTextUtils.getMoneyText?.(value, exchangeRate?.code);

  return (
    <div className="bg-white p-4 space-y-4 w-full">
      <h2 className="text-lg font-medium mb-4">🛠️ Correct Analytics Values</h2>

      <div className="grid grid-cols-[120px_1fr_1fr_1fr] items-center py-2 border-b text-sm gap-4 font-semibold">
        <span>Label</span>
        <span>Calculated Amount</span>
        <span>Actual Amount</span>
        <span>Correction</span>
      </div>

      {fields.map((field) => {
        const raw = getRaw(field);
        const corrected = formValues[field]?.toFixed(2);
        const correction = corrected - raw;

        return (
          <div
            key={field}
            className="grid grid-cols-[120px_1fr_1fr_1fr] items-center py-2 border-b text-sm gap-4"
          >
            {/* Label - Thinner */}
            <div className="capitalize text-gray-600">{field}</div>

            {/* Original (Raw) */}
            <div className="text-gray-500">{formatMoney(raw)}</div>

            {/* Corrected (Input) */}
            <div>
              <CustomInput
                type="number"
                value={corrected}
                onChange={(e) => handleChange(field, e.target.value)}
              />
            </div>

            {/* Correction Display */}
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
