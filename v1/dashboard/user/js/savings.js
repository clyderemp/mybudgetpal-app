import { expense_types, month_strings, month_strings_for_LINEGRAPH, savings_types } from "./dataFile.js";
import { coUserData, sorted_transactions, transactionData, userData } from "./main.js";
import { convertTo2_Decimals, numberWithCommas, monthly_income_array, isInfinite} from './dashboard-analytics.js';

var icons = ['basket-shopping', 'vault', 'truck-medical' , 'person-cane', 'leaf'];

var resetFilter_btn = $('#reset-filter-btn');

var summaryReport_FULL = $('#summaryTable-FULL');
var summarReport_header = $('#summaryReport-header');
var summaryReport = $('#summaryTable');

var transactionTable = $('#transactionTable');

var userFilter = $('#userFilter'),
    timeFilter = $('#timeFilter');

const user = [$('#userFilter-allUsers').val()];
const time = [$('#timeFilter-default').val()]

const savingsAccounts_Panels = $('#savings-accounts-panels');
const SBP_header = $('#savings-budget-planner-header');
const SBP_body = $('#savings-budget-planner-body');
const editSBP_btn = $('#edit-sbp');

    var All_Savings_DATA = [];
    var saving_accounts_data = [], saving_accounts_transactionNum= [], saving_accounts_average = [], data_selected = [];
    var total_savings_chart_data = [];
    var budgetvalue_per_item = 0;
    var savings_expense = []; //Expense using the savings

    var currentYear_variableExpense = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear_incomeData = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear_expenseData = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear = new Date().getFullYear();
    var date = new Date().toDateString();

    var selected_user = localStorage.getItem('userFilter');
    var selected_time = localStorage.getItem('timeFilter');
    
$(function(){

    if(selected_user == null){
        selected_user = user[0];
        localStorage.setItem('userFilter', selected_user);
    }

    if(selected_time == null){
        selected_time = time[0];
        localStorage.setItem('timeFilter', selected_time);
    }

    

    populateUserFilter();
    populateTimeFilter();
    filterSavings(transactionData);
    populateTiles();
    summaryReportTable();
    updateTotalSavingsChart();
    updateTransactionTable();
    updateSavingsBudgetPlanner();
    

    userFilter.change(function(){
        var selected_user_filter = this.value;
        loadSelectedUserData(selected_user_filter);
    });

    timeFilter.change(function(){
        var selected_time_filter = this.value;
        loadSelectedTimeData(selected_time_filter);
    });

    resetFilter_btn.click(function(){
        localStorage.setItem('userFilter', 'All Users');
        localStorage.setItem('timeFilter', 'default');
        window.location.reload();
    });


    summaryReport_FULL.hide();
    $('#table-div').hide();

    $('#summaryReport-chevron').click(function(){
        var visible = summaryReport_FULL.is(':visible');
        if(visible){
            $('#summaryReport-chevron').removeClass('fa-solid fa-chevron-up');
            $('#summaryReport-chevron').addClass('fa-solid fa-chevron-down');
            summaryReport_FULL.hide();
        }else{
            $('#summaryReport-chevron').removeClass('fa-solid fa-chevron-down');
            $('#summaryReport-chevron').addClass('fa-solid fa-chevron-up');
            summaryReport_FULL.show();
        }
    });

    $('#transactionReport-chevron').click(function(){
        var visible = transactionTable.is(':visible');
        if(visible){
            $('#transactionReport-chevron').removeClass('fa-solid fa-chevron-up');
            $('#transactionReport-chevron').addClass('fa-solid fa-chevron-down');
            $('#table-div').hide();
        }else{
            $('#transactionReport-chevron').removeClass('fa-solid fa-chevron-down');
            $('#transactionReport-chevron').addClass('fa-solid fa-chevron-up');
            $('#table-div').show();
        }
    });

    editSBP_btn.click(function(){
        var values_array = [];
        var html = '';
        $('.edit-sbp-values').each(function(){
            values_array.push($(this).text());
        });

        if(editSBP_btn.text() == 'Edit'){
            editSBP_btn.text('Save');
            editSBP_btn.removeClass('btn-primary');
            editSBP_btn.addClass('btn-success');

        }else{
            editSBP_btn.text('Edit');
            editSBP_btn.removeClass('btn-success');
            editSBP_btn.addClass('btn-primary');
        }


        $('.edit-sbp-values').html(html);

        var title_array = [];
        for(var i=0; i<values_array.length; i++){
            var string = (values_array[i].replaceAll('"','')).split(':');   

            title_array.push(string[0]);
            values_array[i] = parseFloat(string[1]);
        }

        for(var i=0; i<title_array.length; i++){
            var title = title_array[i];
            var value = values_array[i];
            html += '<a class="text-secondary text-sm mb-0">'+title+':</a><input type="number" class="text-dark text-md" style="font-weight: bold;"  value="'+value+'"></input><br>';
        
        }

        $('.edit-sbp-values').html('html');

        for(var i=0; i<values_array.length; i++){
            var title_html = '<a class="text-secondary text-sm">'+title_array[i]+':</a>';
           // var value_html = '<input class="text-dark text-md" style="font-weight: bold;" value="'+values_array.replaceAll('%','')+'"></input>'

        }
       //$('.edit-sbp-values').append(title_html);
    })
    
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
            userFilter.append(option_template);
        }

        //FOR THE TABLE
        var user_header = (user[index]).replaceAll('Me - ', '');
            user_header = user_header.replaceAll('"','');
        if(user_header=='All Users'){
            user_header = 'TOTAL';
        }

        table_html += '<th class="text-lg">'+user_header+'</th>';

    }
    summarReport_header.append(table_html);

    if(selected_user==null){
        userFilter.val('All Users');
    }else{
        userFilter.val(selected_user);
    }
}

