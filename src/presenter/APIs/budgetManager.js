import { allTransactions } from "../../model/allTransactionsData.js";
import { budgetPlanData } from "../../model/budgetPlanData.js";
import { expenseIcons } from "../../model/expensesData.js";
import { currencySymbol, currencySymbols, selectedCurrencyCode } from "./currencyConverter.js";
import { launchLoadingModal } from "./sweetAlertModals.js";
import { capitalEachFirstLetter } from "./textFormatters.js";
import { formatToMoneyValue } from "./valueFormatter.js";

let budgetCurrencyCode = selectedCurrencyCode,
    budgetCurrencySymbol = null;
let budgetPlan = null,
    groceryPlan = null;
let expenseDataObj = {};
let totalBudget = 0, totalSpendings = 0, totalRemaining = 0;
$(function(){
    launchLoadingModal();
    setTimeout(async ()=>{
        try{
            if(allTransactions){
                await analyzeCurrentSpendings();
                budgetPlan = budgetPlanData?.budgetPlanArray;

                // Call the function to generate and insert the tiles into the DOM
                await generateBudgetTiles(budgetPlan);
                await analyzeSummary();
            } else {
            window.location.reload();
            }
        } catch (err){
            console.log(err);
            window.location.reload();
        }
    }, 2000);
});

// Assume budgetPlanArray is defined as shown above
function analyzeCurrentSpendings(){
    for(const key in allTransactions){
        const transaction = allTransactions[key];
        const category = transaction?.category;
        const type = transaction?.type;
        const amount = parseFloat(transaction?.value);
        let user = (transaction?.reportedBy).split(" ");
                user.pop(); // Remove the last name
                user = user.join(" "); // Join the remaining parts back together
        if(category !== 'income'){
            if(expenseDataObj[type] === undefined){
                expenseDataObj[type] = {
                    both: 0
                };
            }
            if(expenseDataObj[type][user] === undefined){
                expenseDataObj[type][user] = 0;
            }
            expenseDataObj[type][user] += amount;
            expenseDataObj[type]['both'] += amount;
            totalSpendings += amount;
        }
    }
}
// Function to generate HTML content for each tile
function generateBudgetTiles(budgetPlanArray) {
    // let tilesHTML = '';
  
    budgetPlanArray?.forEach(async(budget) => {
        const { amount, category, user, currency, type } = budget;
        totalBudget += amount;
        // Determine the color class for the icon and percentage
        const icon = expenseIcons[type] || `<i class="ri-bank-line"></i>`;
        const currentSpent = expenseDataObj[type] && expenseDataObj[type][user] ? expenseDataObj[type][user] : 0;
        budgetCurrencySymbol = budgetCurrencyCode === currency ? currencySymbols[budgetCurrencyCode] : currencySymbols[currency];

        let percent = (currentSpent / amount) * 100;
            percent = percent !== 100 ? percent.toFixed(1) : percent;
        
        const arrowClass = percent > 100 ? 'ri-arrow-up-fill' : percent === 100 ? 'ri-check-line':'ri-arrow-down-fill';
        const percentColor = percent === 100 ? 'primary' : percent > 100 ? 'danger' : 'success';
    //   const changeClass = percentageChange >= 0 ? 'text-success' : 'text-danger';
      
        const tilesHTML = `
            <div class="col-sm-6 col-md-6 col-lg-3">
            <div class="iq-card iq-card-block iq-card-stretch iq-card-height">
                <div class="iq-card-body iq-box-relative">
                    <div class="iq-box-absolute icon iq-icon-box rounded-circle iq-bg-${percentColor}">
                        ${icon}
                    </div>
                    <p class="text-secondary">${await capitalEachFirstLetter(type)} <small><b>${user !== 'both' ? ' - ('+user+')' : ''}</b></small></p>
                    <div class="d-flex align-items-center justify-content-between">
                        <h4><b>${await formatToMoneyValue(currentSpent)}</b><small class="text-secondary text-sm"><b id="total-${category.toLowerCase().replace(/\s+/g, '-')}-val"><br> &nbsp/ ${budgetCurrencySymbol} ${amount.toFixed(2)}</b></small><h4>
                        <small class="text-sm text-${percentColor} mt-4"><b> +${percent}% <i class="${arrowClass}"></i></b></small>
                    </div>
                </div>
            </div>
            </div>
        `;
        $('#budget-tiles-container').append(tilesHTML);
    });
  
    // Insert the generated HTML into a container (e.g., with the id 'budget-tiles-container')
    // document.getElementById('budget-tiles-container').innerHTML = tilesHTML;
}

async function analyzeSummary(){
    totalRemaining = totalBudget - totalSpendings;
    $('#total-budget-val').text(budgetCurrencySymbol+' '+await formatToMoneyValue(totalBudget));
    $('#total-spendings-val').text(budgetCurrencySymbol+' '+await formatToMoneyValue(totalSpendings));
    $('#total-remaining-val').text(`${budgetCurrencySymbol} ${await formatToMoneyValue(totalRemaining)}`);

    let userTotalSalaries = 0;
    budgetPlanData?.userSalary?.forEach(salary => {
        userTotalSalaries += parseFloat(salary.amount);
    });
    
    const budgetPercentVal = (totalBudget/ userTotalSalaries) * 100;
    const spendingsPercentVal = ((totalSpendings) / totalBudget) * 100;
    const remainingPercentVal = (totalRemaining / totalBudget) * 100;
    
    $('#budget-percent').html(`<b> ${budgetPercentVal.toFixed(1)}% of net income</b>`);
    $('#spendings-percent').html(`<b> ${spendingsPercentVal.toFixed(1)}% of total budget</b>`);
    $('#remaining-percent').html(`<span class="text-${remainingPercentVal < 0 ? 'danger' : 'success'}"><b> ${remainingPercentVal.toFixed(1)}% ${remainingPercentVal < 0 ? 'over' : 'under'} budget<i class="ri-arrow-${remainingPercentVal < 0 ? 'up' : 'down'}-fill"></i></b></span>`);

}