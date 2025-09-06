import React, { useState, useEffect } from "react";
import CustomInput from "../customs/customInput";
import CustomButton from "../customs/customButton";

const DynamicForm = ({
  title,
  schema = {},
  defaultData = {},
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() => {
    const initialData = {};
    Object.keys(schema).forEach((key) => {
      initialData[key] = defaultData[key] ?? "";
    });
    return initialData;
  });

  useEffect(() => {
    const initialData = {};
    Object.keys(schema).forEach((key) => {
      initialData[key] = defaultData[key] ?? "";
    });
    setFormData(initialData);
  }, [JSON.stringify(schema), JSON.stringify(defaultData)]);

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
      {/* Optional title */}
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

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
            multiSelect={config?.multiSelect}
          />
        </div>
      ))}

      <div className="flex justify-end gap-2">
        <CustomButton type="submit" className="py-2" label="Save" />
        {onCancel && (
          <CustomButton
            type="button"
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
