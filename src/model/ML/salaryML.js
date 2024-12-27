
// Function to predict the next salary date based on past income transaction dates
export async function predictNextSalaryDate(transactions) {
    // Extract the salary dates (filtering by 'income' category and 'job paycheque' type)
    let salaryDates = transactions
        .filter(transaction => transaction.category?.toLowerCase() === 'income' && transaction.type?.toLowerCase() === 'job paycheque')
        .map(transaction => new Date(transaction.date));

    // Sort the dates in ascending order
    salaryDates.sort((a, b) => a - b);

    // Calculate the interval (in milliseconds) between consecutive salary dates
    let intervals = [];
    for (let i = 1; i < salaryDates.length; i++) {
        intervals.push(salaryDates[i] - salaryDates[i - 1]);
    }
    // Find the most common interval (this could be monthly or weekly, etc.)
    const mostCommonInterval = await findMostCommonInterval(intervals);

    // Predict the next salary date by adding the most common interval to the last known salary date
    const lastSalaryDate = salaryDates[salaryDates.length - 1];
    const nextSalaryDate = new Date(lastSalaryDate.getTime() + mostCommonInterval);
    return nextSalaryDate;
}

// Helper function to find the most common interval (in milliseconds)
export async function findMostCommonInterval(intervals) {
    const frequencyMap = new Map();
    let maxFreq = 0;
    let mostCommonInterval = 0;

    await intervals.forEach(interval => {
        frequencyMap.set(interval, (frequencyMap.get(interval) || 0) + 1);
    });

    await frequencyMap.forEach((freq, interval) => {
        // if (freq > maxFreq) {
            maxFreq = freq;
            mostCommonInterval = interval;
        // }
    });

    return mostCommonInterval;
}