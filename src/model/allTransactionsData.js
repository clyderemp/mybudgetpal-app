import { fetchAllTransactions } from "../presenter/services/fetchAllTransactions.js";
import { expensesData } from "./expensesData.js";
import { incomeData } from "./incomeData.js";
import { savingsData } from "./savingsData.js";
export let allTransactions = {};
export let totalMoneyTrafficVal = 0;

export const allTransactionsData = async () => {
    allTransactions = await fetchAllTransactions();

    for(const key in allTransactions){
        const obj = allTransactions[key];
        const category = obj?.category?.toLowerCase();
        const value = parseFloat(obj?.value) || 0;
        totalMoneyTrafficVal += value;
        switch(category){
            case 'expenses':
                expensesData[key] = obj;
                break;
            case 'income':
                incomeData[key] = obj;
                break;
            case 'savings':
                savingsData[key] = obj;
                break;
            default:
                break;
        }
    }
}