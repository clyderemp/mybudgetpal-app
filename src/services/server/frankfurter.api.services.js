// services/frankfurterCurrencyApi.js

import { CURRENCIES } from "@/constants/currencies.constants";
import { useCacheUtils } from "@/utils/cache.utils";

const BASE_URL = "https://api.frankfurter.app";

async function fetchWithRetry(url, retries = 3) {
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));
  try {
    const resp = await fetch(url);
    return resp;
  } catch (err) {
    if (retries > 0) {
      const wait = Math.random() * 2000 + 500;
      console.warn(`Fetch failed. Retrying in ${wait}ms...`, err);
      await delay(wait);
      return fetchWithRetry(url, retries - 1);
    }
    throw err;
  }
}

const getExchangeRates = async (baseCurrency) => {
  if (!baseCurrency) throw new Error("Base currency required");
  const cacheKey = `exchangeRates_${baseCurrency}`;
  const cached = await useCacheUtils.get(cacheKey);
  if (cached) {
    console.log(`Using cached exchange rates for ${baseCurrency}`);
    return cached;
  }

  const url = `${BASE_URL}/latest?from=${baseCurrency}`;
  const resp = await fetchWithRetry(url);
  const json = await resp.json();

  if (!json.rates) {
    console.error("Failed to fetch exchange rates:", json);
    return [];
  }

  const rates = CURRENCIES.codes.map((code) => ({
    code,
    symbol: CURRENCIES.symbols?.[code] ?? "",
    flag: CURRENCIES.flags?.[code] ?? "",
    rate: json.rates[code] ?? null,
  }));

  await useCacheUtils.save(cacheKey, rates);
  return rates;
};

const convertRate = async (src, target) => {
  if (src.currency === target?.code) return src.value.toFixed(2);
  const rates = await getExchangeRates(src?.currency);
  const entry = rates?.find((e) => e.code === target.code);
  if (!entry?.rate) {
    console.error(`No rate found from ${src.currency} to ${target.code}`);
    return null;
  }
  return (src.value * entry.rate).toFixed(2);
};

const convertRateForReceipts = async (allReceipts = [], exchangeRateTarget) => {
  if (!exchangeRateTarget || !allReceipts.length) return allReceipts;
  const { code: targetCode, symbol: targetSymbol } = exchangeRateTarget;
  return Promise.all(
    allReceipts.map(async (receipt) => {
      if (receipt.currency === targetCode) {
        receipt.symbol = targetSymbol;
        return receipt;
      }
      const converted = await convertRate(
        { value: receipt.value, currency: receipt.currency },
        { code: targetCode }
      );
      receipt.value = parseFloat(converted);
      receipt.currency = targetCode;
      receipt.symbol = targetSymbol;
      return receipt;
    })
  );
};

export const useFrankfurterCurrencyServices = {
  getExchangeRates,
  convertRate,
  convertRateForReceipts,
};
