import React, { useState, useMemo } from "react";

const CurrencySelectorModal = ({
  exchangeRates = [], // [{ code: "USD", symbol: "$", rate: 0.27 }, ...]
  selectedCurrency = null,
  onSelect, // callback to set selected currency
}) => {
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState(null);

  const filteredRates = useMemo(() => {
    return exchangeRates
      .filter((item) => item.code.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [search, exchangeRates]);

  return (
    <div className="p-5 w-full max-w-md mx-auto">
      {/* Search + Selected */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search currency..."
          className="flex-1 p-2 rounded-md border border-gray-300 focus:outline-none focus:ring focus:ring-blue-400"
        />
        {current && (
          <div className="ml-4 px-3 py-2 rounded bg-blue-100 text-blue-800 font-medium text-sm whitespace-nowrap">
            {`Selected: ${current.code} ${current.symbol}`}
          </div>
        )}
      </div>

      {/* Conversion Info */}
      {current && (
        <div className="text-center mb-4 text-gray-700 font-medium">
          {`1 ${selectedCurrency.code} = `}
          <span className="text-blue-600 font-semibold">
            {current.rate} {current.code}
          </span>
        </div>
      )}

      {/* Currency List */}
      <div className="max-h-[400px] overflow-y-auto border-t border-gray-200 pt-2 mb-4">
        {filteredRates.map(({ code, symbol, rate }) => (
          <button
            key={code}
            onClick={() => {
              setCurrent({ code, symbol, rate });
            }}
            className={`flex justify-between w-full py-2 px-3 rounded-md transition text-left ${
              current?.code === code ? "bg-blue-100" : "hover:bg-blue-50"
            }`}
          >
            <div className="font-semibold text-gray-800">
              {code} <span className="text-gray-500">{symbol}</span>
            </div>
            <div className="text-gray-600">{rate}</div>
          </button>
        ))}

        {filteredRates.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-6">
            No currencies found.
          </div>
        )}
      </div>

      {/* Confirm Button */}
      {current && (
        <button
          onClick={() => onSelect?.(current)}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Confirm
        </button>
      )}
    </div>
  );
};

export default CurrencySelectorModal;