function populateTimeFilter(){
    var timeFilter_array =[];
    for (var key in transactionData){
        var obj = transactionData[key];
        var date = (obj.date).split('-'),
            month = parseInt(date[1]),
            day = date[2],
            year = date[0];
        for(var i=0; i<savings_types.length; i++){
            if(transactionData[key].category == 'savings'){
                timeFilter_array[month+' '+year] = obj;
            }
        }
    }
    

    for(var key in timeFilter_array){
        var value = key.split(' '),
            month = month_strings[value[0]-1];
        var option_value = JSON.stringify(month+' '+value[1]),
            option_select = month+' '+value[1];
        
            var option_template = "<option value="+option_value+">"+option_select+"</option>";

            timeFilter.append(option_template);
    }
    timeFilter.val(selected_time);
}
/**
 * FILTERS THE SELECTED DATA
 */
function loadSelectedUserData(user_filter){

    userFilter.val(user_filter);
    localStorage.setItem('userFilter', user_filter);
    window.location.reload();
}
function loadSelectedTimeData(time_filter){

    timeFilter.val(time_filter);
    localStorage.setItem('timeFilter', time_filter);
    window.location.reload();
}
/**
 * FILTER THE VARIABLE EXPENSES ONLY
 */
function filterSavings(transactionData){
    for(var i=0; i<user.length; i++){
        var user_string = (user[i]).replaceAll('"','');
        saving_accounts_data[user_string] = [0,0,0,0,0,0];
        saving_accounts_transactionNum[user_string] = [0,0,0,0,0,0];
        saving_accounts_average[user_string] = [0,0,0,0,0,0];
        savings_expense[user_string] = [0];
    }

        
    //FILTER THE FIXED EXPENSES
    for( var key in transactionData){
        var docData = transactionData[key];
        for(var n = 0; n < savings_types.length; n++){
            var date = (docData.date).split('-');
                date = month_strings[parseInt(date[1])-1]+' '+date[0];
            var selected_time = localStorage.getItem('timeFilter');

            if(selected_time!='default'){ //IF NOT DEFAULT, THEN ONLY GET SPECIFIC DATE BASED ON TIME

                if((savings_types[n].includes(docData.type) && selected_time == date)){
                    docData.savingsIndex = n;
                    All_Savings_DATA.push(docData);
                }

                if((docData.paymentMethod).includes('savings') && selected_time == date){

                    savings_expense[docData.reportedBy][0] += (docData.value/savings_types.length);
                    savings_expense['All Users'][0] += (docData.value/savings_types.length);
                }

            }
            else{ //GET ALL RESULTS
                if(savings_types[n].includes(docData.type)){
                    docData.savingsIndex = n;
                    All_Savings_DATA.push(docData);
                }

                if((docData.paymentMethod).includes('savings')){
                    savings_expense[docData.reportedBy][0] += (docData.value/savings_types.length);
                    savings_expense['All Users'][0] += (docData.value/savings_types.length);
                    console.log('methodsx', savings_types.length)
                }
            }
        }
    }
    
    //STORE VALUES INTO THE OBJECT ARRAY
    for(var i=0 ; i<All_Savings_DATA.length; i++){
        var reporter = All_Savings_DATA[i].reportedBy;
        var index = All_Savings_DATA[i].savingsIndex;

        saving_accounts_data[reporter][index] += All_Savings_DATA[i].value;
        saving_accounts_data['All Users'][index] +=All_Savings_DATA[i].value;

        saving_accounts_transactionNum[reporter][index]++;
        saving_accounts_transactionNum['All Users'][index] ++;

        saving_accounts_average[reporter][index] = saving_accounts_data[reporter][index] / saving_accounts_transactionNum[reporter][index];
        saving_accounts_average['All Users'][index] = saving_accounts_data['All Users'][index] / saving_accounts_transactionNum['All Users'][index];

        //ONCE EVERYTHING IS DONE, WE SUBTRACT THE TOTAL SAVINGS EXPENSE FROM SHORT_TERM SAVINGS
        if(i == All_Savings_DATA.length-1){
            for(var key in savings_expense){
                saving_accounts_data[key][0] -= savings_expense[key];
            }
        }
    }
    
    //CALCULATES TOTAL FOR EACH USER
    for(var key in saving_accounts_data){
        var length = saving_accounts_data[key].length;
        for(var i=0; i<length-1; i++){
            saving_accounts_data[key][length-1] += saving_accounts_data[key][i];
        }
    }
    
}

