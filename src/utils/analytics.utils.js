import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);


const getLast7DaysData = (data, dateSelector) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Initialize last 7 days with count 0
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    return { date, count: 0 };
  });

  // Count matches per day
  data.forEach((item) => {
    const itemDate = dateSelector(item);
    itemDate.setHours(0, 0, 0, 0);
    const match = days.find((d) => d.date.getTime() === itemDate.getTime());
    if (match) {
      match.count += 1;
    }
  });

  // Format result oldest first
  return days
    .reverse()
    .map((d) => ({ label: dayLabels[d.date.getDay()], value: d.count }));
}

const getLast12MonthsData = (data, dateSelector) => {
  const today = new Date();
  today.setDate(1); // Start of current month
  today.setHours(0, 0, 0, 0);

  const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Initialize last 12 months with count 0
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(today);
    date.setMonth(today.getMonth() - i);
    return { date, count: 0 };
  });

  data.forEach((item) => {
    const itemDate = dateSelector(item);
    itemDate.setDate(1);
    itemDate.setHours(0, 0, 0, 0);
    const match = months.find((m) => m.date.getTime() === itemDate.getTime());
    if (match) {
      match.count += 1;
    }
  });

  // Format result oldest first
  return months
    .reverse()
    .map((m) => ({
      label: `${monthLabels[m.date.getMonth()]}`,
      value: m.count
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


export const useAnalyticsUtils = { getLast7DaysData, getLast12MonthsData, getCountryCounts }