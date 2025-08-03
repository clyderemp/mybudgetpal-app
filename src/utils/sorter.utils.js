/**
 * Sorts an array of objects by a specified key and order.
 *
 * @param {Array} data - The array to sort.
 * @param {string} key - The key in the object to sort by.
 * @param {"ascending" | "descending"} order - The sort order.
 * @returns {Array} - The sorted array.
 */
const sortByKey = (data = [], key, order = "ascending") => {
  if (!Array.isArray(data) || !key) return data;

  const isAscending = order === "ascending";

  return [...data].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];

    if (typeof aValue === "number" && typeof bValue === "number") {
      return isAscending ? aValue - bValue : bValue - aValue;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return isAscending
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return 0; // if incomparable types
  });
};

export const useSorterUtils = { sortByKey };
