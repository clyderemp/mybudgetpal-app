import { expense_types, month_strings, month_strings_for_LINEGRAPH } from "./dataFile.js";
import { coUserData, sorted_transactions, transactionData, userData } from "./main.js";
import { convertTo2_Decimals, numberWithCommas, monthly_income_array, isInfinite} from './dashboard-analytics.js';

var resetFilter_btn = $('#reset-filter-btn');

var variableExpense_summaryReport_header = $('#variableExpense-summaryReport-header');
var variableExpense_summaryTable = $('#variableExpense-summaryTable');
var transactionTable = $('#variableExpense-transactionTable');

var variableExpense_userFilter = $('#variableExpense-userFilter'),
    variableExpense_timeFilter = $('#variableExpense-timeFilter');

const user = [$('#variableExpense-userFilter-allUsers').val()];
const time = [$('#variableExpense-timeFilter-default').val()]

var All_variable_expenses_DATA = [];
    var total_variable_expense = 0;
    var variable_expenses = [], data_selected = [], variable_expense_data = [], variable_expense_average = [];
    var dailyExpenseFlowData = [];
    var budgetvalue_per_item = 0;

    var currentYear_variableExpense = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear_incomeData = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear_expenseData = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear = new Date().getFullYear();
    var date = new Date().toDateString();

    var selected_user = localStorage.getItem('variableExpense_userFilter');
    var selected_time = localStorage.getItem('variableExpense_timeFilter');
    
$(function(){

    if(selected_user == null){
        selected_user = user[0];
        localStorage.setItem('variableExpense_userFilter', selected_user);
    }

    if(selected_time == null){
        selected_time = time[0];
        localStorage.setItem('variableExpense_timeFilter', selected_time);
    }
    for(var i  = 12 ; i<expense_types.length; i++){
        var filter = expense_types[i].split(' (');
            filter = filter[0];
            expense_types[i] = filter;
        variable_expenses.push(expense_types[i]);
    }

    

    populateUserFilter();
    populateTimeFilter();
    filterVariableExpenses(transactionData);
    summaryReportTable();
    populatevariableExpenseTiles();
    
    updateDailyVariableExpenseFlowChart();
    updateLineChartRight();
    updatePieChart();
    updateTransactionTable();
    

    variableExpense_userFilter.change(function(){
        var selected_user_filter = this.value;
        loadSelectedUserData(selected_user_filter);
    });

    variableExpense_timeFilter.change(function(){
        var selected_time_filter = this.value;
        loadSelectedTimeData(selected_time_filter);
    });

    resetFilter_btn.click(function(){
        localStorage.setItem('variableExpense_userFilter', 'All Users');
        localStorage.setItem('variableExpense_timeFilter', 'default');
        window.location.reload();
    });


    variableExpense_summaryTable.hide();
    transactionTable.hide();
    $('#summaryReport-chevron').click(function(){
        var visible = variableExpense_summaryTable.is(':visible');
        if(visible){
            $('#summaryReport-chevron').removeClass('fa-solid fa-chevron-up');
            $('#summaryReport-chevron').addClass('fa-solid fa-chevron-down');
            variableExpense_summaryTable.hide();
        }else{
            $('#summaryReport-chevron').removeClass('fa-solid fa-chevron-down');
            $('#summaryReport-chevron').addClass('fa-solid fa-chevron-up');
            variableExpense_summaryTable.show();
        }
    });

    $('#transactionReport-chevron').click(function(){
        var visible = transactionTable.is(':visible');
        if(visible){
            $('#transactionReport-chevron').removeClass('fa-solid fa-chevron-up');
            $('#transactionReport-chevron').addClass('fa-solid fa-chevron-down');
            transactionTable.hide();
        }else{
            $('#transactionReport-chevron').removeClass('fa-solid fa-chevron-down');
            $('#transactionReport-chevron').addClass('fa-solid fa-chevron-up');
            transactionTable.show();
        }
    });
    
});

