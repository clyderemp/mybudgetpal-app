import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

import {
  parseISO,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  compareDesc,
} from "date-fns";
import { useCacheUtils } from "./cache.utils";
import { useFilterUtils } from "./filter.utils";

countries.registerLocale(enLocale);

const getLast7DaysData = (type = "all", data) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    return { date, count: 0, value: 0 };
  });

  data.forEach((item) => {
    const itemDate = new Date(item?.date);
    itemDate.setHours(0, 0, 0, 0);
    const match = days.find((d) => d.date.getTime() === itemDate.getTime());
    const typeMatched = type === "all" ? true : item?.type === type;
    if (match && typeMatched) {
      match.count += 1;
      const itemValue =
        typeof item.value === "number" && !isNaN(item.value)
          ? item.value
          : !isNaN(item.value)
          ? JSON.parse(item?.value)
          : 0;
      match.value += itemValue;
    }
  });

  return days.reverse().map((d) => ({
    label: dayLabels[d.date.getDay()],
    count: d.count,
    value: d.value,
  }));
};

const getLast12MonthsData = (type = "all", data) => {
  const today = new Date();
  today.setDate(1);
  today.setHours(0, 0, 0, 0);

  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(today);
    date.setMonth(today.getMonth() - i);
    return { date, count: 0, value: 0 };
  });

  data.forEach((item) => {
    const itemDate = new Date(item?.date);
    itemDate.setDate(1);
    itemDate.setHours(0, 0, 0, 0);

    const match = months.find((m) => m.date.getTime() === itemDate.getTime());
    const typeMatched = type === "all" ? true : item?.type === type;
    if (match && typeMatched) {
      match.count += 1;
      const itemValue =
        typeof item.value === "number" && !isNaN(item.value)
          ? item.value
          : !isNaN(item.value)
          ? JSON.parse(item?.value)
          : 0;
      match.value += itemValue;
    }
  });

  return months.reverse().map((m) => ({
    label: `${monthLabels[m.date.getMonth()]}`,
    count: m.count,
    value: m.value,
  }));
};

const getCountryCounts = (data, countrySelector) => {
  const counts = {};

  const getCountryCode = (countryName) => {
    return countries.getAlpha2Code(countryName, "en") || null;
  };

  data.forEach((item) => {
    const country = countrySelector(item) || "Unknown";
    const code = getCountryCode(country);

    if (!counts[country]) {
      counts[country] = { country, code, count: 0 };
    }
    counts[country].count += 1;
  });

  return Object.values(counts).sort((a, b) => b.count - a.count);
};

const getAverage = (data, type = "weekly") => {
  const now = new Date();

  // 1. Helpers per type
  const getPeriodStart = {
    daily: startOfDay,
    weekly: (d) => startOfWeek(d, { weekStartsOn: 0 }), // Sunday start
    monthly: startOfMonth,
    yearly: startOfYear,
  };

  const subPeriod = {
    daily: () => subDays(now, 1),
    weekly: () => subWeeks(now, 1),
    monthly: () => subMonths(now, 1),
    yearly: () => subYears(now, 1),
  };

  // 2. Group data into periods
  const periodTotals = {};

  data.forEach((item) => {
    const date = parseISO(item.date);
    const start = getPeriodStart[type](date).toISOString();
    const value = parseFloat(item.value || "0");

    if (!periodTotals[start]) periodTotals[start] = 0;
    periodTotals[start] += value;
  });

  const periodEntries = Object.entries(periodTotals).sort(
    ([a], [b]) => new Date(a) - new Date(b)
  );
  const size = periodEntries.length;
  const totalSum = periodEntries.reduce((sum, [, v]) => sum + v, 0);
  const average = size > 0 ? totalSum / size : 0;

  // 3. Current and previous totals
  const currentKey = getPeriodStart[type](now).toISOString();
  const prevKey = getPeriodStart[type](subPeriod[type]()).toISOString();

  const currentTotal = periodTotals[currentKey] || 0;
  const previousTotal = periodTotals[prevKey] || 0;

  const percent =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0
      ? 100
      : 0;

  return {
    average: parseFloat(average.toFixed(2)),
    currentTotal: parseFloat(currentTotal.toFixed(2)),
    previousTotal: parseFloat(previousTotal.toFixed(2)),
    isHigher: currentTotal > previousTotal,
    percent: Math.round(percent),
    size,
  };
};

const getUserAnalytics = async (data = [], users = {}, type = "all") => {
  const now = new Date();
  const { correctionParams } = await useCacheUtils.get("userData");
  const cards = await useCacheUtils.get("financialAccounts");

  const matchPeriod = {
    all: () => true,
    daily: (d) => isSameDay(d, now),
    weekly: (d) => isSameWeek(d, now, { weekStartsOn: 0 }),
    monthly: (d) => isSameMonth(d, now),
    yearly: (d) => isSameYear(d, now),
  };

  const isInPeriod = matchPeriod[type] || matchPeriod["all"];
  const result = {};

  Object.keys(users).forEach((uid) => {
    const userData = data
      .filter((item) => {
        const itemDate = parseISO(item.date);
        return item.reportedBy === uid && isInPeriod(itemDate);
      })
      .sort((a, b) => compareDesc(parseISO(b.date), parseISO(a.date)));

    let savings = 0;
    let income = 0;
    let credit = 0;
    let installment = 0;
    let expenseTotal = 0;
    const categories = {};
    const correctionValues = correctionParams[uid]?.data;
    userData.forEach((item) => {
      const value = parseFloat(item.value || "0");
      const category = item.category || "Uncategorized";
      const entryType = item.type;
      let paymentMethod = item?.paymentMethod;

      const [selectedCard] = useFilterUtils.filterByKeyValue(
        cards,
        "id",
        paymentMethod
      );
      paymentMethod = selectedCard?.cardType ?? paymentMethod;

      switch (paymentMethod) {
        case "credit":
          credit += value;
          break;
        case "installment":
          installment += value;
          break;
        default:
          switch (entryType) {
            case "income":
              income += value;
              break;

            case "expenses":
              expenseTotal += value;
              categories[category] = (categories[category] || 0) + value;
              break;

            case "savings":
              savings += value;
              break;

            default:
              break;
          }
          break;
      }
    });
    result[uid] = {
      name: `${users[uid].fname || ""} ${users[uid].lname || ""}`.trim(),
      savings: +savings.toFixed(2) + (correctionValues?.savings ?? 0),
      income: +income.toFixed(2) + (correctionValues?.income ?? 0),
      credit: +credit.toFixed(2) + (correctionValues?.credit ?? 0),
      installment:
        +installment.toFixed(2) + (correctionValues?.installment ?? 0),
      expenses: {
        total: +expenseTotal.toFixed(2) + (correctionValues?.expenses ?? 0),
        categories,
      },
      raw: {
        savings: +savings.toFixed(2),
        income: +income.toFixed(2),
        credit: +credit.toFixed(2),
        installment: +installment.toFixed(2),
        expenses: {
          total: +expenseTotal.toFixed(2),
          categories,
        },
      },
    };
  });

  return result;
};

const getFilteredData = (data = []) => {
  const income = data.filter((item) => item.type === "income");
  const expenses = data.filter((item) => item.type === "expenses");
  const savings = data.filter((item) => item.type === "savings");

  return { all: data, income, expenses, savings };
};

export const useAnalyticsUtils = {
  getLast7DaysData,
  getLast12MonthsData,
  getCountryCounts,
  getAverage,
  getUserAnalytics,
  getFilteredData,
};
