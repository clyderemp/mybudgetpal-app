import { db } from '../../..//js/firebase.js'
import { month_strings, month_strings_for_LINEGRAPH, days_of_the_week, currencyCodes, savings_types } from '../js/dataFile.js';
import { uid, userData, transaction_ID, coUserData } from '../js/main.js';
import { generateTransactionTable } from '../js/transactionManager.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; 
import { convert_CAD_to_SelectedCurrency } from './currencyExchange.js';

//GLOBAL USE
export const today_date = new Date();
export const current_Month = (new Date().getMonth()+1).toString(); //number index
export const currentYear = (new Date().getFullYear()).toString();
export const lastYear = (new Date().getFullYear()) - 1;
export const last_month_string = month_strings[parseInt(current_Month)-2];
export const current_month_string = month_strings[parseInt(current_Month)-1];


//PANELS
const monthly_expense_tile = $('#monthly-expense-value');
      monthly_expense_tile.text('0.00');
const monthly_income_tile = $('#monthly-income-value');
      monthly_income_tile.text('0.00');
const credit_balance_tile = $('#credit-balance-value');
      credit_balance_tile.text('0.00');
const spending_acc_tile = $('#spending-acc-value');
      spending_acc_tile.text('0.00');

//MONTHLY INFO ARRAY
export var monthly_expense_array = {};
export var monthly_income_array = {};
export var monthly_savings_array = {};
export var monthly_expense_array_LINEGRAPH = [0,0,0,0,0,0,0,0,0,0,0,0];

// FOR THE HIGHEST AND LOWEST INCOME
var total_expense_val = 0;

// FOR THE HIGHEST AND LOWEST EXPENSE
var max_expense = 0, min_expense = 999999;

//FOR PIE GRAPH
const categories = ["Expenses", "Savings Plan", "Credit Payments"];
var budget_percent = [0,0,0];

//FOR BAR GRAPH
var BARGRAPH_last_year_data = [0,0,0,0,0,0,0,0,0,0,0,0];
var BARGRAPH_this_year_data = [0,0,0,0,0,0,0,0,0,0,0,0];

var credit_balance = 0, credit_payment = 0;

var exchange_rate = null;
var currency = $('#currencyDropdown').val();

export async function updateAnalytics(transactionData){

    exchange_rate = JSON.parse(await localStorage.getItem('exchange_rate'));
    currency = exchange_rate?.code;
    exchange_rate = exchange_rate?.value;

    generateTransactionTable(transactionData);
    if(window.location.pathname == '/dashboard/user/home/index.html'){
        updateDashboardUI(transactionData);
    }
}

/**
 * MAINLY UPDATES DATA ON THE USER INTERFACE
 */
async function updateDashboardUI(transactionData){
    await updateAverageMonthlySpending(transactionData);
    await updateAverageMonthlyIncome(transactionData);
    await updateCreditBalance(transactionData);
    await updateSpendingAccount();
    await updateHighestAndLowestINCOME_Months(transactionData);
    await updateHighestAndLowestEXPENSES_Months(transactionData);
    await updateTotalSavingsPanel(transactionData);
    await updateTotalYearlySpendingPanel(transactionData);
    await updateGRAPHS(transactionData);
}

function updateGRAPHS(transactionData){
    updateMonthlyGraph(transactionData); //NEED TO BE HERE TO PUT VALUES INTO AN ARRAY
    updateBudgePIE(transactionData);
    updateYearlyComparisonBARGRAPH(transactionData);
    updateTransactionTable(transactionData);
}
/**
 * MONTHLY EXPENSE BASED ON CURRENT MONTH
 */