function populateUserFilter(){
    
    var main_user = userData.fname + ' '+ userData.lname;
    
    user.push(JSON.stringify("Me - "+main_user));

    for(var key in coUserData){

        var fname = coUserData[key].fname;
        var lname = coUserData[key].lname;
        var fullName = fname+' '+lname;

        user.push(JSON.stringify(fullName));
    }
    var table_html = '';
    for(var index = user.length-1; index >=0 ; index--){

        if(index > 0){
            //FOR THE FILTER
            var option_template = "<option value="+user[index]+">"+(user[index]).replaceAll('"','')+"</option>";
            variableExpense_userFilter.append(option_template);
        }

        //FOR THE TABLE
        var user_header = (user[index]).replaceAll('Me - ', '');
            user_header = user_header.replaceAll('"','');
        if(user_header=='All Users'){
            user_header = 'TOTAL';
        }

        table_html += '<th class="text-lg">'+user_header+'</th>';

    }
    variableExpense_summaryReport_header.append(table_html);

    if(selected_user==null){
        variableExpense_userFilter.val('All Users');
    }else{
        variableExpense_userFilter.val(selected_user);
    }
}

function populateTimeFilter(){
    var timeFilter =[];
    for (var key in transactionData){
        var obj = transactionData[key];
        var date = (obj.date).split('-'),
            month = parseInt(date[1]),
            day = date[2],
            year = date[0];
        for(var i=0; i<variable_expenses.length; i++){

            if(transactionData[key].category == 'expenses' && transactionData[key].type == variable_expenses[i]){
                timeFilter[month+' '+year] = obj;
            }
        }
    }
    

    for(var key in timeFilter){
        var value = key.split(' '),
            month = month_strings[value[0]-1];
        var option_value = JSON.stringify(month+' '+value[1]),
            option_select = month+' '+value[1];
        
            var option_template = "<option value="+option_value+">"+option_select+"</option>";

            variableExpense_timeFilter.append(option_template);
    }
    variableExpense_timeFilter.val(selected_time);
}
/**
 * FILTER THE VARIABLE EXPENSES ONLY
 */
function filterVariableExpenses(transactionData){

    for(var i=0; i<user.length; i++){
        var user_string = (user[i]).replaceAll('"','');
        variable_expense_data[user_string] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
        variable_expense_average[user_string] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    }

    //FILTER THE FIXED EXPENSES
    for( var key in transactionData){
        var docData = transactionData[key];
        for(var n = 0; n < variable_expenses.length; n++){
            var date = (docData.date).split('-');
                date = month_strings[parseInt(date[1])-1]+' '+date[0];
            var selected_time = localStorage.getItem('variableExpense_timeFilter');

            if(selected_time!='default'){ //IF NOT DEFAULT, THEN ONLY GET SPECIFIC DATE BASED ON TIME

                if(docData.type == variable_expenses[n] && selected_time == date){
                    docData.variableExpenseIndex = n;
                    All_variable_expenses_DATA.push(docData);
                    dailyExpenseFlowData.push(docData);
                }
            }
            else{ //GET ALL RESULTS
                if(docData.type == variable_expenses[n]){
                    docData.variableExpenseIndex = n;
                    All_variable_expenses_DATA.push(docData);
                    dailyExpenseFlowData.push(docData);
                }
            }
        }
    }
    //STORE VALUES INTO THE OBJECT ARRAY
    for(var i=0 ; i<All_variable_expenses_DATA.length; i++){
        var reporter = All_variable_expenses_DATA[i].reportedBy;
        var index = All_variable_expenses_DATA[i].variableExpenseIndex;
        variable_expense_data[reporter][index] += All_variable_expenses_DATA[i].value;
        variable_expense_data['All Users'][index] +=All_variable_expenses_DATA[i].value;

        variable_expense_average[reporter][index]++;
        variable_expense_average['All Users'][index] ++;
    }
    //CALCULATES TOTAL FOR EACH USER
    for(var key in variable_expense_data){
        var length = variable_expense_data[key].length;
        for(var i=0; i<length-1; i++){
            variable_expense_data[key][length-1] += variable_expense_data[key][i];
        }
    }
}
/**
 * POPULATE THE SUMMARY TABLE
 */
function summaryReportTable(){

    if(selected_time!='default'){
        $('#transaction-table-header').append(' ('+selected_time+')')
    }
    var table_template = '<tr>';

    var table_template = '<tr>';
    variable_expenses.push('TOTAL');

    for(var vertical = 0; vertical < variable_expenses.length; vertical++){

        table_template += '<th>'+variable_expenses[vertical]+'</th>';

        for(var horizontal = user.length-1; horizontal >=0 ; horizontal--){
            var user_string = user[horizontal].replaceAll('"','');
            if(selected_user == user[horizontal].replaceAll('"','')){
                table_template += '<th class="text-lg text-danger" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(variable_expense_data[user_string][vertical])) + '</th>';
            }else{
                if(vertical==variable_expenses.length-1){
                    table_template += '<th class="text-lg text-primary" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(variable_expense_data[user_string][vertical])) + '</th>';
                }
                else{
                    table_template += '<th class="text-sm text-dark" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(variable_expense_data[user_string][vertical])) + '</th>';
                }
                }
        }
        table_template += '</tr>';
    }
        variableExpense_summaryTable.append(table_template);
}
/**
 * FILTERS THE SELECTED DATA
 */
