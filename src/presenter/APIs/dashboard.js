import { expenseBalanceTracker, expenseIcons, expensesData, loadExpenseData, totalExpenseTransactionsPerType, totalExpenseVal, totalExpenseValPerType, weekExpenseType, weekFixedExpenses, weeklyExpenses, weekVariableExpenses } from "../../model/expensesData.js";
import { incomeBalanceTracker, incomeData, loadIncomeData, totalIncomeVal } from "../../model/incomeData.js";
import { loadSavingsData, savingsAccountPerUser, savingsData, totalSavingsVal } from "../../model/savingsData.js";
import { allTransactions, reportPercentage, totalMoneyTrafficVal } from "../../model/allTransactionsData.js";
import { formatToMoneyValue } from "./valueFormatter.js";
import { currencySymbol, currentExchangeRateVal, selectedCurrencyCode } from "./currencyConverter.js";
import { capitalEachFirstLetter } from "./textFormatters.js";
import { days_of_the_week } from "./dateFormatters.js";
import { launchInvoiceForm } from "./invoiceForm.js";
import { launchInvoiceTable } from "./invoiceTable.js";
import { downloadPDFFile } from "./pdfDownloader.js";


$(function(){
    $('#invoiceForm').load('../../components/modals/invoiceForm.html');
    $('#invoiceTableModal').load('../../components/modals/invoiceTable.html');
    setTimeout(function() {
        console.log("Delayed execution");

        if (allTransactions !== null) {
            loadHomeDashboard();
            $('#invoiceForm-currency').text(selectedCurrencyCode +' '+currencySymbol);
        }
    }, 2000);  // Delay by 2 seconds
});

export const loadHomeDashboard = async () => {
    console.log('Loading home dashboard..');
    await loadExpenseData();
    await loadSavingsData();
    await loadIncomeData();
    await loadTopTiles();
    await loadWeeklySpendingTracker();
    await loadTransactionTable();
    await loadTopExpenses();
    await loadExpenditureChart();
    // await loadSavingsAccount();
    // await loadSplitMarginCharts();
}

