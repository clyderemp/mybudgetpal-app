// search.utils.js
import { useMemo, useState } from "react";

class SearchUtils {
  constructor(sourceData = []) {
    this.sourceData = sourceData;
  }

  setSourceData(data) {
    this.sourceData = data;
  }

  search(query) {
    if (!query) return this.sourceData;

    const lowerQuery = query.toLowerCase();

    return this.sourceData.filter((item) =>
      Object.values(item).some((field) =>
        field?.value?.toString().toLowerCase().includes(lowerQuery)
      )
    );
  }
}

export const useSearchUtils = (initialData = []) => {
  const [data, setData] = useState(initialData);

  const searchInstance = useMemo(() => {
    const instance = new SearchUtils(data);
    return {
      search: (query) => instance.search(query),
      setSourceData: (newData) => {
        instance.setSourceData(newData);
        setData(newData);
      },
    };
  }, [data]);

  return searchInstance;
};
