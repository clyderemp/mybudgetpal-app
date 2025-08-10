class FilterClass {
  filterOutArchived(array) {
    if (!Array.isArray(array)) return [];
    return array.filter((item) => item.archived !== true);
  }

  filterOutByKeyValue(array, key, value) {
    if (!Array.isArray(array)) return [];
    return array.filter((item) => item[key] !== value);
  }

  filterByKeyValue(array, key, value) {
    if (!Array.isArray(array)) return [];
    return array.filter((item) => item[key] === value);
  }
}

export const useFilterUtils = new FilterClass();