async function updateAverageMonthlySpending(transactionData){
    var total = 0, prev_total = 0;
    var lastMonthDate = new Date(today_date);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        lastMonthDate = lastMonthDate.toString().split(' ');
        lastMonthDate = lastMonthDate[1] + ' ' +lastMonthDate[3]; //Month Year
    if(transactionData.length > 0){
        for(var key in transactionData){
            var docData = transactionData[key];
            //ALL EXPENSES EXCEPT CREDIT PAYMENTS ARE CALCULATED
            if(!docData.type?.includes('Credit Payments')){
                    var doc_date = ((docData.date).toString()).replaceAll('-', '/');
                    var date_Split = doc_date.split('/');
                    var year = date_Split[0].toString(),
                        month = parseInt(date_Split[1]).toString();
                    var month_year_string = month_strings_for_LINEGRAPH[parseInt(month)-1] +' '+ year;
                    //CURRENT MONTH DATA
                    if(year.includes(currentYear) && month.includes(current_Month) && docData.category=='expenses'){
                        docData?.value && (total += parseFloat(docData?.value));
                        var monthly_expense_value = convertTo2_Decimals(total*exchange_rate);

                        //OUTPUT TO DASHBOARD
                        localStorage.setItem('monthly-expense-value', monthly_expense_value);
                        monthly_expense_tile.text(numberWithCommas(monthly_expense_value));
                    }

                    //LAST MONTHS DATA
                    if(docData.category=='expenses' && month_year_string == lastMonthDate){
                            prev_total += parseFloat(docData.value);
                            var prev_expense_value = convertTo2_Decimals(prev_total*exchange_rate)
                            localStorage.setItem('prev_expense_value', prev_expense_value);
                    }
                    // console.log(monthly_expense_value, prev_expense_value)
                    var current_expense_val = parseFloat(monthly_expense_value);
                    var prev_expense_value = parseFloat(prev_expense_value);
                    var difference = ((current_expense_val - prev_expense_value) / prev_expense_value)*100;
                        difference = convertTo2_Decimals(difference);
                    //CALCULATING THE DIFFERENCE PERCENT
                    if(isFinite(difference)){
                        switch(difference > 0){
                            case true:
                                $('#monthly-expense-percent').html('<span class="text-danger"><i class="text-danger fa-solid fa-caret-up"></i> '+difference+'%</span>');
                                break;
                            case false:
                                difference = difference.toString().replaceAll('-','');
                                $('#monthly-expense-percent').html('<span class="text-success"><i class="text-success fa-solid fa-caret-down"></i> '+difference+'%</span>');
                                break;
                            default:
                                $('#monthly-expense-percent').html('<span class="text-warning">No Data</span>');
                                break;

                        }
                    }
                    else{
                        difference = convertTo2_Decimals(0);
                        $('#monthly-expense-percent').html('<span class="text-danger"><i class="text-danger fa-solid fa-caret-down"></i> '+difference+'%</span>');
                    }
                    $('#monthly-expense-percent-after').html('since '+lastMonthDate+' <span style="font-size: 12px;">('+numberWithCommas(convertTo2_Decimals(prev_expense_value))+' '+currency+'</span>)');
            }
        }
    }
    else{
        $('#monthly-expense-value').text('0.00');
        $('#monthly-expense-percent-after').text('No Data Available');
    }
}
/**
 * MONTHLY INCOME (DIVIDED BY THE AMOUNT OF MONTHS PASSED IN A YEAR)
 */
