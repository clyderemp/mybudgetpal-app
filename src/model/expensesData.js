export let expensesData = {};
export let totalExpenseVal = 0;
export let totalExpenseValPerType = {};
export let totalExpenseTransactionsPerType = {};

export async function loadExpenseData(){
    for(const key in expensesData){
        const obj = expensesData[key];
        const value = parseFloat(obj?.value) || 0;
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

    await analyzeTop10Expenses();
}

async function analyzeTop10Expenses(){
    // Convert the object to an array of objects
    const expenseArray = Object.entries(totalExpenseValPerType).map(([type, value]) => ({
        type: type,
        value: value
    }));

    // Sort the array by the 'value' property in descending order (highest first)
    const top10Expenses = expenseArray
        .sort((a, b) => b.value - a.value)  // Sorting in descending order by 'value'
        .slice(0, 10);  // Get the top 10 items

    // Log the top 10 highest values
    totalExpenseValPerType = (top10Expenses);
}