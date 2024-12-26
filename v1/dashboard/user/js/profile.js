

import { monthly_income_array, numberWithCommas } from "./dashboard-analytics.js";
import { expense_types, month_strings, savings_types } from "./dataFile.js";

const household_income = parseInt(localStorage.getItem('monthly_income_value'));
const currency_code = localStorage.getItem('currencyCode');


const year_filter = $('#budget-yearFilter');
const month_filter = $('#budget-monthFilter');
const day_filter = $('#budget-dayFilter');

$('#end-budgetfilter').hide();
const year_filter_end = $('#budget-yearFilter-end'); year_filter_end.hide();
const month_filter_end = $('#budget-monthFilter-end'); month_filter_end.hide();
const day_filter_end = $('#budget-dayFilter-end'); day_filter_end.hide();

const stored_budget_year = localStorage.getItem('budget_year');
const stored_budget_month = localStorage.getItem('budget_month');
const stored_budget_day = localStorage.getItem('budget_day');

const stored_budget_year_end = localStorage.getItem('budget_year_end');
const stored_budget_month_end = localStorage.getItem('budget_month_end');
const stored_budget_day_end = localStorage.getItem('budget_day_end');

let budget_year = stored_budget_year? stored_budget_year:'default',
    budget_month = stored_budget_month? stored_budget_month:'default',
    budget_day = stored_budget_day? stored_budget_month:'default',
    budget_year_end = stored_budget_year_end? stored_budget_year_end:'default',
    budget_month_end = stored_budget_month_end? stored_budget_month_end:'default',
    budget_day_end = stored_budget_day_end? stored_budget_month_end:'default';
let exchange_rate = JSON.parse(await localStorage.getItem('exchange_rate'));
    exchange_rate = exchange_rate?.value;
export async function loadProfile(data){

    const transactionData = JSON.parse(localStorage.getItem(data.id+'-transactionData'));
    const addedYears = new Set();
    const year_filter_years = new Set();
    const addedMonths = new Set();
    let addedDays = [];
    month_filter.hide();
    day_filter.hide();
    $('#enter-budgetfilter-btn').hide();
    $('#reset-budgetfilter-btn').hide();

    for(var key in transactionData){
        const obj = transactionData[key];

        if (obj.category === 'income') {
            const [year, month, day] = obj.date.split('-');
            if (!addedYears.has(year)) {
                const html = `<option value='${year}'>${year}</option>`;
                addedYears.add(year);
                year_filter.append(html);
            } else {
                // Check if the year is greater than the maximum year in year_filter
                const maxYearInFilter = Math.max(...Array.from(year_filter_years));
                if (year >= maxYearInFilter && !year_filter_years.has(year)) {
                    year_filter_years.add(year);
                    const html = `<option value='${year}'>${year}</option>`;
                    year_filter_end.append(html);
                }
            }
            if (!addedMonths.has(month)) {
                const html = `<option value='${month}'>${month_strings[month-1]}</option>`;
                addedMonths.add(month);
                month_filter.append(html);
                month_filter_end.append(html);
            }
            if (!addedDays.includes(day)) {
                // Insert the day in a sorted manner
                addedDays.push(day);
                addedDays.sort((a, b) => a - b);
        
                // Clear existing options
                day_filter.empty();
                day_filter_end.empty();
        
                // Add sorted days to the filter
                addedDays.forEach(d => {
                    const html = `<option value='${d}'>${d}</option>`;
                    day_filter.append(html);
                    day_filter_end.append(html);
                });
            }
        }
    }

    var fullname = data.fname+' '+data.lname;
    var dob = data.dob;
    $('#profile-fullname').text(fullname);
    var age = calculateAge(dob.replace('-',''));
    $('#profile-age').text('Curently '+age+' years old');
    $('#profile-expenseBudget').text((data.expenseBudget)+'%');
    $('#profile-savingsBudget').text((data.savingsBudget)+'%');
    $('#profile-creditBudget').text((data.creditPaymentBudget)+'%');

    year_filter.val(budget_year);

    if(budget_year !=='default'){
        month_filter.val(budget_month);
        month_filter.show();
    }
    if(month_filter.val() !== 'default'){
        day_filter.show();
        budget_day = localStorage.getItem('budget_day');
        day_filter.val(budget_day);
    }
    if(day_filter.val() !== 'default'){
        $('#end-budgetfilter').show();
        year_filter_end.val(budget_year_end);
        year_filter_end.show();
    }
    if(budget_year_end !=='default'){
        month_filter_end.val(budget_month_end);
        month_filter_end.show();
    }
    if(month_filter_end.val() !== 'default'){
        budget_day_end = localStorage.getItem('budget_day_end');
        day_filter_end.val(budget_day_end);
        day_filter_end.show();
    }
    if(day_filter_end.val() !== 'default'){
        $('#enter-budgetfilter-btn').show();
        $('#reset-budgetfilter-btn').show();
        launchBudgetData(transactionData);
    }

    year_filter.change(function(){
        const value = year_filter.val();

        if(value !== 'default'){
            month_filter.show();
            budget_year = value;
            localStorage.setItem('budget_year', budget_year);
        }
        else{
            month_filter.hide();
        }
    });
    month_filter.change(function(){
        const value = month_filter.val();
        budget_month = value;
        localStorage.removeItem('budget_month');
        localStorage.removeItem('budget_day');
        localStorage.setItem('budget_month', budget_month);
        $('#budget-dayFilter').show();
    });
    day_filter.change(async function(){
        const value = day_filter.val();
        console.log(day_filter.val(), value)
        budget_day = value;
        localStorage.removeItem('budget_day');
        localStorage.setItem('budget_day', value);
        year_filter_end.show();
    });
    year_filter_end.change(function(){
        const value = year_filter_end.val();

        if(value !== 'default'){
            month_filter_end.show();
            budget_year_end = value;
            localStorage.setItem('budget_year_end', budget_year_end);
        }
        else{
            month_filter.hide();
        }
    });
    month_filter_end.change(function(){
        const value = month_filter_end.val();
        budget_month_end = value;
        localStorage.setItem('budget_month_end', budget_month_end);
        day_filter_end.show();
    });
    day_filter_end.change(function(){
        const value = day_filter_end.val();
        budget_day_end = value;
        localStorage.setItem('budget_day_end', budget_day_end);
        $('#enter-budgetfilter-btn').show();
        $('#reset-budgetfilter-btn').show();
    });

    
    
    $('#enter-budgetfilter-btn').click(function(){
        launchBudgetData(transactionData);
    });

    $('#reset-budgetfilter-btn').click(function(){
        year_filter.empty();
        month_filter.empty();
        day_filter.empty();
        year_filter_end.empty();
        month_filter_end.empty();
        day_filter_end.empty();
        localStorage.removeItem('budget_year');
        localStorage.removeItem('budget_month');
        localStorage.removeItem('budget_day');
        localStorage.removeItem('budget_year_end');
        localStorage.removeItem('budget_month_end');
        localStorage.removeItem('budget_day_end');

        location.reload();
    });

}