async function updateAverageMonthlyIncome(transactionData){

    var total = 0, prev_total = 0;

    var lastMonthDate = new Date(today_date);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        lastMonthDate = lastMonthDate.toString().split(' ');
        lastMonthDate = lastMonthDate[1] + ' ' +lastMonthDate[3]; //Month Year

    if(transactionData.length > 0){
        for(var key in transactionData){
            var docData = transactionData[key]
                    var doc_date = ((docData.date).toString()).replaceAll('-', '/');
                    var date_Split = doc_date.split('/');
                    var year = date_Split[0].toString(),
                        month = parseInt(date_Split[1]).toString();
                    var month_year_string = month_strings_for_LINEGRAPH[parseInt(month)-1] +' '+ year;

                    if(year.includes(currentYear) && month.includes(current_Month) && docData.category == 'income'){
                        total += parseFloat(docData.value);
                        var monthly_income_value = convertTo2_Decimals(total*exchange_rate);

                        localStorage.setItem('monthly_income_value', monthly_income_value);
                        //OUTPUT TO DASHBOARD
                        monthly_income_tile.text(numberWithCommas(monthly_income_value));

                    }

                    //LAST MONTHS DATA
                    if(docData.category=='income' && month_year_string == lastMonthDate){

                        prev_total += parseFloat(docData.value);
                        var prev_income_value = convertTo2_Decimals(prev_total*exchange_rate)
                        localStorage.setItem('prev_income_value', prev_income_value);
                    
                    }
                    var current_income_val = convertTo2_Decimals(parseFloat(localStorage.getItem('monthly_income_value')));
                    var prev_income_value = convertTo2_Decimals(parseFloat(localStorage.getItem('prev_income_value')));

                    var difference = ((current_income_val - prev_income_value) / prev_income_value)*100;
                    if(isInfinite(difference))
                        difference = 0;

                    difference = convertTo2_Decimals(difference);
                    //CALCULATING THE DIFFERENCE PERCENT

                    switch(difference > 0){

                        case true:
                            $('#monthly-income-percent').html('<span class="text-success"><i class="text-success fa-solid fa-caret-up"></i> '+difference+'%</span>');
                            break;
                        case false:
                            difference = difference.toString().replaceAll('-','');
                            $('#monthly-income-percent').html('<span class="text-danger"><i class="text-danger fa-solid fa-caret-down"></i> '+difference+'%</span>');
                            break;
                        default:
                            $('#monthly-income-percent').html('<span class="text-warning">No Data</span>');
                            break;
                    }
                        
                    $('#monthly-income-percent-after').html('since '+lastMonthDate+' <span style="font-size: 12px;">('+numberWithCommas(convertTo2_Decimals(prev_income_value))+' '+currency+'</span>)');
        }
    }
    else{
        $('#monthly-income-value').text('0.00');
        $('#monthly-income-percent-after').text('No Data Available');
    }

}
/**
 * CREDIT BALANCE
 */
async function updateCreditBalance(transactionData){

    $('#credit-balance-value').text('$0.00');
    $('#credit-max-value').text('No Data Available ');
    $('#utilization-percent-value').text("");
    
    credit_balance = parseFloat(userData.credit_balance) * exchange_rate;
        if(!credit_balance.isFinite){
            credit_balance = 0;
        }
    var credit_max = parseFloat(userData.credit_max) * exchange_rate;
        if(!credit_max.isFinite){
            credit_max = 0;
        }
    localStorage.setItem(userData.fname+'-credit_limit', credit_max);
    
    for(var key in coUserData){
        var obj = coUserData[key];
        var fname = (obj.fname).split(' ');
            fname = fname[0];
        localStorage.setItem(fname+'-credit_limit', obj.credit_limit);
        credit_max += parseInt(obj.credit_limit);
        localStorage.setItem('All-credit_limit', credit_max);
    }

    //CHECKING IF ITS NOT NULL
    if(isFinite(credit_max) && isFinite(credit_balance) && transaction_ID.length == 0){
        
        if(!isFinite(credit_balance/credit_max)){
            var value = 0;
        }else{
            var value  = credit_balance/credit_max;
        }

        credit_balance_tile.text(convertTo2_Decimals(credit_balance));
        $('#utilization-percent-value').text('('+convertTo2_Decimals((value)*100)+'% Utilization)');
        $('#credit-max-value').text('Credit Limit: $'+numberWithCommas(convertTo2_Decimals(credit_max)));
        checkUtilization((credit_balance/credit_max)*100);
    }

    //GET DATA FOR CREDIT
    for(var key in transactionData){
        var docData = transactionData[key];
            if(isInfinite(docData.value)){
                docData.value = 0;
            }
            
        try{
            
            if(docData.paymentMethod == 'credit'){
                credit_balance += parseFloat(docData.value);
            }
            if(docData.type.includes('Credit Payments')){
                credit_balance -= parseFloat(docData.value); //Remove from balance
                var transaction_date = (docData.date).split('-');
                    transaction_date = month_strings[parseInt(transaction_date[1])-1] + ' ' +transaction_date[0];
                if(transaction_date == (current_month_string+' '+currentYear)){
                    credit_payment += parseFloat(docData.value); //Add to total credits paid
                    localStorage.setItem('credit_payment', credit_payment);
                }
            }
            //credit_balance -= credit_payment;
            credit_balance_tile.text(convertTo2_Decimals(credit_balance));
            $('#credit-max-value').text('(Max: $'+credit_max+')');

            if(isFinite((credit_balance/credit_max)*100)){
                var percent_util = credit_balance/credit_max;
            }
            else{
                var percent_util = 0;
            }

            $('#utilization-percent-value').text(convertTo2_Decimals((percent_util)*100)+'% Utilization');

            checkUtilization((credit_balance/credit_max)*100);
            
        }catch(err){
            console.log(err);
        }
            
    }

    function checkUtilization(Utilization){
        if(Utilization > 30 && Utilization < 59){
            $('#utilization-percent-value').addClass('text-warning');
        }else if(Utilization > 60){
            $('#utilization-percent-value').addClass('text-danger');
        }else{
            $('#utilization-percent-value').addClass('text-success');
        }
    }
}
/**
 * UPDATE SPENDING ACCOUNT
 */
