export async function checkIfObjectContainsSearchInput(objectInput, searchInput) {
    // Convert searchInput to lowercase for case-insensitive comparison
    const searchLower = searchInput.toLowerCase();
  
    // Iterate over the object entries (key-value pairs)
    for (let [key, value] of Object.entries(objectInput)) {
      // Check if the value is a string and contains the searchInput (case-insensitive)
      if (typeof value === 'string' && value.toLowerCase().includes(searchLower)) {
        return true;  // Found the search input in the object value
      }
      // If value is an object, recursively search within the nested object
      if (typeof value === 'object' && value !== null) {
        const result = await checkIfObjectContainsSearchInput(value, searchInput);
        if (result) {
          return true;
        }
      }
    }
    // If no match is found
    return false;
  }
  