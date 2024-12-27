import { budgetPlanData } from "../../model/budgetPlanData.js";
import { selectedCurrencyCode } from "./currencyConverter.js";

let budgetCurrencyCode = selectedCurrencyCode;
export function launchGroceryPlanner(groceryPlan){

    console.log(groceryPlan)
    budgetCurrencyCode = groceryPlan?.currency;
    const budgetMax = groceryPlan?.amount;
    console.log($('.budgetCurrency').length);  // This should log the number of matching elements

    const text = $('#total-grocery-budget-val').text()
    
    console.log(text);
}