async function updateSpendingAccount(){
    
    var income = parseFloat(localStorage.getItem('monthly_income_value'));
    if(isInfinite(income)){
        income = 0;
    }

    var expenseBudget = parseFloat(userData.expenseBudget),
        savingsBudget = parseFloat(userData.savingsBudget),
        creditPaymentBudget = parseFloat(userData.creditPaymentBudget);
    
    var monthly_expense = parseFloat((($('#monthly-expense-value').html()).replaceAll('$','')).replaceAll(',',''));
    var monthly_savings = parseFloat((($('#total-savings-value').html()).replaceAll('$','')).replaceAll(',',''));
    var monthly_credit = credit_payment;

    var remaining_expense = (income*(expenseBudget/100)) - monthly_expense,
    remaining_savings = (income*(savingsBudget/100)) - monthly_savings,
    remaining_creditPayment = (income*(creditPaymentBudget/100)) - monthly_credit;

    //Credit should not be added to spending account

    var spending_balance = remaining_expense + remaining_savings;
    if(isFinite(spending_balance)){
        spending_acc_tile.text(numberWithCommas(convertTo2_Decimals(spending_balance)));
        var percent = (spending_balance/income)*100;

        if(percent >= 70){
            $('#spending-acc-text').addClass('text-success');
        } else if(percent < 70 && percent > 40){
            $('#spending-acc-text').addClass('text-warning');
        } else{
            percent = 0;
            $('#spending-acc-text').addClass('text-danger');
        }
        $('#spending-acc-text').text(convertTo2_Decimals(percent)+'%');
        $('#spending-acc-text-after').text('of your income is left');
    }
    else{
        spending_acc_tile.text('0.00');
        $('#spending-acc-text').text('');
        $('#spending-acc-text-after').text('No Data Available');
    }
}
/**
 * HIGHEST AND LOWEST INCOME
 */
function updateHighestAndLowestINCOME_Months(transactionData){
    var max_date, min_date;
   $('#highest-income-value').text('$0.00');
   $('#lowest-income-value').text('$0.00');
   $('#highest-income-text').text('No Data Available');
   $('#lowest-income-text').text('No Data Available');
    
    for(var key in transactionData){
        var docData = transactionData[key];
        if( (docData.category) == 'income' ){

            var date_split = (docData.date).split('-');
            var month_index = parseInt(date_split[1])-1;
            var month = (month_strings[month_index]).toString();
            var year = (date_split[0]).toString();
            var index = year+'_'+month;
            
            initializeYearMonth(index);
            function initializeYearMonth(index){
                if(monthly_income_array[index] == undefined){
                    monthly_income_array[index] = {
                        value: 0.0,
                        name: index
                    }
                }
            }

            monthly_income_array[index].value += parseFloat(docData.value);
            localStorage.setItem('monthly_income_array', JSON.stringify(monthly_income_array));
        }
                    
    }
    let arr = monthly_income_array;
    var min = 9999999,
        max = 0,
        average = 0, total_value = 0,
        total_months = 0;

    for(var key in arr){
        total_months++;
        var obj = arr[key];
        var value = obj.value;
        total_value += value;
        average = total_value / total_months;

        if(value < min){
            min = value;
            min_date = obj.name.split('_');
        }
        else if( value >= max){
            max = value;
            max_date = (obj.name).split('_');
        }
    }

    $('#highest-income-value').text(numberWithCommas(convertTo2_Decimals(max*exchange_rate)));
    $('#lowest-income-value').text(numberWithCommas(convertTo2_Decimals(min*exchange_rate)));

    for(var i=0; i<month_strings.length; i++){
        if(month_strings[i].includes(min_date[1])){
            min_date[1] = month_strings[i];
        }
        if(month_strings[i].includes(max_date[1])){
            max_date[1] = month_strings[i];
        }
    }
    //OUTPUT ON DASHBOARD
    var max_percent = parseInt(((max - average) / average)*100);
    var min_percent = parseInt(((min - average) / average)*-100);
    $('#highest-income-text').html('<a style="font-weight: bold;">'+max_date[1] +' '+max_date[0] +'</a><br><a><i class="text-success fa-solid fa-caret-up"></i> '+max_percent+'% above average</a>');
    $('#lowest-income-text').html('<a style="font-weight: bold;">'+min_date[1] +' '+min_date[0] +'</a><br><a><i class="text-danger fa-solid fa-caret-down"></i> '+min_percent+'% below average</a>');
}
/**
 * HIGHEST AND LOWEST EXPENSES
 */