async function loadTopTiles(){
    $('#total-money-traffic-val').text(currencySymbol+' '+await formatToMoneyValue(totalMoneyTrafficVal * currentExchangeRateVal));
    $('#total-expenses-val').text(currencySymbol+' '+await formatToMoneyValue(totalExpenseVal * currentExchangeRateVal));
    $('#total-savings-val').text(currencySymbol+' '+await formatToMoneyValue(totalSavingsVal * currentExchangeRateVal));
    $('#total-income-val').text(currencySymbol+' '+await formatToMoneyValue(totalIncomeVal * currentExchangeRateVal));
}
async function loadWeeklySpendingTracker(){
    var options = {
        series: [{
        name: 'Variable Expenses (Wants)',
        data: weekVariableExpenses
      }, {
        name: 'Fixed Expenses (Needs)',
        data: weekFixedExpenses
      }],
        chart: {
        type: 'bar',
        height: 350,
        stacked: true
      },
      colors: ["#1e3d73", "#fe517e"],

      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '15%',
          endingShape: 'rounded'
        },
      },
      legend: {
       show: false
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['transparent']
      },
      xaxis: {
        categories: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      },
      yaxis: {
        title: {
          text: ''
        }
      },
      fill: {
        opacity: 1
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return "$ " + val
          }
        }
      }
      };

      var chart = new ApexCharts(document.querySelector("#weekly-spending-chart"), options);
      chart.render();

      const highestValue = Math.max(...weeklyExpenses);
      const amount = currencySymbol +' '+ await formatToMoneyValue(Math.max(...weeklyExpenses) * currentExchangeRateVal);
      const highestIndex = weeklyExpenses.indexOf(highestValue);
      const peakDay = days_of_the_week[highestIndex]+'s';
      $('#weekly-chart-customMessage').text(highestValue > 0 ? 'Woah! Slown down.' : 'Not enough data! :(');
      $('#weekly-chart-peakday').append(highestValue > 0 ? `You spend the most on `+peakDay : 'Make sure to report your invoices!');
      $('#weekly-chart-highest-val').text(amount);
      $('#fixed-percent').text(weekExpenseType.fixed);
      $('#variable-percent').text(weekExpenseType.variable);
}
async function loadTransactionTable(){
    allTransactions.slice(0, 18).forEach(async (data) => {
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
    });

    $('#transaction-table-viewAll').click(async function(event){
        event.preventDefault();
        await launchInvoiceTable();
    });

    $('#download-invoiceTable').click(async function(event){
        event.preventDefault();
        console.log('here')
        await downloadPDFFile('invoiceTableTile', 'invoice');

    })
}
async function loadTopExpenses(){
    if(totalExpenseValPerType?.length <= 0){
        $('#topExpensesTable').text('No Sufficient Data');
    } else {
        totalExpenseValPerType?.forEach(async (expense) => {
            const expenseType = await capitalEachFirstLetter(expense.type);
            const transactions = totalExpenseTransactionsPerType[expense.type];
            const html = `  <div class="d-flex align-items-center mt-0">
                                  <div class="icon iq-icon-box rounded iq-bg-danger mr-3">
                                     ${expenseIcons[expenseType]}
                                  </div>
                                  <div class="iq-details col-sm-9 p-0">
                                     <div class="d-flex align-items-center justify-content-between">
                                        <span class="title text-dark">${expenseType?.split('(')[0]}</span>
                                        <div class="percentage"><b><span>${currencySymbol}</span> ${await formatToMoneyValue(expense.value * currentExchangeRateVal)} </b></div>
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
                               </div><hr class="mt-4 mb-4">`;
            $('#topExpensesTable').append(html);
        });

    }
}
async function loadExpenditureChart(){
    if(reportPercentage?.total > 0){
        const incomeSplitPercentage = parseInt((reportPercentage?.income / reportPercentage?.total) * 100);
        const expenseSplitPercentage = parseInt((reportPercentage?.expenses / reportPercentage?.total) * 100);
        const savingsSplitPercentage = parseInt((reportPercentage?.savings / reportPercentage?.total) * 100);
        var donut = new Morris.Donut({
            element: 'expenditure-chart',
            resize: true,
            colors: ["#1e3d73", "#fe517e", "#99f6ca"],
            data: [
            {label: "Income", value: incomeSplitPercentage},
            {label: "Expenses", value: expenseSplitPercentage},
            {label: "Savings", value: savingsSplitPercentage}
            ],
            hideHover: 'auto'
        });
    }
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
async function loadSplitMarginCharts(){
    /**
     * INCOME to EXPENSE SPLIT
     */
    let categoriesIncToExp = [];
    let expenseDailyArray = [];
    let incomeDailyArray = [];
    for(const date in incomeBalanceTracker){
        console.log(date)
        categoriesIncToExp.push(date);
        const obj1 = incomeBalanceTracker[date];
        incomeDailyArray.push(parseInt(obj1));
        const obj2 = expenseBalanceTracker[date] || 0;
        expenseDailyArray.push(parseInt(obj2));
    }

    console.log(categoriesIncToExp, incomeBalanceTracker, expenseDailyArray)
    var options = {
        series: [{
        name: 'Income',
        data: incomeDailyArray
      }, {
        name: 'Expenses',
        data: expenseDailyArray
      }],
      colors: ["#1e3d73", "#99f6ca"],
        chart: {
        height: 100,
        type: 'area',
        sparkline: {
              enabled: true,
          }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'smooth'
      },
      xaxis: {
        type: 'datetime',
        categories: categoriesIncToExp
      },
      tooltip: {
        x: {
          format: 'dd/MM/yy HH:mm'
        },
      },
      };

      var chart = new ApexCharts(document.querySelector("#income-expense-chart"), options);
      chart.render();

    /**
     * INCOME to SAVINGS SPLIT
     */
    var options = {
        series: [{
        name: 'series1',
        data: [31, 40, 28, 51, 42, 109, 100]
      }, {
        name: 'series2',
        data: [11, 32, 45, 32, 34, 52, 41]
      }],
      colors: ["#1e3d73", "#99f6ca"],
        chart: {
        height: 100,
        type: 'area',
        sparkline: {
              enabled: true,
          }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'smooth'
      },
      xaxis: {
        type: 'datetime',
        categories: ["2018-09-19T00:00:00.000Z", "2018-09-19T01:30:00.000Z", "2018-09-19T02:30:00.000Z", "2018-09-19T03:30:00.000Z", "2018-09-19T04:30:00.000Z", "2018-09-19T05:30:00.000Z", "2018-09-19T06:30:00.000Z"]
      },
      tooltip: {
        x: {
          format: 'dd/MM/yy HH:mm'
        },
      },
      };

      var chart = new ApexCharts(document.querySelector("#income-savings-chart"), options);
      chart.render();
}

$('#invoiceFormButton').click(async function(){await launchInvoiceForm()})