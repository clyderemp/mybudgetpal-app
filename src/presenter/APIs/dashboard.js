import { expensesData, loadExpenseData, totalExpenseTransactionsPerType, totalExpenseVal, totalExpenseValPerType } from "../../model/expensesData.js";
import { incomeData, loadIncomeData, totalIncomeVal } from "../../model/incomeData.js";
import { loadSavingsData, savingsAccountPerUser, savingsData, totalSavingsVal } from "../../model/savingsData.js";
import { allTransactions, totalMoneyTrafficVal } from "../../model/allTransactionsData.js";
import { formatToMoneyValue } from "./valueFormatter.js";
import { currencySymbol, currentExchangeRateVal } from "./currencyConverter.js";
import { capitalEachFirstLetter } from "./textFormatters.js";

$(function(){
    setTimeout(function() {
        console.log("Delayed execution");

        if (allTransactions !== null) {
            loadHomeDashboard();
        }
    }, 2000);  // Delay by 2 seconds
});

export const loadHomeDashboard = async () => {
    console.log('Loading home dashboard..');
    await loadExpenseData();
    await loadSavingsData();
    await loadIncomeData();
    await loadTopTiles();
    await loadTransactionTable();
    await loadTop10Expenses();
    await loadExpenditureChart();
    await loadSavingsAccount();
}

async function loadTopTiles(){
    $('#total-money-traffic-val').text(currencySymbol+' '+await formatToMoneyValue(totalMoneyTrafficVal * currentExchangeRateVal));
    $('#total-expenses-val').text(currencySymbol+' '+await formatToMoneyValue(totalExpenseVal * currentExchangeRateVal));
    $('#total-savings-val').text(currencySymbol+' '+await formatToMoneyValue(totalSavingsVal * currentExchangeRateVal));
    $('#total-income-val').text(currencySymbol+' '+await formatToMoneyValue(totalIncomeVal * currentExchangeRateVal));
}

async function loadTransactionTable(){

    allTransactions?.slice(0, 14).forEach(async (data) => {
        let reportedBy = data?.reportedBy?.replaceAll('Me - ','')?.split(' ');
            reportedBy = reportedBy[0]+' '+reportedBy[reportedBy.length-1][0]+'.';
        const date = data?.date;
        const category = data?.category;
        const type = data?.type?.split('(')[0];
        const amount = currencySymbol +' '+ await formatToMoneyValue(parseFloat(data?.value) * currentExchangeRateVal);
        const paidTo = data?.transaction;
        const html = `<tr>
                        <td>${date}</td>
                        <td>
                            <div class="badge badge-pill badge-${
                                category === 'expenses' ? 'danger' : category === 'savings' ? 'success' : 'warning'
                            }">${category}</div>
                        </td>
                        <td>${type}</td>
                        <td>${amount}</td>
                        <td>${paidTo?.length > 20 ? paidTo.slice(0,20)+'...' : paidTo}</td>
                        <td>${reportedBy}</td>
                    </tr>`

        $('#transaction-table').append(html);
    })
}

async function loadTop10Expenses(){
    totalExpenseValPerType?.forEach(async (expense) => {
        const expenseType = await capitalEachFirstLetter(expense.type?.split('(')[0]);
        const transactions = totalExpenseTransactionsPerType[expense.type];
        const html = `  <div class="d-flex align-items-center mt-0">
                              <div class="icon iq-icon-box rounded iq-bg-danger mr-3">
                                 <i class="ri-shopping-bag-line"></i>
                              </div>
                              <div class="iq-details col-sm-9 p-0">
                                 <div class="d-flex align-items-center justify-content-between">
                                    <span class="title text-dark">${expenseType}</span>
                                    <div class="percentage"><b><span>${currencySymbol}</span> ${await formatToMoneyValue(expense.value)} </b></div>
                                 </div>
                                 <div class="iq-progress-bar-linear d-inline-block w-100">
                                    <div class="iq-progress-bar">
                                       <span class="bg-danger" data-percent="67"></span>
                                    </div>
                                 </div>
                                 <div class="d-flex align-items-center justify-content-between">
                                    <span class="">${transactions} Transaction${transactions === 1 ? '' : 's' }</span>
                                    <div class="percentage">${(transactions / totalExpenseValPerType.length)}<span>%</span></div>
                                 </div>
                              </div>
                           </div>`;
        $('#topExpensesTable').append(html);
    });
}
async function loadExpenditureChart(){
    var donut = new Morris.Donut({
        element: 'expenditure-chart',
        resize: true,
        colors: ["#1e3d73", "#fe517e", "#99f6ca"],
        data: [
          {label: "Download Sales", value: 12},
          {label: "In-Store Sales", value: 30},
          {label: "Mail-Order Sales", value: 20}
        ],
        hideHover: 'auto'
    });
}
async function loadSavingsAccount(){
    for(const key in savingsAccountPerUser){
        const obj = savingsAccountPerUser[key];
        const name = await capitalEachFirstLetter(obj.name);
        const amount = currencySymbol +' '+await formatToMoneyValue(obj.amount * currentExchangeRateVal);
        const html = `      <li class="d-flex mb-4 align-items-center">
                                 <div class="user-img img-fluid"><img src="../../images/logo.png" alt="story-img" class="rounded avatar-40"></div>
                                 <div class="media-support-info ml-3">
                                    <h6>${name}</h6>
                                    <p class="mb-0 font-size-12">Last Report: ${obj.lastReport}</p>
                                 </div>
                                 <div class="iq-card-header-toolbar d-flex align-items-center">
                                    <span class="text-primary"><b>${amount}</b></span>
                                 </div>
                              </li>`;

        $('#savings-account-table').append(html);
    }
}