function updateHighestAndLowestEXPENSES_Months(transactionData){

    var max_date, min_date,
        average = 0, total_value = 0,
        total_months = 0;

    $('#highest-expense-value').text('$0.00');
    $('#lowest-expense-value').text('$0.00');
    $('#highest-expense-text').text('No Data Available');
    $('#lowest-expense-text').text('No Data Available');

    
    for(var key in transactionData){
        var docData = transactionData[key];
        if( (docData.category) == 'expenses' && (docData.type != 'Credit Payments')){
            var date_split = (docData.date).split('-');
            var month_index = parseInt(date_split[1])-1;
            var month = (month_strings_for_LINEGRAPH[month_index]).toString();
            var year = (date_split[0]).toString();
            var index = year+'_'+month;
            initializeYearMonth(index);
            function initializeYearMonth(index){
            
                if(monthly_expense_array[index] == undefined){
                    monthly_expense_array[index] = {
                        value: 0.0,
                        name: index
                    }
                }
            }
            docData.value && (monthly_expense_array[index].value += (parseFloat(docData.value)*exchange_rate));

            if( (docData.date).includes(currentYear.toString())){
                docData.value && (monthly_expense_array_LINEGRAPH[month_index] += (parseFloat(docData.value)*exchange_rate))
            }
            
            localStorage.setItem('monthly_expense_array', JSON.stringify(monthly_expense_array));
            localStorage.setItem('monthly_expense_array_LINEGRAPH', JSON.stringify(monthly_expense_array_LINEGRAPH));
        }
    }

    let arr = monthly_expense_array;

    for(var key in arr){
        var expense_obj = arr[key];
        total_months++;
        var value = expense_obj.value;
        total_value += value;

        if(value < min_expense){
            min_expense = value;
            min_date = expense_obj.name.split('_');
        }
        else if( value >= max_expense){
            max_expense = value;
            max_date = (expense_obj.name).split('_');
        }

        average = total_value / total_months
    }

    $('#highest-expense-value').text(numberWithCommas(convertTo2_Decimals(max_expense*exchange_rate)));
    $('#lowest-expense-value').text(numberWithCommas(convertTo2_Decimals(min_expense*exchange_rate)));

    for(var i=0; i<month_strings?.length; i++){
        if(month_strings[i]?.includes(min_date[1])){
            min_date[1] = month_strings[i];
        }
        if(month_strings[i]?.includes(max_date[1])){
            max_date[1] = month_strings[i];
        }
    }
    //OUTPUT ON DASHBOARD

    var max_percent = parseInt(((max_expense - average) / average)*100);
    var min_percent = parseInt(((min_expense - average) / average)*-100);
    $('#highest-expense-text').html('<a style="font-weight: bold;">'+max_date[1] +' '+max_date[0] +'</a><br><a><i class="text-danger fa-solid fa-caret-up"></i> '+max_percent+'% above average</a>');
    $('#lowest-expense-text').html('<a style="font-weight: bold;">'+min_date[1] +' '+min_date[0] +'</a><br><a><i class="text-success fa-solid fa-caret-down"></i> '+min_percent+'% below average</a>');

}
/**
 * FOR THE YEARLY TOTAL SAVINGS
 */