/**
 * UPDATES THE PANEL TILES FOR EACH SAVINGS ACCOUNT
 */
function populateTiles(){
    for(var i = 0; i < savings_types.length; i++){
        var user_string = selected_user.replaceAll('Me - ', '').split([' ']);
            user_string = user_string[0];
        var account_name = savings_types[i];
        var account_value = numberWithCommas(convertTo2_Decimals(saving_accounts_data[selected_user][i]));
        var account_average = numberWithCommas(convertTo2_Decimals(saving_accounts_average[selected_user][i]));
        var account_reports = numberWithCommas(saving_accounts_transactionNum[selected_user][i]);

        var tile_html = '<div class="col-sm-2" style="width:20%;">'+
                            '<div class="card">'+
                                '<div class="card-body">'+
                                    '<div class="row">'+
                                        '<div class="col mt-0">'+
                                            '<h5 class="card-title">'+account_name+'</h5>'+
                                        '</div>'+
                                        '<div class="col-auto">'+
                                            '<div class="stat text-primary">'+
                                               '<i class="fa-solid fa-'+icons[i]+'"></i>'+
                                            '</div>'+
                                        '</div>'+
                                    '</div>'+
                                    '<h1 class="mt-1 mb-3" id="value">$'+account_value+'</h1>'+
                                    '<div class="mb-0">'+
                                        '<span class="text-muted" id="after-text">'+
                                        '<br>User: '+user_string+
                                        '<br>Average: $'+account_average+
                                        '<br>Reports: '+account_reports+
                                        '</span>'+
                                    '</div>'+
                               '</div>'+
                           '</div>'+
                        '</div>';

    savingsAccounts_Panels.append(tile_html);
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
    
    var savings_header = savings_types;
        savings_header.push('TOTAL');

    for(var vertical = 0; vertical < savings_header.length; vertical++){

        table_template += '<th>'+savings_header[vertical]+'</th>';

        for(var horizontal = user.length-1; horizontal >=0 ; horizontal--){
            var user_string = user[horizontal].replaceAll('"','');
            if(selected_user == user[horizontal].replaceAll('"','')){
                table_template += '<th class="text-lg text-danger" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(saving_accounts_data[user_string][vertical])) + '</th>';
            }else{
                if(vertical==savings_header.length-1){
                    table_template += '<th class="text-lg text-primary" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(saving_accounts_data[user_string][vertical])) + '</th>';
                }
                else{
                    table_template += '<th class="text-sm text-dark" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(saving_accounts_data[user_string][vertical])) + '</th>';
                }
            }
        }
        table_template += '</tr>';
    }
        summaryReport.append(table_template);
}

/**
 * UPDATES THE FIRST DAILY FLOWCHART
 */
function updateTotalSavingsChart(){
    var savings_goal = userData.savings_goal;
    var label = [], value= [ 0 ];
    total_savings_chart_data[selected_user] = [ 0 ];
    var average_line = [ 0 ], median_line = [ 0 ], mean_average = [ 0 ], percent_uptrend_line = [ 0 ], savings_goal_line = [ ];

    //Filter expenses from transactionData
    for(var key in All_Savings_DATA){
        var obj = All_Savings_DATA[key];
        var date = (obj.date).split('-');
            date = month_strings[parseInt(date[1])-1]+' '+date[0];

        
        if(selected_time=='default'){
            var last_value = value[value.length-1];
            value.push(last_value + obj.value);
        }
        else{
            if(selected_time == date){
                var last_value = value[value.length-1];
                value.push(last_value + obj.value);
            }
        }
        label.push('');
        total_savings_chart_data[selected_user] = value;

        var final_val = total_savings_chart_data[selected_user][total_savings_chart_data[selected_user].length-1];
        var median = final_val / 2;
        var average_low = final_val / All_Savings_DATA.length;
        average_line.push(average_low);
        median_line.push(median);
    }

    for(var i = 0; i<All_Savings_DATA.length; i++){
        mean_average[i] = total_savings_chart_data[selected_user][total_savings_chart_data[selected_user].length-1] / 2;

       savings_goal_line.push(savings_goal);
    }

    //TO CALCULATE UPTREND
    for(var i = 1; i<All_Savings_DATA.length; i++){
        var top = All_Savings_DATA[i-1].value;
        var denominator = All_Savings_DATA[i].value;

        if(denominator == 0){
            denominator = 1;
        }
       var uptrend_percent = (top / denominator) / i;
       var uptrend_value = uptrend_percent * total_savings_chart_data[selected_user][All_Savings_DATA.length-1];
       percent_uptrend_line.push(uptrend_value);
    }

    if(percent_uptrend_line[percent_uptrend_line.length-1] > percent_uptrend_line[percent_uptrend_line.length-2]){
        var trend = '<span class="text-success"><i class="fa-solid fa-circle-chevron-up"></i> Uptrend ('+convertTo2_Decimals(uptrend_percent)+'%)</span>';
    }
    else if(percent_uptrend_line[percent_uptrend_line.length-1] < percent_uptrend_line[percent_uptrend_line.length-2]){
        var trend = '<span class="text-danger"><i class="fa-solid fa-circle-chevron-down"></i> Downtrend ('+convertTo2_Decimals(uptrend_percent)+'%)</span>';
    } 
    else if(percent_uptrend_line[percent_uptrend_line.length-1] == percent_uptrend_line[percent_uptrend_line.length-2]){
        var trend = '<span class="text-warning"><i class="fa-solid fa-equals"></i> Neutral ('+convertTo2_Decimals(uptrend_percent)+'%)</span>';
    }

    $('#flowchart-title').html(trend);

            var ctx = document.getElementById("flowChart-left").getContext("2d");
            var gradient = ctx.createLinearGradient(0, 0, 0, 225);
            gradient.addColorStop(0, "rgba(215, 227, 244, 1)");
            gradient.addColorStop(1, "rgba(215, 227, 244, 0)");
        // Line chart
        new Chart(document.getElementById("flowChart-left"), {
            type: "line",
            data: {
                    labels: label,
                    datasets: [{
                        label: "Savings Account Value ($)",
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: window.theme.primary,
                        data: total_savings_chart_data[selected_user],
                        tension: 0,
                        order: 3,
                        pointRadius: 0,
                        borderWidth: 1.5
                    },{
						label: 'Low Average',
                        data: average_line,
                        type: 'line',
                        borderColor: "#FF312D",
                        fill: true,
                        borderWidth: 1,
                        tension: 0,
                        order: 2,
                        pointRadius: 0
					},{
						label: 'Median',
                        data: median_line,
                        type: 'line',
                        borderColor: window.theme.warning,
                        fill: true,
                        borderWidth: 1,
                        tension: 0,
                        order: 2,
                        pointRadius: 0
					},{
						label: 'Mean Average',
                        data: mean_average,
                        type: 'line',
                        borderColor: window.theme.danger,
                        fill: true,
                        borderWidth: 1,
                        tension: 0,
                        order: 2,
                        pointRadius: 0
					},{
						label: 'Increase Trend',
                        data: percent_uptrend_line,
                        type: 'line',
                        borderColor: window.theme.success,
                        fill: true,
                        borderWidth: 1,
                        tension: 0,
                        order: 1,
                        pointRadius: 0
					},{
						label: 'Savings Goal',
                        data: savings_goal_line,
                        type: 'line',
                        borderColor: window.theme.secondary,
                        fill: true,
                        borderWidth: 1,
                        tension: 0,
                        order: 1,
                        pointRadius: 0
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
 * UPDATES THE CHART WITH MULTIPLE LINES
 */
function updateSavingsBudgetPlanner(){
    var income_data = JSON.parse(localStorage.getItem('monthly_income_array'));
    var savings_BudgetPlan = userData.savingsBudget;
    var current_month = new Date().getMonth() +1;
    var final_savings_goal = userData.savings_goal;
    var total_savings = 0;
    var total_income = 0;

    for(var key in income_data){
        var obj_date = key.split('_');
            obj_date = obj_date[0];
        if(obj_date == currentYear){
            total_income += income_data[key].value;
        }
    }

    var total_savings_for_currentYear = 0, total_savings_before_currentYear = 0, monthly_total_savings = 0;

    for( var key in All_Savings_DATA){
        var obj_date = (All_Savings_DATA[key].date).split('-');
        var obj_year = parseInt(obj_date[0]);
        var obj_month = parseInt(obj_date[1]);

        
        total_savings += All_Savings_DATA[key].value;
        if(obj_year == currentYear){
            total_savings_for_currentYear += All_Savings_DATA[key].value;

            if(obj_month == current_month){
                monthly_total_savings += All_Savings_DATA[key].value;
            }
        }
        else{
            total_savings_before_currentYear += All_Savings_DATA[key].value;
        }
        
    }
    
    total_savings -= savings_expense['All Users'];
    //console.log(savings_expense['All Users'], total_savings)
    var monthly_average_income = total_income / current_month;
    var calculate_savings_based_on_income = monthly_average_income * (savings_BudgetPlan/100);
    //monthly_total_savings = 2200;
    var monthly_achievement_percent = 100 - (((calculate_savings_based_on_income - monthly_total_savings) / calculate_savings_based_on_income)*100)

    if(calculate_savings_based_on_income > monthly_total_savings){
        var achievement_icon = '<i class="fa-solid fa-circle-xmark"></i>';
        var monthly_achievement_color = ' <a class="text-danger text-md" style="font-weight: bold;">';
    }
    else if(calculate_savings_based_on_income < monthly_total_savings){
        var achievement_icon = '<i class="fa-solid fa-circle-check"></i>';
        var monthly_achievement_color = ' <a class="text-success text-md" style="font-weight: bold;">';
    }

    var savings_goal_percent = convertTo2_Decimals(100-((final_savings_goal - total_savings)/final_savings_goal)*100) + '%';
    var savings_account_percent = JSON.parse(localStorage.getItem('savings_account_percent'));
    var savings_account_html = '';

    if(savings_account_percent == null){
        var percent_array = [];
        for(var i = 0; i < savings_types.length-1; i++){
            percent_array.push(savings_BudgetPlan / (savings_types.length - 1));
            
            savings_account_html += '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">'+savings_types[i]+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'
                                    +numberWithCommas(convertTo2_Decimals(total_income))+'</a></div>';
        }
        localStorage.setItem('savings_account_percent', JSON.stringify(percent_array));
    }

    for(var i = 0; i < savings_types.length-1; i++){

        savings_account_html += '<div style="border-bottom: 1px solid grey;" class="edit-sbp-values"><a class="text-secondary text-sm">'+savings_types[i]+' %:</a> <a class="text-dark text-md" style="font-weight: bold;"  id="sbp-'+savings_types[i]+'">'
                                +savings_account_percent[i]+'% </a></div>';
    }
    var html = '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm" >Current Savings Plan Percentage: </a><a class="text-primary text-md" style="font-weight: bold;">'+savings_BudgetPlan+'% of monthly income</a></div>'+
                //savings_account_html+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">Total Income in '+currentYear+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(total_income))+'</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">Monthly Average Income in '+currentYear+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(monthly_average_income))+'</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">Monthly Savings Goal in '+currentYear+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(calculate_savings_based_on_income))+' ($'+numberWithCommas(convertTo2_Decimals(calculate_savings_based_on_income/4))+' Weekly)</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">'+'Projected End-of-Year Savings :</a> <a class="text-dark text-lg" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(calculate_savings_based_on_income*12))+'</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">Savings Prior to '+currentYear+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(total_savings_before_currentYear))+'</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">Total Savings in '+currentYear+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(total_savings_for_currentYear))+'</a></div>'+
                
                '<br><div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">'+"This Month's Income ("+month_strings[current_month-1]+') :</a> <a class="text-primary text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(localStorage.getItem('monthly_income_value')))+'</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">'+"This Month's Savings ("+month_strings[current_month-1]+') :</a> <a class="text-primary text-md" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(monthly_total_savings))+' / </a><a class="text-primary text-md" style="font-size:12px;">$'+numberWithCommas(convertTo2_Decimals(parseFloat(localStorage.getItem('monthly_income_value')))*(savings_BudgetPlan/100))+' ('+savings_BudgetPlan+'% of your income)</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">Monthly Goal Achievement:</a>'+monthly_achievement_color+numberWithCommas(convertTo2_Decimals(monthly_achievement_percent))+'% '+achievement_icon+'</a></div>'+'<br>'+
                
                '<br><div style="border-bottom: 1px solid grey;"><a class="text-secondary text-lg">'+'Total Savings Goal :</a> <a class="text-dark text-lg" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(total_savings))+' / '+numberWithCommas(convertTo2_Decimals(final_savings_goal))+' ( '+savings_goal_percent+' )</a></div>'+
                '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-lg">'+'Projected Year-End Savings Goal :</a> <a class="text-dark text-lg" style="font-weight: bold;">$'+numberWithCommas(convertTo2_Decimals(total_savings))+' / '+numberWithCommas(convertTo2_Decimals(calculate_savings_based_on_income*12))+' ( '+convertTo2_Decimals((total_savings/(calculate_savings_based_on_income*12))*100)+'% )</a></div>'+
                '</p>';



    SBP_body.append(html);
}

function updateTransactionTable(){
    var transactionData = All_Savings_DATA;
    var table_body = $('#savings-transaction-table');

    if(selected_user=='All Users'){
        for(var key in transactionData){
            var docData = transactionData[key];

            if(docData.category == 'savings'){
                var title = docData.transaction;
                var date = docData.date;
                var type = docData.type;
                var reportedBy = docData.reportedBy;
                    reportedBy = reportedBy.replaceAll('Me - ','');
                    reportedBy = reportedBy.split(' ');
                    reportedBy = reportedBy[0] + ' ' +reportedBy[reportedBy.length-1][0]+'.';
                var value = docData.value;
                
                var table_template = '<tr>'+
                                        '<td>'+title+'</td>'+
                                        '<td><span class="badge bg-secondary">'+date+'</span></td>'+
                                        '<td class="d-none d-xl-table-cell"> $'+numberWithCommas(convertTo2_Decimals(value))+'</td>'+
                                        '<td><span class="badge bg-success">'+type+'</span></td>'+
                                        '<td class="d-none d-md-table-cell">'+reportedBy+'</td>'+
                                    '</tr>';
                    table_body.append(table_template);
            }
        }
    }
    else{
        for(var key in transactionData){
            var docData = transactionData[key];

            if(docData.category == 'savings' && docData.reportedBy==selected_user){
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
                    
                table_body.append(table_template);  
            }
        }
    }

    $('#transactionTable').DataTable({
        "order": [0, 'des']
    });
}