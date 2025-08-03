import React, { useRef, useState, useEffect } from "react";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import { useTextUtils } from "@/utils/text.utils";
import { CURRENCIES } from "@/constants/currencies.constants";

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

// Utility functions to format and parse money strings
const formatMoney = (value) => {
  if (value == null || value === "") return "";
  const number = Number(String(value).replace(/[^0-9.-]+/g, ""));
  if (isNaN(number)) return "";
  return number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseMoney = (formattedValue) => {
  if (!formattedValue) return "";
  return formattedValue.replace(/,/g, "");
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
  options = [], // for dropdown or currencies
  autoCapitalize = false,
  isDisabled = false,
  showIcon = false,

  // New props for money type
  currencyOptions = CURRENCIES.codes,
  selectedCurrency = "AED",
  onCurrencyChange,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (type === "money") {
      setInternalValue(formatMoney(value));
    } else {
      setInternalValue(value);
    }
  }, [value, type]);

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
    const displayValue = value
      ? new Date(value).toISOString().slice(0, 10)
      : "";

    const handleDateChange = (e) => {
      const dateVal = e.target.value; // yyyy-mm-dd
      if (dateVal) {
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
        <option value="">{`Select ${placeholder?.toLowerCase()}`}</option>
        {options?.map((opt, idx) => (
          <option key={idx} value={opt.value ?? opt}>
            {opt.label ?? useTextUtils.capitalize(opt)}
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

  if (type === "money") {
    const handleMoneyChange = (e) => {
      const rawValue = e.target.value;
      if (/^[0-9.,]*$/.test(rawValue)) {
        setInternalValue(rawValue);
        if (onChange) onChange({ target: { value: parseMoney(rawValue) } });
      }
    };

    const handleMoneyBlur = () => {
      setInternalValue(formatMoney(internalValue));
    };

    return (
      <div
        className={`relative w-full border rounded flex items-center ${
          isDisabled ? "bg-gray-100" : ""
        } ${
          error
            ? "border-red-500 focus-within:border-red-600 focus-within:ring-red-500"
            : ""
        }`}
      >
        {/* Currency Dropdown on the left */}
        <select
          value={selectedCurrency}
          onChange={(e) => onCurrencyChange?.(e.target.value)}
          disabled={isDisabled}
          className="bg-transparent border-r border-gray-300 px-4 py-2 rounded-l text-sm cursor-pointer focus:outline-none focus:ring-0"
          style={{ minWidth: "5.5rem" }}
        >
          {currencyOptions.map((cur) => (
            <option key={cur} value={cur}>
              {cur}
            </option>
          ))}
        </select>

        {/* Money Input */}
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          value={internalValue || ""}
          onChange={handleMoneyChange}
          onBlur={handleMoneyBlur}
          placeholder={placeholder}
          disabled={isDisabled}
          className={`flex-grow p-2 rounded-r outline-none border-none ${
            showIcon || children ? "pl-10" : ""
          }`}
        />

        {/* Optional Icon inside input on right side */}
        {showIcon && (children || null) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full border rounded p-2${
        isDisabled ? " bg-gray-100" : ""
      }`}
    >
      {showIcon && (children || Icon) && (
        <div className="absolute top-1/2 left-3 transform -translate-y-1/2 pointer-events-none text-gray-400 px-2">
          {children || <Icon fontSize="small" />}
        </div>
      )}

      <input
        type={type === "password" ? (showPassword ? "text" : "password") : type}
        value={autoCapitalize ? useTextUtils.capitalize(value) : value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={isDisabled}
        className={`${shape} ${border} ${text} w-full ${
          showIcon && (children || Icon) ? "pl-10" : ""
        } ${errorBorderClass}`}
      />

      {/* Password toggle icon */}
      {type === "password" && (
        <div
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute top-1/2 right-3 transform -translate-y-1/2 text-gray-400 cursor-pointer px-2"
        >
          {showPassword ? "🙉" : "🙈"}
        </div>
      )}
    </div>
  );
};

export default CustomInput;