function launchBudgetData(transactionData){
    $('#budget-currentMonth').text(month_strings[budget_month-1]+' '+ budget_year+"'s");
    analyzeCurrentMonthData(transactionData);
}

function analyzeCurrentMonthData(transactionData){

    $('#customizableRows').empty();
    const startMonth = parseInt(month_filter.val());
    const startYear = parseInt(year_filter.val());
    const startDay = parseInt(day_filter.val());
    const endMonth = parseInt(month_filter_end.val());
    const endYear = parseInt(year_filter_end.val());
    const endDay = parseInt(day_filter_end.val());
    // Create an object to store the summed amounts by category
    let typeTotals = {};
    let totalIncome_withinTimeframe = 0,
        totalExpense_withinTimeframe = 0,
        totalSavings_withinTimeframe = 0;

    for (var key in transactionData) {
        const obj = transactionData[key];
        const [year, month, day] = obj.date.split('-').map(Number);
        const value = obj.value * (exchange_rate ? exchange_rate : 1);
        
        const startDate = new Date(startYear, startMonth - 1, startDay);
        const endDate = new Date(endYear, endMonth - 1, endDay);
        const currentDate = new Date(year, month - 1, day);
        const stored_exchange_rate = obj.exchange_rate? parseFloat(obj.exchange_rate) : exchange_rate;
        if (obj.category !== 'income' && currentDate >= startDate && currentDate <= endDate) {
            obj.category === 'savings'?
                totalSavings_withinTimeframe += (obj.value * stored_exchange_rate) : totalSavings_withinTimeframe += 0;

            obj.category === 'expenses'?
                totalExpense_withinTimeframe += (obj.value * stored_exchange_rate) : totalExpense_withinTimeframe += 0;

            if (!typeTotals[obj.type]) {
                typeTotals[obj.type] = {
                    category: obj.category,
                    value: value
                };
            } else {
                typeTotals[obj.type].value += parseFloat(value);
            }
        }
        if (obj.category === 'income' && currentDate >= startDate && currentDate <= endDate) {
            
            obj.value && (totalIncome_withinTimeframe += (obj.value * stored_exchange_rate));
        }
    }
    $('#budget-currentMonth-right').html('Household Income: <b>' + currency_code + ' ' + numberWithCommas(totalIncome_withinTimeframe.toFixed(2)) + '</b><br>'+
    'Total Expenses: <b>' + currency_code + ' ' + numberWithCommas(totalExpense_withinTimeframe.toFixed(2)) + '</b><br>'+
    'Total Savings: <b>' + currency_code + ' ' + numberWithCommas(totalSavings_withinTimeframe.toFixed(2)) + '</b><br>'+
    'Leftover: <b>' + currency_code + ' ' + numberWithCommas((totalIncome_withinTimeframe - (totalExpense_withinTimeframe + totalSavings_withinTimeframe)).toFixed(2)) + '</b><br>'
    );
    // Create rows with input fields for budget values and actual values
    for (var type in typeTotals) {
        var newRowHtml = '<tr data-type="' + type + '">' +
            '<td><input type="text" class="form-control" value="' + typeTotals[type].category[0].toUpperCase() + typeTotals[type].category.slice(1) + '" disabled></td>' +
            '<td><input type="text" class="form-control budget-type" value="' + type[0].toUpperCase() + type.slice(1) + '" disabled></td>' +
            '<td><input type="number" class="form-control budget-value"></td>' +
            '<td><p class="actual-value">' + currency_code + ' ' + typeTotals[type].value.toFixed(2) + '</p></td>' +
            '<td><input type="text" class="form-control remaining-balance" disabled></td>' +
            '</tr>';

        $('#customizableRows').append(newRowHtml);
    }

    // Attach the oninput event handler to all budget-value inputs
    $('.budget-value').on('input', function () {
        const budgetValue = parseFloat($(this).val()) || 0;
        const row = $(this).closest('tr');
        const type = row.data('type');
        const actualValue = typeTotals[type].value || 0;
        const remainingBalanceCell = row.find('.remaining-balance');
        const remainingBalance = budgetValue - actualValue;
        remainingBalanceCell.val(remainingBalance.toFixed(2));
    });
}

