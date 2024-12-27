import { budgetPlanData } from "../../model/budgetPlanData.js";
import { selectedCurrencyCode } from "./currencyConverter.js";

let budgetCurrencyCode = selectedCurrencyCode;
export async function launchGroceryPlanner(){
    
    const groceryPlan = budgetPlanData?.budgetPlanArray.find(item => item.type?.toLowerCase() === 'groceries');
    console.log(groceryPlan)
    budgetCurrencyCode = groceryPlan?.currency;
    const budgetMax = groceryPlan?.amount;
    console.log($('.budgetCurrency').length);  // This should log the number of matching elements

    $('#total-grocery-budget-val').html('test')
    
    console.log(groceryPlan);
}