function loadSelectedUserData(user_filter){

    variableExpense_userFilter.val(user_filter);
    localStorage.setItem('variableExpense_userFilter', user_filter);
    window.location.reload();
}
function loadSelectedTimeData(time_filter){

    variableExpense_userFilter.val(time_filter);
    localStorage.setItem('variableExpense_timeFilter', time_filter);
    window.location.reload();
}
/**
 * UPDATES THE FIRST DAILY FLOWCHART
 */
function updateDailyVariableExpenseFlowChart(){

    var allTime_Expenses = [];
    var label = [], value= [];
    //Filter expenses from transactionData
    for(var key in All_variable_expenses_DATA){
        var obj = All_variable_expenses_DATA[key];
        var date = (obj.date).split('-');
        var item_year = month_strings[parseInt(date[1]-1)]+' '+date[0];
            date = date[1]+'-'+date[2]+'-'+date[0];

        if(selected_user!='All Users'){
            var reporter = obj.reportedBy;
        }
        else{
            var reporter = '';
        }

        if(selected_time == 'default'){
            if(!isFinite(allTime_Expenses[date])){
                allTime_Expenses[date] = 0;
            }
            allTime_Expenses[date] += obj.value;
        }
        else{
            var selected_year = selected_time.split(' ');
                selected_year = selected_year[1];
                console.log(selected_user, reporter)
            if(reporter!=''){
                if(item_year==selected_time && selected_user==reporter){
                    if(!isFinite(allTime_Expenses[date])){
                        allTime_Expenses[date] = 0;
                    }
                    allTime_Expenses[date] += obj.value;
                }
            }
            else{
                if(item_year==selected_time){
                    if(!isFinite(allTime_Expenses[date])){
                        allTime_Expenses[date] = 0;
                    }
                    allTime_Expenses[date] += obj.value;
                }
            }
            
        }
    }

    //PUTTING THE DATES IN ORDER
    var orderedDates = {};
        Object.keys(allTime_Expenses).sort(function(a, b) {
            return moment(b, 'mm-dd-yyyy').toDate() - moment(a, 'mm-dd-yyyy').toDate();
        }).forEach(function(key) {
            if(isInfinite(orderedDates.length)){
                orderedDates.length = 0;
            }
            orderedDates.length++;
            orderedDates[key] = allTime_Expenses[key];
        });
    for(var key in orderedDates){
        label.push(key);
        value.push(orderedDates[key]);
    }

    //REVERSED THE ORDER
    var temp_val = [], temp_label =[], n=0;
    for(var i = orderedDates.length-1; i >= 0; i--){
        n++;
        temp_val[i] = value[n];
        temp_label[i] = label[n];
    }
    value = temp_val;
    label = temp_label;
    
    var earliest_date = label[0].split('-');
        earliest_date = month_strings[parseInt(earliest_date[0])-1]+' '+earliest_date[1]+', '+earliest_date[2];
    var latest_date = label[label.length-1].split('-');
        latest_date = month_strings[parseInt(latest_date[0])-1]+' '+latest_date[1]+', '+latest_date[2];

            $('#expense-flow-title').text("("+earliest_date+' - '+latest_date+')');
            var ctx = document.getElementById("variableExpense-lineChart").getContext("2d");
            var gradient = ctx.createLinearGradient(0, 0, 0, 225);
            gradient.addColorStop(0, "rgba(215, 227, 244, 1)");
            gradient.addColorStop(1, "rgba(215, 227, 244, 0)");
        // Line chart
        new Chart(document.getElementById("variableExpense-lineChart"), {
            type: "line",
            data: {
                    labels: label,
                    datasets: [{
                        label: "Value $",
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: window.theme.primary,
                        data: value,
                        tension: 0,
                        pointRadius: 0,
                        borderWidth: 1.5
                    }]
                },
                options: {
                    bezierCurve: false,
                    maintainAspectRatio: false,
                    legend: {
                        display: false
                    },
                    tooltips: {
                        intersect: true
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
                            display: true,
                            reverse: true,
                            gridLines: {
                                color: "rgba(0,0,0,0.0)"
                            }
                        }],
                        yAxes: [{
                            ticks: {
                                beginAtZero: true,
                                stepSize: 1000,
                                min: 0
                            },
                            display: true,
                            borderDash: [3, 3],
                            gridLines: {
                                color: "rgba(0,0,0,0.0)"
                            }
                        }],
                    }
                }
        });
}
/**
 * UPDATES THE CHART WITH MULTIPLE LINES
 */
