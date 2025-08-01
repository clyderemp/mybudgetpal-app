import React, { useRef } from "react";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import { useTextUtils } from "@/utils/text.utils";

const ImageUpload = ({ value, onChange, placeholder, disabled = false }) => {
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    if (!disabled && e.dataTransfer.files[0]) {
      onChange(e.dataTransfer.files[0]);
    }
  };

  const isUrl = typeof value === "string" && value.startsWith("http");

  return (
    <div
      onClick={() => !disabled && inputRef.current.click()}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`border-dashed border-2 border-gray-300 rounded p-4 text-center cursor-pointer hover:bg-gray-50 transition ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {value ? (
        <img
          src={isUrl ? value : URL.createObjectURL(value)}
          alt="Uploaded"
          className="mx-auto max-h-40 object-contain"
        />
      ) : (
        <p className="text-gray-500">
          {placeholder || "Click or Drag & Drop to upload"}
        </p>
      )}
      <input
        type="file"
        accept="image/*"
        ref={inputRef}
        disabled={disabled}
        onChange={(e) => onChange(e.target.files[0])}
        className="hidden"
      />
    </div>
  );
};

const CustomInput = ({
  type = "text",
  value,
  onChange,
  placeholder,
  shape = "",
  border = "",
  text = "",
  children,
  error = false,
  options = [], // for dropdown
  autoCapitalize = false,
  isDisabled = false,
}) => {
  let Icon = null;
  if (!children) {
    if (type === "password") Icon = LockIcon;
    else if (type === "text") Icon = PersonIcon;
  }

  const errorBorderClass = error
    ? "border-red-500 focus:border-red-600 focus:ring-red-500"
    : "";

  // Special handling for date input to convert between ISO string and yyyy-mm-dd
  if (type === "date") {
    // Convert ISO string to yyyy-mm-dd for display, or empty string if no value
    const displayValue = value
      ? new Date(value).toISOString().slice(0, 10)
      : "";

    const handleDateChange = (e) => {
      const dateVal = e.target.value; // yyyy-mm-dd
      if (dateVal) {
        // Convert to ISO string (UTC midnight)
        const isoString = new Date(dateVal).toISOString();
        onChange({ target: { value: isoString } });
      } else {
        onChange({ target: { value: "" } });
      }
    };

    return (
      <input
        type="date"
        value={displayValue}
        onChange={handleDateChange}
        placeholder={placeholder}
        className={`${shape} ${border} ${text} w-full border rounded p-2 ${errorBorderClass}`}
        disabled={isDisabled}
      />
    );
  }

  if (type === "image") {
    return (
      <ImageUpload
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={isDisabled}
      />
    );
  }

  if (type === "dropdown") {
    return (
      <select
        value={value}
        onChange={onChange}
        className={`${shape} ${border} ${text} w-full border rounded p-2 ${errorBorderClass}`}
        disabled={isDisabled}
      >
        <option value="">Select</option>
        {options.map((opt, idx) => (
          <option key={idx} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        value={autoCapitalize ? useTextUtils.capitalize(value) : value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${shape} ${border} ${text} w-full border rounded p-2 ${errorBorderClass}`}
        disabled={isDisabled}
      />
    );
  }

  return (
    <div
      className={`relative w-full border rounded p-2${
        isDisabled ? " bg-gray-100" : ""
      }`}
    >
      {(children || Icon) && (
        <div className="absolute top-1/2 left-3 transform -translate-y-1/2 pointer-events-none text-gray-400">
          {children || <Icon fontSize="small" />}
        </div>
      )}
      <input
        type={type}
        value={autoCapitalize ? useTextUtils.capitalize(value) : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={isDisabled}
        className={`${shape} ${border} ${text} w-full ${
          children || Icon ? "pl-10" : ""
        } ${errorBorderClass}`}
      />
    </div>
  );
};

export default CustomInput;
