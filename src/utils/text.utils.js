// text.utils.js

class TextUtils {
  /**
   * Get initials from a name string
   * @param {string} name - The full name (e.g., "John Doe")
   * @returns {string} - The initials in uppercase (e.g., "JD")
   */
  getInitials(name = "") {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  /**
   * Capitalize the first letter of a string
   * @param {string} text - The input text
   * @returns {string} - Capitalized text
   */
  capitalize(text = "") {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Truncate text with ellipsis if it exceeds max length
   * @param {string} text - The text to truncate
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} - Truncated text with ellipsis
   */
  truncate(text = "", maxLength = 50) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  }

  /**
   * Check if string is empty or only whitespace
   * @param {string} text
   * @returns {boolean}
   */
  isEmpty(text = "") {
    return !text.trim();
  }

  getEnvironmentModeEmoji(mode = 'development') {
    switch ((mode || "").toLowerCase()) {
      case "production":
        return "🚀";   // Rocket for production
      case "development":
        return "🛠️";   // Hammer & wrench for development
      case "testing":
        return "🧪";   // Test tube for testing
      default:
        return "❓";   // Question mark if unknown mode
    }
  }

  getFlagEmoji(countryCode = "") {
    if (!countryCode || countryCode.length !== 2) return "🌍";
      return countryCode
        .toUpperCase()
        .split("")
        .map((char) => String.fromCodePoint(127397 + char.charCodeAt()))
        .join("");
    }
}

// Export a single instance
export const useTextUtils = new TextUtils();
