import { convertFormattedDateBack, convertToFormattedDate } from "../presenter/APIs/dateFormatters.js";

export let expensesData = {};
export let totalExpenseVal = 0;
export let totalExpenseValPerType = {};
export let totalExpenseTransactionsPerType = {};
export let expenseBalanceTracker = {};
export let weekExpenseType = {};
export let weekFixedExpenses = [0, 0, 0, 0, 0, 0, 0];  // index 0 = Sunday, index 1 = Monday, ..., index 6 = Saturday
export let weekVariableExpenses = [0, 0, 0, 0, 0, 0, 0];  // index 0 = Sunday, index 1 = Monday, ..., index 6 = Saturday
export let weeklyExpenses = [0, 0, 0, 0, 0, 0, 0];  // index 0 = Sunday, index 1 = Monday, ..., index 6 = Saturday
export const expense_types = [
    //FIXED EXPENSES
    "Car Payments",
    "Credit Payments",
    "Insurance",
    "Internet Bill",
    "Loan Payments",
    "Memberships",
    "Phone Bill",
    "Rent",
    "Subscriptions",
    "Taxes",
    "Tuition",
    "Utilities",
    //VARIABLE EXPENSES
    "Appliances",
    "Car Maintenance",
    "Charge Fees",
    "Clothings",
    "Commute",
    "Dining Out",
    "Entertainment",
    "E-Purchases",
    "Gas",
    "Groceries",
    "Home Maintenance",
    "Investments",
    "Medical Care",
    "Others (Personal Spendings)",
    "Parking",
    "Recreation",
    "Taxes",
    "Travels",
    "Personal Care"
];

export const expenseIcons = {
    "Car Payments": "<i class='ri-car-line'></i>",
    "Credit Payments": "<i class='ri-credit-card-line'></i>",
    "Insurance": "<i class='ri-shield-check-line'></i>",
    "Internet Bill": "<i class='ri-router-line'></i>",
    "Loan Payments": "<i class='ri-money-dollar-circle-line'></i>",
    "Memberships": "<i class='ri-vip-crown-line'></i>",
    "Phone Bill": "<i class='ri-phone-line'></i>",
    "Rent": "<i class='ri-home-line'></i>",
    "Subscriptions": "<i class='ri-subscribe-line'></i>",
    "Taxes": "<i class='ri-tax-line'></i>",
    "Tuition": "<i class='ri-book-line'></i>",
    "Utilities": "<i class='ri-plug-line'></i>",
    // VARIABLE EXPENSES
    "Appliances": "<i class='ri-blender-line'></i>",
    "Car Maintenance": "<i class='ri-car-wash-line'></i>",
    "Charge Fees": "<i class='ri-plug-line'></i>",
    "Clothings": "<i class='ri-t-shirt-line'></i>",
    "Commute": "<i class='ri-train-line'></i>",
    "Dining Out": "<i class='ri-restaurant-line'></i>",
    "Dining Out - Food": "<i class='ri-restaurant-line'></i>",
    "Dining Out - Drinks": "<i class='ri-restaurant-line'></i>",
    "Entertainment": "<i class='ri-movie-line'></i>",
    "E-purchases": "<i class='ri-macbook-line'></i>",
    "Gas": "<i class='ri-gas-station-line'></i>",
    "Groceries": "<i class='ri-shopping-cart-line'></i>",
    "Home Maintenance": "<i class='ri-home-gear-line'></i>",
    "Investments": "<i class='ri-line-chart-line'></i>",
    "Medical Care": "<i class='ri-heart-line'></i>",
    "Others (personal Spendings)": "<i class='ri-user-line'></i>",
    "Parking": "<i class='ri-parking-line'></i>",
    "Recreation": "<i class='ri-sports-line'></i>",
    "Travels": "<i class='ri-plane-line'></i>",
    "Personal Care": "<i class='ri-body-scan-line'></i>"
};

export async function loadExpenseData(){
    console.log(expensesData);
    for(const key in expensesData){
        const obj = expensesData[key];
        const month = obj.date?.split('-')[1];
        const value = parseFloat(obj?.value) || 0;

        console.log(obj.reportedBy, obj.type, value)
        if(expenseBalanceTracker[month] === undefined){
            expenseBalanceTracker[month] = 0;
        }
        expenseBalanceTracker[month] += value;
        totalExpenseVal += value;

        const type = obj?.type?.toLowerCase();
        if(totalExpenseValPerType[type] === undefined){
            totalExpenseValPerType[type] = 0
        }
        if(totalExpenseTransactionsPerType[type] === undefined){
            totalExpenseTransactionsPerType[type] = 0
        }
        totalExpenseValPerType[type] += value;
        totalExpenseTransactionsPerType[type] ++;
    }

    await analyzeTopExpenses();
    await analyzeSelectedWeekExpense();
}

async function analyzeTopExpenses(){
    // Convert the object to an array of objects
    const expenseArray = Object.entries(totalExpenseValPerType).map(([type, value]) => ({
        type: type,
        value: value
    }));
    // Sort the array by the 'value' property in descending order (highest first)
    const topExpenses = expenseArray
        .sort((a, b) => b.value - a.value)  // Sorting in descending order by 'value'
        .slice(0, 8);  // Get the top 10 items

    // Log the top 10 highest values
    totalExpenseValPerType = (topExpenses);
}

async function analyzeSelectedWeekExpense() {
    // Define the range of fixed expense types (indices 0 to 11)
    const fixedExpenseTypes = expense_types.slice(0, 12);  // Fixed expenses are from index 0 to 11 in `expense_types`
    let totalFixed = 0, totalVariable = 0;

    // Iterate over the expensesData
    await Object.values(expensesData).forEach(async (data) => {
        // Assuming data.date is in YYYY-MM-DD format
        const expenseDate = await convertFormattedDateBack(data?.date);
        
        // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const dayOfWeek = expenseDate.getDay();

        // Add the expense to the corresponding day index in the weekExpenses array
        const type = data?.type;
        const amount = parseInt(data.value) || 0;
        weeklyExpenses[dayOfWeek] += amount;
        if (fixedExpenseTypes.includes(type)) {
            weekFixedExpenses[dayOfWeek] += amount;
            totalFixed++;
        } else {
            weekVariableExpenses[dayOfWeek] += amount;
            totalVariable++;
        }
    });
    const expensesDataLength = Object.values(expensesData).length;
    weekExpenseType = {
        fixed: expensesDataLength > 0 ? ((totalFixed / expensesDataLength).toFixed(2) * 100).toPrecision(3) +' %' : '0%',
        variable: expensesDataLength > 0 ? ((totalVariable / expensesDataLength).toFixed(2) * 100).toPrecision(3) +' %' : '0%',
    }
}