export function sendCoUserDataToProfile(coUserData){
    for(var key in coUserData){
        var docData = coUserData[key];
        var html = '<a class="badge bg-primary me-1 my-1" href="../manage-users/view.html">'+docData.fname+' '+docData.lname+'</a>';

        $('#profile-coUsers').append(html)
    }
}

function calculateAge(dob){
    var year = Number(dob.substr(0, 4));
    var month = Number(dob.substr(4, 2)) - 1;
    var day = Number(dob.substr(6, 2));
    var today = new Date();
    var age = today.getFullYear() - year;
    if (today.getMonth() < month || (today.getMonth() == month && today.getDate() < day)) {
        age--;
    }
    return age;
}


// Click event to add a new row
$('#add-expense-btn').click(function() {
    // Define the HTML for a new row
    var newRowHtml = '<tr>' +
        '<td><select class="form-control add-category">' +
            '<option value="expense">Expense</option>' +
            '<option value="savings">Savings</option>' +
        '</select></td>' +
        '<td><select class="form-control add-type">' +
        '</select></td>' +
        '<td><input type="number" class="form-control"></td>' +
        '<td><input type="number" class="form-control"></td>' +
        '<td><input type="text" class="form-control" disabled></td>' +
        '</tr>';

    // Append the new row HTML to the tbody
    $('#customizableRows').append(newRowHtml);

    // Populate the type select field with the initial options (expense_types)
    populateType(expense_types);
});

// Event delegation to handle change event on dynamically added .add-category select fields
$('#customizableRows').on('change', '.add-category', function() {
    var category = $(this).val();
    var row = $(this).closest('tr');
    var typeSelect = row.find('.add-type');

    if (category === 'expense') {
        populateType(expense_types);
    } else if (category === 'savings') {
        populateType(savings_types);
    }
});


// Function to populate the add-type select field
function populateType(options) {
    var addTypeSelect = $('#customizableRows').find('.add-type:last');
    addTypeSelect.empty(); // Clear any existing options

    options.forEach(function(option) {
        var newOption = $('<option></option>').attr('value', option).text(option);
        addTypeSelect.append(newOption);
    });
}

function calculateIncome() {
    var coUsers = parseInt(document.getElementById('coUsers').value);
    var incomePerUser = 1000; // Example income per user
    var totalIncome = coUsers * incomePerUser;
    alert("Monthly Income Expectation based on " + coUsers + " co-users: $" + totalIncome);
}