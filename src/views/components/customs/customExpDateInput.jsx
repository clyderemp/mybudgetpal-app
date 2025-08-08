import React from "react";

const months = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, "0")
);

const years = Array.from({ length: 15 }, (_, i) => {
  const year = new Date().getFullYear() + i;
  return year.toString().slice(-2); // last two digits, e.g. "26"
});

const CustomExpiryDateInput = ({ value = "", onChange }) => {
  // Split the current exp value to month and year
  const [month, year] = value.split("/");

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    const newExp = `${newMonth}/${year || ""}`;
    onChange(newExp);
  };

  const handleYearChange = (e) => {
    const newYear = e.target.value;
    const newExp = `${month || ""}/${newYear}`;
    onChange(newExp);
  };

  return (
    <div className="flex space-x-2">
      <select
        value={month || ""}
        onChange={handleMonthChange}
        className="p-2 border rounded"
      >
        <option value="">MM</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select
        value={year || ""}
        onChange={handleYearChange}
        className="p-2 border rounded"
      >
        <option value="">YY</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CustomExpiryDateInput;
