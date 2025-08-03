// form.utils.js

class FormUtils {
  /**
   * Generic state updater for form inputs or any object state
   * @param {string} key - The key in the state object to update
   * @param {*} value - The new value to set
   * @param {function} setHandler - The state setter function (e.g., setState)
   */
  updateData(key, value, setHandler) {
    setHandler((prevState) => ({
      ...prevState,
      [key]: value,
    }));
  }

  /**
   * Reset form data to initial state
   * @param {object} initialData - The initial form data
   * @param {function} setHandler - The state setter function (e.g., setState)
   */
  resetForm(initialData, setHandler) {
    setHandler(initialData);
  }

  /**
   * Check if all form fields are filled (non-empty)
   * @param {object} formData - The form data object
   * @returns {boolean} - True if all fields are filled
   */
  isFormComplete(formData) {
    return Object.values(formData).every(
      (value) => value !== null && value !== undefined && String(value).trim() !== ""
    );
  }
}

// Export a single instance
export const useFormUtils = new FormUtils();