function updateTotalSavingsPanel(transactionData){

    $('#total-savings-value').text('$0.00');
    $('#total-savings-percent').text('0%');
    var savings_goal = userData.savings_goal;
            $('#savings-goal-value').text(numberWithCommas(convertTo2_Decimals(savings_goal*exchange_rate)));

    var current_month_index = parseInt((new Date()).getMonth());
    var total = 0;
    var monthly_total = 0;
    var savings_expense = 0;
    for(var key in transactionData){
        var docData = transactionData[key];

        if((docData.paymentMethod).includes('savings')){

            savings_expense += (docData.value);
        }
        if (docData.category == 'savings') {

            total += parseFloat(docData.value);
            
            var total_savings = (Math.round((total) * 100) / 100).toFixed(2);
            var savings_goal_value =  userData.savings_goal;
            

            if(savings_goal_value > 0){
                var percent = (Math.round(((total_savings/savings_goal_value)*100) * 100) / 100).toFixed(2);
                $('#total-savings-percent').text(percent+'%');
            }
            else{
                $('#total-savings-percent').text(total_savings+'%');
            }

            var date = (docData.date).split('-');
            if(parseInt(date[0]) == currentYear && parseInt(date[1]) == (current_month_index+1)){
                monthly_total += parseFloat(docData.value);
                localStorage.setItem('month-total-savings', monthly_total);
            }
            else{
                localStorage.setItem('month-total-savings', monthly_total);
            }
        }
    }


    $('#total-savings-value').text(numberWithCommas(convertTo2_Decimals((total_savings - savings_expense)*exchange_rate)));
    $('#savings-after-text').append('<br><a class="text-secondary" style="text-align: right;" href="../report/savings.html"><i class="fa-solid fa-print"></i> View Full Savings Report<a>')
}
/**
 * FOR THE YEARLY TOTAL EXPENSE
 */
function updateTotalYearlySpendingPanel(transactionData){

    $('#year-total-expense-year-text').text(currentYear);
    $('#total-expense-value').text('0.00');
    $('#yearly-trend').text('0.00');

    for (var key in transactionData){
        var docData = transactionData[key];
        if((docData.date).includes(currentYear) && (docData.category).includes('expenses')){
            docData.value && (total_expense_val += parseFloat(docData.value));
            $('#total-expense-value').text(numberWithCommas(convertTo2_Decimals(total_expense_val*exchange_rate)));
            localStorage.setItem('total_expense_val', total_expense_val);

            var now = new Date();
            var start = new Date(now.getFullYear(), 0, 0);
            var diff = now - start;
            var oneDay = 1000 * 60 * 60 * 24;
            var days_passed = Math.floor(diff / oneDay);
            
            var days_left = 365 - days_passed;
            var average_per_day = total_expense_val/days_passed;
            var average_per_day_until_end_of_year = average_per_day * days_left;
        
            average_per_day_until_end_of_year = (Math.round((average_per_day_until_end_of_year) * 100) / 100).toFixed(2);
            //average_per_day_until_end_of_year = numberWithCommas(average_per_day_until_end_of_year);
        
            $('#yearly-trend').text(numberWithCommas((average_per_day_until_end_of_year*exchange_rate).toFixed(2))); //PREDICTED VALUE TO END THE YEAR

        }
    }
    $('#totalexpense-text-after').append('<br><a class="text-secondary"> Estimated Average Daily Expense: </a><a class="text-danger">'+numberWithCommas(convertTo2_Decimals(average_per_day*exchange_rate))+' '+(currency)+'</a>')
}


/**
 * GRAPHS BELOW
 */
