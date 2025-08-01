import React, { useState, useEffect } from "react";
import CustomInput from "../customs/customInput";
import CustomButton from "../customs/customButton";

const DynamicForm = ({ schema = {}, defaultData = {}, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const initialData = {};
    Object.keys(schema).forEach((key) => {
      initialData[key] = defaultData[key] ?? "";
    });
    setFormData(initialData);
  }, [schema, defaultData]);

  const handleChange = (key) => (e) => {
    const value = e?.target?.value ?? e;
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(schema).map(([key, config]) => (
        <div key={key}>
          <label className="block mb-1 font-medium">
            {config.label || key.replace(/_/g, " ").toUpperCase()}
          </label>
          <CustomInput
            type={config.type || "text"}
            value={formData[key]}
            onChange={handleChange(key)}
            placeholder={config.placeholder || ""}
            options={config.options || []}
            isDisabled={!config.allowEdit && defaultData[key]}
          />
        </div>
      ))}

      <div className="flex justify-end gap-2">
        <CustomButton className="py-2" label="Save" onClick={handleSubmit} />
        {onCancel && (
          <CustomButton
            color="danger"
            className="py-2"
            label="Cancel"
            onClick={onCancel}
          />
        )}
      </div>
    </form>
  );
};

export default DynamicForm;
