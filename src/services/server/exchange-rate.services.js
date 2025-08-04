import { CURRENCIES } from "@/constants/currencies.constants";
import { useCacheUtils } from "@/utils/cache.utils";

const { VITE_EXCHANGE_RATE_API_KEY } = import.meta.env;

const getExchangeRates = async (baseCurrency) => {
  try {
    if (!baseCurrency) throw new Error("Base currency required");

    const apiUrl = `https://v6.exchangerate-api.com/v6/${VITE_EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const exchangeRates = data?.conversion_rates;

    if (!exchangeRates) {
      console.error("Failed to fetch exchange rates.");
      return [];
    }

    const allCurrencies = CURRENCIES?.codes?.map((code) => {
      const symbol = CURRENCIES.symbols?.[code] || "";
      const flag = CURRENCIES.flags?.[code] || "";
      const rate = exchangeRates[code] ?? null; // `??` handles missing entries
      return {
        code,
        symbol,
        rate,
        flag,
      };
    });

    return allCurrencies;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return null;
  }
};

const convertRate = async (src, target) => {
  let conversionRate = 1,
    convertedVal = src?.value;
  if (src.currency !== target?.code) {
    if (src.currency === "AED" && target?.code === "CAD") {
      conversionRate = 1 / src?.exchangeRate;
    } else {
      const exchangeRates = await getExchangeRates(src?.currency);
      const rateEntry = exchangeRates?.find(
        (entry) => entry.code === target?.code
      );
      conversionRate = rateEntry?.rate ?? null;
    }
  }

  convertedVal = (src.value * conversionRate).toFixed(2);
  return convertedVal;
};

const convertRateForReceipts = async (allReceipts = [], exchangeRate) => {
  if (exchangeRate && allReceipts.length > 0) {
    // console.log(
    //   `Running Rate Conversion to ${exchangeRate?.code} with the rate of ${exchangeRate.rate}.`
    // );
    for (const receipt of allReceipts) {
      const {
        value: receiptValue,
        currency: receiptCurrency,
        exchangeRate: receiptRate,
      } = receipt;
      const { code: targetCurrency, symbol: targetSymbol } = exchangeRate;

      if (receiptCurrency === targetCurrency) {
        receipt.value = receiptValue;
        receipt.currency = receiptCurrency;
        receipt.symbol = targetSymbol;
      } else if (receiptCurrency === "AED" && targetCurrency === "CAD") {
        receipt.value = receiptValue / receiptRate;
        receipt.currency = "CAD";
        receipt.symbol = targetSymbol;
      } else if (receiptCurrency === "CAD" && targetCurrency === "AED") {
        receipt.value = receiptValue * receiptRate;
        receipt.currency = "AED";
        receipt.symbol = targetSymbol;
      } else if (receiptCurrency !== targetCurrency) {
        if (receipt?._id === "RECEIPT-MDXGNMLJ-MJUHZWP1") console.log(receipt);
        receipt.value = await convertRate(receipt, exchangeRate);
        receipt.currency = targetCurrency;
        receipt.symbol = targetSymbol;
      }
    }
  }

  return allReceipts;
};

export const useExchangeRateServices = {
  getExchangeRates,
  convertRate,
  convertRateForReceipts,
};