function updateMonthlyGraph(){
    try{
        $('#yearly-monthly-spendings').text(currentYear+"'s ");
            var ctx = document.getElementById("chartjs-dashboard-line").getContext("2d");
            var gradient = ctx.createLinearGradient(0, 0, 0, 225);
            gradient.addColorStop(0, "rgba(215, 227, 244, 1)");
            gradient.addColorStop(1, "rgba(215, 227, 244, 0)");
        // Line chart
        new Chart(document.getElementById("chartjs-dashboard-line"), {
            type: "line",
            data: {
                    labels: month_strings_for_LINEGRAPH,
                    datasets: [{
                        label: "Expenses ($)",
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: window.theme.primary,
                        data: monthly_expense_array_LINEGRAPH
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    legend: {
                        display: false
                    },
                    tooltips: {
                        intersect: false
                    },
                    hover: {
                        intersect: true
                    },
                    plugins: {
                        filler: {
                            propagate: false
                        }
                    },
                    scales: {
                        xAxes: [{
                            reverse: true,
                            gridLines: {
                                color: "rgba(0,0,0,0.0)"
                            }
                        }],
                        yAxes: [{
                            ticks: {
                                stepSize: 1000,
                                min: 0
                            },
                            display: true,
                            borderDash: [3, 3],
                            gridLines: {
                                color: "rgba(0,0,0,0.0)"
                            }
                        }]
                    }
                }
        });
    }catch(error){
        //console.log(error);
    }
}
function updateBudgePIE(){

    budget_percent[0] = (userData.expenseBudget);
    budget_percent[1] = (userData.savingsBudget);
    budget_percent[2] = (userData.creditPaymentBudget);
    localStorage.setItem('expenseBudget', budget_percent[0]);
    localStorage.setItem('savingsBudget', budget_percent[1]);
    localStorage.setItem('creditPaymentBudget', budget_percent[2]);

    var income = localStorage.getItem('monthly_income_value');

    var expense = income * budget_percent[0]/100,
        savings = income * budget_percent[1]/100,
        credit = income * budget_percent[2]/100;

    var pie_data = [expense, savings, credit];

    var monthly_expense = parseFloat((($('#monthly-expense-value').html()).replaceAll('$','')).replaceAll(',',''));

    var monthly_savings = localStorage.getItem('month-total-savings');
    //parseFloat((($('#total-savings-value').html()).replaceAll('$','')).replaceAll(',',''));

    var monthly_credit = credit_payment;

    var value = [monthly_expense, monthly_savings, monthly_credit];
    var legend_strings = []
    
    $('#pieGraph-text-below').html('');

    for(var i = 0; i<budget_percent.length; i++){
            
            var title = '<tr>'+'<td> Budget for '+categories[i]+' ('+budget_percent[i]+'%)</td>'+'<td class="text-end">';
            var max = '/ <span id="'+categories[i]+'-max">$'+numberWithCommas(convertTo2_Decimals(pie_data[i]))+'</span></td></tr>';

            if(value[i] > pie_data[i]){
                var current = '<span class="text-danger" id="'+categories[i]+'-value">$'+numberWithCommas(convertTo2_Decimals(value[i]))+'</span>';              
            }
            else if(value[i] < pie_data[i]){
                var current = '<span class="text-success" id="'+categories[i]+'-value">$'+numberWithCommas(convertTo2_Decimals(value[i]))+'</span>';   
            }
            else{
                var current = '<span class="text-muted" id="'+categories[i]+'-value">$'+numberWithCommas(convertTo2_Decimals(value[i]))+'</span>';   
            }
            var html = title+current+max;
                legend_strings[i] = categories[i]+'('+budget_percent[i]+'%)';
                $('#pieGraph-text-below').append(html);
    }

    if(income!=null)
        $('#pieGraph-income').text(income);
    else
        $('#pieGraph-income').text('0.00');
        
	// Pie chart
	new Chart(document.getElementById("chartjs-dashboard-pie"), {
				type: "pie",
				data: {
					labels: legend_strings,
					datasets: [{
						data: budget_percent,
						backgroundColor: [
							window.theme.warning,
							window.theme.success,
							window.theme.danger
						],
						borderWidth: 1
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					legend: {
						display: false
					},
					cutoutPercentage: 0
				}
	});

    var ctx = $("#chartjs-dashboard-pie").get(0).getContext("2d");
    ctx.width = 1;
    ctx.height = 1;
}
function updateYearlyComparisonBARGRAPH(){
    for (var key in monthly_expense_array) {
        var obj = monthly_expense_array[key];
        var value = obj.value;
        var date = (obj.name).split('_');
        var year = date[0];
        var month = date[1];
        var currentYear = new Date().getFullYear();
        var lastYear = (new Date().getFullYear())-1;
        var month_index = findMonthIndex(month);
        function findMonthIndex(month){
            for(var i=0; i<month_strings_for_LINEGRAPH.length; i++){

                if(month == month_strings_for_LINEGRAPH[i]){
                    return i;
                }
            }
        }

        if(year == currentYear){
            BARGRAPH_this_year_data[month_index] = value;
        }else if(year == lastYear){
            BARGRAPH_last_year_data[month_index] = value;
        }

    }

			new Chart($('#chartjs-bar'), {
				type: "bar",
				data: {
					labels: month_strings_for_LINEGRAPH,
					datasets: [{
						label: "Last year's expense",
						backgroundColor: "#dee2e6",
						borderColor: window.theme.warning,
						hoverBackgroundColor: window.theme.warning,
						hoverBorderColor: window.theme.warning,
						data: BARGRAPH_last_year_data,
						barPercentage: .60,
						categoryPercentage: .75
					}, {
						label: "This year's expense",
						backgroundColor: window.theme.primary,
						borderColor: window.theme.primary,
						hoverBackgroundColor: window.theme.primary,
						hoverBorderColor: window.theme.primary,
						data: BARGRAPH_this_year_data,
						barPercentage: .80,
						categoryPercentage: .75
					}]
				},
				options: {
					maintainAspectRatio: false,
					legend: {
						display: true
					},
					scales: {
						yAxes: [{
							gridLines: {
								display: true
							},
							stacked: false,
							ticks: {
								stepSize: 1000
							}
						}],
						xAxes: [{
							stacked: false,
							gridLines: {
								color: "transparent"
							}
						}]
					}
				}
			});
}
function updateTransactionTable(transactionData){
    var today_date = (new Date().toLocaleDateString()).split('T');
    var day = new Date().getDay();
        today_date = today_date[0];
    var today_date_split = today_date.split('/');
        today_date = today_date_split[2]+'-'+today_date_split[0]+'-'+today_date_split[1];
        if(day==0){
            day=7;
        }
    var full_date_text = month_strings[parseInt(today_date_split[0]-1)] +' '+parseInt(today_date_split[1])+', '+today_date_split[2]+' ('+days_of_the_week[day-1]+')';
    $('#transaction-table-header').text("Today's Transactions: "+full_date_text);
    var shown_in_table = 0;

    for(var key in transactionData){
        var docData = transactionData[key];
        var date = (docData.date).replaceAll('-0', '-');
        try{
            if(date == today_date || date.includes(today_date)){
                var title = docData.transaction;
                var note = docData.note;
                var category = docData.category.toUpperCase();
                var reportedBy = docData.reportedBy;
                var value = docData.value;
                
                if(category == 'EXPENSES' || category == 'CREDIT'){
                    var color = 'danger';
                }else if(category == 'SAVINGS'){
                    var color = 'warning';
                }if(category == 'INCOME'){
                    var color = 'success';
                }

                var table_template = '<tr>'+
                                        '<td>'+title+'</td>'+
                                        '<td class="d-none d-xl-table-cell"> $'+numberWithCommas(convertTo2_Decimals(value*exchange_rate))+'</td>'+
                                        '<td><span class="badge bg-'+color+'">'+category+'</span></td>'+
                                        '<td class="d-none d-md-table-cell">'+reportedBy+'</td>'+
                                    '</tr>';
                if(shown_in_table < 5){
                    
                    $('#latest-transaction-table').append(table_template);
                    shown_in_table++;
                }
            }
        }catch(err){

        }
    }
}


//ADDITIONAL FUNCTIONS
export function convertTo2_Decimals(x){
    return (Math.round((x) * 100) / 100).toFixed(2);
}
export function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
export function isInfinite(num) {
    return !isFinite(num);
}