function updateLineChartRight(){
    var income_data = JSON.parse(localStorage.getItem('monthly_income_array'));
    var expense_data = JSON.parse(localStorage.getItem('monthly_expense_array'));
    var all_time_expense_data = [0,0,0,0,0,0,0,0,0,0,0,0];

    for(var key in income_data){
        var date = key.split('_'),
            month = date[1],
            year = date[0];
        if(year==currentYear){
            for(var n=0; n<month_strings.length; n++){
                if(month==month_strings[n]){
                    currentYear_incomeData[n] = income_data[key];
                }
            }
        }
    }

    for(var key in expense_data){
        var date = key.split('_'),
            month = date[1],
            year = date[0];
        if(year==currentYear){
            for(var n=0; n<month_strings_for_LINEGRAPH.length; n++){
                if(month==month_strings_for_LINEGRAPH[n]){
                    currentYear_expenseData[n] = expense_data[key];
                }
            }
        }else{
            for(var n=0; n<month_strings_for_LINEGRAPH.length; n++){
                if(month==month_strings_for_LINEGRAPH[n]){
                    all_time_expense_data[n] = expense_data[key];
                }
            }
        }
    }

    for(var key in All_variable_expenses_DATA){
        var date = (All_variable_expenses_DATA[key].date).split('-'),
            month = month_strings_for_LINEGRAPH[(parseInt(date[1])-1)],
            year = date[0];

        if(year==currentYear){
            for(var n=0; n<month_strings_for_LINEGRAPH.length; n++){
                if(month==month_strings_for_LINEGRAPH[n]){
                    currentYear_variableExpense[n] += All_variable_expenses_DATA[key].value;
                }
            }
        }

        if(selected_time!='default'){
            $('#yearly-monthly-spendings').text(year+"'s ");
        }else
            $('#yearly-monthly-spendings').text("All-Time ");
    }
            var ctx = document.getElementById("chartjs-lineChart-right").getContext("2d");
            var gradient = ctx.createLinearGradient(0, 0, 0, 225);
            gradient.addColorStop(0, "rgba(215, 227, 244, 1)");
            gradient.addColorStop(1, "rgba(215, 227, 244, 0)");

        var selected_user0 = selected_user.replaceAll('Me - ','');
            selected_user0 = selected_user0.split(' ');
            selected_user0 = selected_user0[0];
        // Line chart
        new Chart(document.getElementById("chartjs-lineChart-right"), {
            type: "line",
            data: {
                    labels: month_strings_for_LINEGRAPH,
					datasets: [{
						label: "Variable Expenses for "+selected_user0,
						fill: true,
						backgroundColor: "transparent",
						borderColor: window.theme.success,
						data: currentYear_variableExpense
					}, {
						label: currentYear+" Household Income ($)",
						fill: true,
						backgroundColor: "transparent",
						borderColor:  "#adb5bd",
						borderDash: [3, 1],
						data: currentYear_incomeData
					}, {
						label: "Monthly Expenses in "+currentYear,
						fill: true,
						backgroundColor: "transparent",
						borderDash: [2, 1],
						borderColor: window.theme.danger,
						data: currentYear_expenseData
					}, {
						label: "All-Time Total Monthly Expenses ($)",
						fill: true,
						backgroundColor: "transparent",
						borderDash: [2, 1],
						borderColor: window.theme.primary,
						data: all_time_expense_data
					}
                ]
                },
                options: {
                    maintainAspectRatio: false,
                    legend: {
                        display: true
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
                            display: true,
                            reverse: true,
                            gridLines: {
                                color: "rgba(0,0,0,0.0)"
                            }
                        }],
                        yAxes: [{
                            ticks: {
                                stepSize: 500,
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
}
/**
 * PIE CHART UPDATE
 */
function updatePieChart(){
    var pieChart_text = $('#pieGraph-text-below');

    var pieColor = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7",
                     "#ede15b", "#bdcf32", "#808000", "#00bfff", "#ff8c00", "#fa8072", "#dda0dd", "#7fff00", "#ffe4c4"];

    /**
     * TEXT DATA
     */
    for(var i = 0; i<variable_expenses.length-1; i++){
        var percent = convertTo2_Decimals((data_selected[i] / budgetvalue_per_item)* 100);
        var title = '<tr><td class="text-white" style="background-color:'+pieColor[i]+';"> Budget for '+variable_expenses[i]+' ('+percent+'%)</td>'+'<td class="text-end">';
        var current = '<span class="text-secondary">$'+numberWithCommas(convertTo2_Decimals(data_selected[i]))+'</span>';              
        var max = '/ <span id="'+variable_expenses[i]+'-max">$'+numberWithCommas(convertTo2_Decimals(budgetvalue_per_item))+'</span></td></tr>';
        var html = title+current+max;

            pieChart_text.append(html);
    }


    /**
     * PIE DATA
     */
    var piechart_user = (selected_user.replaceAll('Me - ','')).split(' ');
        piechart_user = piechart_user[0];
        if(piechart_user!='All'){
            var title = ' for '+piechart_user;
        }

    $('#variable-expense-chart-title').text(title);
    var selected_data = variable_expense_data[variableExpense_userFilter.val()];
        selected_data.pop();

    for(var i=0; i<selected_data.length; i++){
        total_variable_expense += selected_data[i];
        $('#pieGraph-variableExpense').text(numberWithCommas(convertTo2_Decimals(total_variable_expense)));
    }

    var pie_variable_expenses = [];
    for(var i=0; i<variable_expenses.length-1; i++){
        pie_variable_expenses.push(variable_expenses[i]);
    }

    new Chart(document.getElementById("chartjs-variableExpense-pie"), {
        type: "pie",
        data: {
            labels: pie_variable_expenses,
            datasets: [{
                data: selected_data,
                backgroundColor: pieColor,
                borderWidth: 1
            }]
        },
        options: {
            aspectRatio: 0.8,
            responsive: true,
            maintainAspectRatio: false,
            legend: {
                display: true,
                position: 'top'
            },
            cutoutPercentage: 0
        }
    });
}
/**
 * UPDATES THE TILES FOR EACH VARIABLE EXPENSE
 */
function populatevariableExpenseTiles(){
    var panel_div = $('#variable-expense-panel');
    var current_card = 0;
        data_selected = variable_expense_data[selected_user];
    var card_html = '', col_html = '', row_html = '', panel_html = '';
    var total = 0;
    for(var i=0; i<data_selected.length-1;i++){
        total += data_selected[i];
    }

    var total_income = 0;
    for(var key in transactionData){
        var obj = transactionData[key];
        var date = (obj.date).split('-');
            date = month_strings[parseInt(date[1])-1]+' '+date[0];
            
        if(selected_time == 'default'){
            if(obj.category == 'income'){
                total_income += obj.value;
            }
        }
        else{
            if(obj.category == 'income' && selected_time == date){
                total_income += obj.value;
            }
        }
    }
    budgetvalue_per_item = (total_income * ((parseInt(localStorage.getItem('expenseBudget')))/100))/(expense_types.length); //Calculate the budget per item

    for(var panel = 0; panel < 3; panel++){
        row_html = '';
        for(var rows = 0; rows < 3; rows++){
            card_html = '';
            for(var cols = 0; cols < 2; cols++){
                var amount = convertTo2_Decimals(data_selected[current_card]);
                var average =  convertTo2_Decimals(amount/variable_expense_average[selected_user][current_card]);
                var budget_amount = (amount/budgetvalue_per_item);
                var budget_ratio = 'Budget Ratio: '+convertTo2_Decimals((budget_amount)*100)+'%';
                var percent = 'Expense Ratio: '+convertTo2_Decimals((amount/total)*100)+'%';
                var amount_of_transactions = 'Transactions Reported: '+numberWithCommas(variable_expense_average[selected_user][current_card]);
                

                if(isInfinite(average)){
                    average = convertTo2_Decimals(0);
                    percent = 'Expense Ratio: No Data';
                }

                if(amount>budgetvalue_per_item){
                    var amount_html = '<h1 class="mt-1 mb-3" style="font-size:23px;">$'+numberWithCommas(amount)+' <i class="text-danger fa-solid fa-arrow-up-wide-short" ></i>'+'</h1>';
                    var average_html = '<span class="text-dark text-sm">AVG: $'+numberWithCommas(average)+
                                        '<br>'+percent+'<br>'+budget_ratio+'<br>'+amount_of_transactions+'</span>';
                }
                else if(amount<budgetvalue_per_item){
                    var amount_html = '<h1 class="mt-1 mb-3" style="font-size:23px;">$'+numberWithCommas(amount)+' <i class="text-success fa-solid fa-arrow-down-wide-short"></i>'+'</h1>';
                    var average_html = '<span class="text-dark text-sm">AVG: $'+numberWithCommas(average)+
                                        '<br>'+percent+'<br>'+budget_ratio+'<br>'+amount_of_transactions+'</span>';}
                else if(amount==budgetvalue_per_item){
                    var amount_html = '<h1 class="mt-1 mb-3" style="font-size:23px;">$'+numberWithCommas(amount)+' <i class="text-warning fa-solid fa-arrow-down-up-across-line"></i>'+'</h1>';
                    var average_html = '<span class="text-dark text-sm">AVG: $'+numberWithCommas(average)+
                                        '<br>'+percent+'<br>'+budget_ratio+'<br>'+amount_of_transactions+'</span>';}
                

                card_html += '<div class="card" style="height: 200px;">'+
                                    '<div class="card-body">'+
                                        '<div class="row">'+
                                            '<div class="col mt-0">'+
                                                '<a class="card-title">'+variable_expenses[current_card]+'</a>'+
                                            '</div>'+
                                            '<div class="col-auto">'+
                                                '<div class="stat text-primary">'+
                                                    '<i class="align-middle">$</i>'+
                                                '</div>'+
                                            '</div>'+
                                        '</div>'+
                                            amount_html+
                                        '<div class="mb-0">'+
                                            average_html+
                                        '</div>'+
                                    '</div>'+
                                '</div>';
                current_card++;
            }
            col_html += '<div class="col-sm-4">'+card_html+'</div>';
            
        }
        row_html += '<div class="row" id="row-fixed-expense-type-'+rows+'">'+
                            col_html+
                        '</div>';
        
    }

    panel_html += '<div class="col-xl-7 col-xxl-7 d-flex" id="panel-'+panel+'">'+
                        '<div class="w-100">'+
                            row_html+
                        '</div>'+
                    '</div>';
    panel_div.append(panel_html);
}

function updateTransactionTable(){
    var transactionData = All_variable_expenses_DATA;
    if(selected_user=='All Users'){
        for(var key in transactionData){
            var docData = transactionData[key];

                if(docData.category == 'expenses'){
                    for(var i = 0; i<variable_expenses.length; i++){

                        if((docData.type).includes(variable_expenses[i])){
                                var title = docData.transaction;
                                var date = docData.date;
                                var type = docData.type;
                                var reportedBy = docData.reportedBy;
                                    reportedBy = reportedBy.replaceAll('Me - ','');
                                var value = docData.value;
                                
                                var table_template = '<tr>'+
                                                        '<td>'+title+'</td>'+
                                                        '<td><span class="badge bg-secondary">'+date+'</span></td>'+
                                                        '<td class="d-none d-xl-table-cell"> $'+numberWithCommas(convertTo2_Decimals(value))+'</td>'+
                                                        '<td><span class="badge bg-success">'+type+'</span></td>'+
                                                        '<td class="d-none d-md-table-cell">'+reportedBy+'</td>'+
                                                    '</tr>';
                                    
                                    $('#variableExpense-transaction-table').append(table_template);
                        }
                    }
                    
                }
        }
    }
    else{
        for(var key in transactionData){
            var docData = transactionData[key];

                if(docData.category == 'expenses' && docData.reportedBy==selected_user){
                    for(var i = 0; i<variable_expenses.length; i++){

                        if((docData.type).includes(variable_expenses[i])){
                                var title = docData.transaction;
                                var date = docData.date;
                                var type = docData.type;
                                var reportedBy = docData.reportedBy;
                                    reportedBy = reportedBy.replaceAll('Me - ','');
                                var value = docData.value;
                                
                                var table_template = '<tr>'+
                                                        '<td>'+title+'</td>'+
                                                        '<td><span class="badge bg-secondary">'+date+'</span></td>'+
                                                        '<td class="d-none d-xl-table-cell"> $'+numberWithCommas(convertTo2_Decimals(value))+'</td>'+
                                                        '<td><span class="badge bg-success">'+type+'</span></td>'+
                                                        '<td class="d-none d-md-table-cell">'+reportedBy+'</td>'+
                                                    '</tr>';
                                    
                                    $('#variableExpense-transaction-table').append(table_template);
                        }
                    }
                    
                }
        }
    }
}