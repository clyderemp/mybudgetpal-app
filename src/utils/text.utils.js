// text.utils.js

import { CURRENCIES } from "@/constants/currencies.constants";

class TextUtils {
  /**
   * Get initials from a name string
   * @param {string} name - The full name (e.g., "John Doe")
   * @returns {string} - The initials in uppercase (e.g., "JD")
   */
  getInitials(name = "") {
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0][0].toUpperCase();

    const firstInitial = parts[0][0];
    const lastInitial = parts[parts.length - 1][0];

    return (firstInitial + lastInitial).toUpperCase();
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

  getEnvironmentModeEmoji(mode = "development") {
    switch ((mode || "").toLowerCase()) {
      case "production":
        return "🚀"; // Rocket for production
      case "development":
        return "🛠️"; // Hammer & wrench for development
      case "testing":
        return "🧪"; // Test tube for testing
      default:
        return "❓"; // Question mark if unknown mode
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
  getMoneyText(amount, currency = "USD", type = "reg") {
    if (isNaN(amount)) return "";

    const symbol = CURRENCIES.symbols[currency] || currency;
    const num = Number(amount);

    if (type === "short") {
      if (num >= 1_000_000) {
        return `${symbol} ${(num / 1_000_000).toFixed(1)}M`;
      } else if (num >= 1_000) {
        return `${symbol} ${(num / 1_000).toFixed(1)}K`;
      } else {
        return `${symbol} ${num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
    } else {
      // regular format
      return `${symbol} ${num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }
}

// Export a single instance
export const useTextUtils = new TextUtils();
