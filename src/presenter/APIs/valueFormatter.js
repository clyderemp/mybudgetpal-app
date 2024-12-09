export async function formatToMoneyValue(value) {
    // Convert the number to two decimal places, rounding as needed
    const roundedValue = value.toFixed(2); // Round the number to two decimal places

    // Format the number with commas every 3 digits
    const formattedValue = roundedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return formattedValue; // Add a dollar sign before the formatted number (optional)
}