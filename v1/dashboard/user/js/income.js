import { income_types, month_strings, month_strings_for_LINEGRAPH } from "./dataFile.js";
import { coUserData, sorted_transactions, transactionData, userData } from "./main.js";
import { convertTo2_Decimals, numberWithCommas, monthly_income_array, isInfinite} from './dashboard-analytics.js';
import { currency } from "./currencyExchange.js";

var icons = ['basket-shopping', 'vault', 'truck-medical' , 'person-cane'];

var resetFilter_btn = $('#reset-filter-btn');

var summaryReport_FULL = $('#summaryTable-FULL');
var summaryReport_header = $('#summaryReport-header');
var summaryReport = $('#summaryTable');
var summaryReport_values = {};
var summaryReport_types = [];

var transactionTable = $('#transactionTable');

var userFilter = $('#userFilter'),
    timeFilter = $('#timeFilter');

const user = [$('#userFilter-allUsers').val()];
const time = [$('#timeFilter-default').val()]

const total_income_panel = $('#total-income-panel');
const SBP_header = $('#credits-budget-planner-header');
const SBP_body = $('#credits-budget-planner-body');
const editSBP_btn = $('#edit-sbp');

    var All_income_DATA = [];
    var user_income_data = [];

    var total_income = 0;

    var currentYear = new Date().getFullYear();
    var date = new Date().toDateString();

    var selected_user = localStorage.getItem('userFilter');
    var selected_time = localStorage.getItem('timeFilter');
    
let exchange_rate = JSON.parse(await localStorage.getItem('exchange_rate'));
    exchange_rate = exchange_rate.value;

$(async function(){

    

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
    filterIncome(transactionData);
    populateTiles();
    incomeType_barChart();
    //summaryReportTable();
    //updateTotalCreditsChart();
    //updateTransactionTable();
    //updateMonthlyCreditUsageChart();
    

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
    $('#table-div').show();
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
        var visible = $('#table-div').is(':visible');
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
    summaryReport_header.append(table_html);

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

        for(var i=0; i<income_types.length; i++){
            if(obj.category.includes('income')){
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
function filterIncome(transactionData){

    for(var i=0; i<user.length; i++){
        var user_string = ((user[i]).replaceAll('Me - ','')).replaceAll('"','');
        user_income_data[user_string] = 0;
    }

    
    //FILTER THE FIXED EXPENSES
    for( var key in transactionData){
        var docData = transactionData[key];
            var date = (docData.date).split('-');
                date = month_strings[parseInt(date[1])-1]+' '+date[0];
            var selected_time = localStorage.getItem('timeFilter');
            if(selected_time!='default'){ //IF NOT DEFAULT, THEN ONLY GET SPECIFIC DATE BASED ON TIME
                if(selected_time == date){
                    if(docData.category == 'income' && docData.paymentMethod == 'debit'){
                        docData.incomeIndex = key;
                        All_income_DATA.push(docData);
                    }
                }
            }
            else{ //GET ALL RESULTS
                if(docData.category == 'income' && docData.paymentMethod == 'debit'){
                    docData.incomeIndex = key;
                    All_income_DATA.push(docData);
                }
            }
    }

    
    for(var i=0; i< All_income_DATA.length; i++){
        var docData = All_income_DATA[i];
        var type = docData.type;
        var reporter = docData.reportedBy;
        
        //INITIALIZe THE OBJECT ARRAY
        if(summaryReport_values[reporter] == undefined){
            summaryReport_values[reporter] = []
            summaryReport_values[reporter]['TOTAL'] = 0;
        }
        else{
            summaryReport_values[reporter]['TOTAL'] += docData.value;
        }

        if(summaryReport_values['All Users'] == undefined){
            summaryReport_values['All Users'] = []
            summaryReport_values['All Users']['TOTAL'] = 0;
        }
        else{
            summaryReport_values['All Users']['TOTAL'] += docData.value;
        }

        if(isInfinite(summaryReport_values[reporter][type])){
            summaryReport_values[reporter][type] = 0;
        }
        else{
            summaryReport_values[reporter][type] += docData.value;
        }

        if(isInfinite(summaryReport_values['All Users'][type])){
            summaryReport_types.push(type);
            summaryReport_values['All Users'][type] = 0;
        }
        else{
            summaryReport_values['All Users'][type] += docData.value;
        }

    }

}

/**
 * UPDATES THE PANEL TILES FOR EACH credits ACCOUNT
 */ 
function populateTiles(){
    var user_income_total = '';
    total_income = summaryReport_values['All Users']['TOTAL'];
    for(var i = 0; i < user.length; i++){
        
        var user_string = selected_user.replaceAll('Me - ', '').split([' ']);
            user_string = user_string[0];
        var fname = ((user[i]).replaceAll('"', '')).replaceAll('Me - ', '');
            fname = (fname);

        if(i==0){
            user_income_total += ('<ul><li>'+fname+': '+numberWithCommas(convertTo2_Decimals(summaryReport_values['All Users']['TOTAL'] * exchange_rate))+' '+currency);
        }
        else{
            user_income_total += ('<li>'+fname+': '+numberWithCommas(convertTo2_Decimals(summaryReport_values[((user[i]).replaceAll('"', ''))]['TOTAL'] * exchange_rate))+' '+currency);
        }

    }
            
    if(timeFilter.val() == 'default'){
        var time_generated_for = 'This report reflects for all reported data.';
    }
    else{
        var time_generated_for = 'Report is generated ONLY for '+timeFilter.val()+'.';
    }

        var tile_html = '<div class="col-sm-12">'+
                            '<div class="card">'+
                                '<div class="card-body">'+
                                    '<div class="row">'+
                                        '<div class="col mt-0">'+
                                            '<h5 class="card-title">All-Time Report Income</h5>'+
                                        '</div>'+
                                        '<div class="col-auto">'+
                                            '<div class="stat text-primary">'+
                                               '<i class="fa-solid fa-dollar-sign"></i>'+
                                            '</div>'+
                                        '</div>'+
                                    '</div>'+
                                    '<h1 class="mt-1 mb-3" id="value">$'+numberWithCommas(convertTo2_Decimals(total_income * exchange_rate))+'<a class="text-sm text-primary"> / (Average: $'+numberWithCommas(convertTo2_Decimals((total_income*exchange_rate)/All_income_DATA.length))+')</a></h1>'+
                                    '<div class="mb-0">'+
                                        '<span class="text-muted" id="after-text"><p>'+
                                        '<ul>Total Income Reports: '+numberWithCommas(parseInt(All_income_DATA.length))+' reports<br>'+
                                        user_income_total+'</ul><br>'+
                                        time_generated_for+
                                        '</p></span>'+
                                    '</div>'+
                               '</div>'+
                           '</div>'+
                        '</div>';
    total_income_panel.append(tile_html);
    //}

}

function incomeType_barChart(){
    var barchart_values = [];
    for(var i=0; i<income_types.length; i++){

        barchart_values[i] = (summaryReport_values[selected_user][income_types[i]])*exchange_rate;
    }

    if(selected_time == 'default'){
        selected_time = 'All-time';
    }

    if(selected_user == 'All Users'){
        selected_user = "All Users'"
    }
    else{
        selected_user = (selected_user.replaceAll('Me - ','')).split(" ");
        selected_user = selected_user[0]+"'s"
    }

    new Chart(document.getElementById("barChart"), {
        type: "bar",
        data: {
            labels: income_types,
            datasets: [{
                label: selected_user+" income for "+selected_time,
                backgroundColor: window.theme.primary,
                borderColor: window.theme.primary,
                hoverBackgroundColor: window.theme.primary,
                hoverBorderColor: window.theme.primary,
                data: barchart_values,
                barPercentage: .75,
                categoryPercentage: .5
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
                        stepSize: 5000
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
/**
 * POPULATE THE SUMMARY TABLE
 */
function summaryReportTable(){

    if(selected_time!='default'){
        $('#transaction-table-header').append(' ('+selected_time+')')
    }
    var table_template = '<tr>';

    var table_template = '<tr>';

    var credits_header = summaryReport_types;
        credits_header.push('TOTAL');

    for(var vertical = 0; vertical < credits_header.length; vertical++){
        if(!credits_header[vertical].includes('Credit Payments')){
            table_template += '<th>'+credits_header[vertical]+'</th>';
            for(var horizontal = user.length-1; horizontal >=0 ; horizontal--){
                
                var user_string = user[horizontal].replaceAll('"','');
                try{
                    var type_val = summaryReport_values[user_string][credits_header[vertical]];
                        if(isInfinite(type_val)){
                            type_val = 0;
                        }
                }catch(err){
                    var type_val = 0;
                }

                if(selected_user == user[horizontal].replaceAll('"','')){
                    table_template += '<th class="text-lg text-danger" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(type_val)) + '</th>';
                }else{
                    if(vertical==credits_header.length-1){
                        table_template += '<th class="text-lg text-primary" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(type_val)) + '</th>';
                    }
                    else{
                        table_template += '<th class="text-sm text-dark" style="text-align: left;"> $' + numberWithCommas(convertTo2_Decimals(type_val)) + '</th>';
                    }
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
function updateTotalCreditsChart(){
    var credits_goal = userData.credits_goal;
    var label = [], value= [ 0 ];
    total_credits_chart_data[selected_user] = [ 0 ];
    var median_line = [ 0 ], mean_average = [ 0 ];
    var total_credit = 0;

    //Filter expenses from transactionData
    for(var key in All_income_DATA){
        var obj = All_income_DATA[key];
        var date = (obj.date).split('-');
            date = month_strings[parseInt(date[1])-1]+' '+date[0];
        total_credit += obj.value;
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
        total_credits_chart_data[selected_user] = value;

        var final_val = total_credits_chart_data[selected_user][total_credits_chart_data[selected_user].length-1];
        var median = final_val / 2;
        median_line.push(median);
    }

    for(var i = 0; i<All_income_DATA.length; i++){

        var mean = total_credit / 2;
        mean_average[i] = (mean);
    }
    //TO CALCULATE USAGE RATE
    var expenses_reports = 0;
    for(var i = 1; i<transactionData.length; i++){
        var category = transactionData[i].category;
        if(category == 'expenses');{
            expenses_reports++;
        }

       var usage_percent = (All_income_DATA.length / expenses_reports) * 100;
    }

    var trend = '<span class="text-success"><i class="fa-solid fa-circle-check"></i> Usage Rate ('+convertTo2_Decimals(usage_percent)+'%)</span>';


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
                        label: "All-time Total Credit Usage ($"+numberWithCommas(convertTo2_Decimals(total_credits_chart_data[selected_user][credit_balance_behaviour.length-1]))+')',
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: window.theme.primary,
                        data: total_credits_chart_data[selected_user],
                        tension: 0,
                        order: 3,
                        pointRadius: 0
                    },{
						label: 'Credit Balance ($'+numberWithCommas(convertTo2_Decimals(credit_balance_behaviour[credit_balance_behaviour.length-1]))+')',
                        data: credit_balance_behaviour,
                        type: 'line',
                        borderColor: "#FF312D",
                        fill: false,
                        borderWidth: 1,
                        tension: 0,
                        order: 2,
                        pointRadius: 0
					},{
						label: 'Median ($'+numberWithCommas(convertTo2_Decimals(median_line[median_line.length-1]))+')',
                        data: median_line,
                        type: 'line',
                        borderColor: window.theme.warning,
                        fill: false,
                        borderWidth: 1,
                        tension: 0,
                        order: 2,
                        pointRadius: 0
					},{
						label: 'Mean ($'+numberWithCommas(convertTo2_Decimals(mean_average[mean_average.length-1]))+')',
                        data: mean_average,
                        type: 'line',
                        borderColor: window.theme.danger,
                        fill: false,
                        borderWidth: 1,
                        tension: 0,
                        order: 2,
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
function updateMonthlyCreditUsageChart(){

    SBP_header.html(currentYear+"'s ");
    var income_array = [];
    var income_data = JSON.parse(localStorage.getItem('monthly_income_array'));
    var credits_BudgetPlan = userData.creditsBudget;
    var current_month = new Date().getMonth() +1;
    var final_credits_goal = userData.credits_goal;
    var total_credits = 0;

    var total_income = 0;
    for(var key in income_data){
        
        var obj_date = key.split('_');
            obj_date = obj_date[0];
        if(obj_date == currentYear){
            var month = key.split('_');
                month = month[1];
            for(var index=0; index<month_strings.length; index++){
                if(month == month_strings[index]){
                    monthly_income_array[index] = (income_data[key]);
                    income_array[index] = (income_data[key]).value;
                }
            }
            total_income += income_data[key];
        }
    }

   // console.log(month_strings_for_LINEGRAPH);

    var total_credits_for_currentYear = 0, total_credits_before_currentYear = 0, monthly_total_credits = 0;
    var credit_array = [];
    for( var key in All_income_DATA){
        var obj_date = (All_income_DATA[key].date).split('-');
        var obj_month = parseInt(obj_date[1]);
        var obj_year = obj_date[0];

        total_credits += All_income_DATA[key].value;
        if(obj_year == currentYear){
            total_credits_for_currentYear += All_income_DATA[key].value;

            if(isInfinite(credit_array[obj_month-1])){
                credit_array[obj_month-1] = 0;
            }
            else
                credit_array[obj_month-1] += All_income_DATA[key].value;

            //CHECK CURRENT MONTH CREDIT VALUES
            if(obj_month == current_month){
                monthly_total_credits += All_income_DATA[key].value;
            }
        }
        else{
            total_credits_before_currentYear += All_income_DATA[key].value;
        }
    }

    
    var monthly_average_income = total_income / current_month;
    var calculate_credits_based_on_income = monthly_average_income * (credits_BudgetPlan/100);
    var monthly_achievement_percent = 100 - (((calculate_credits_based_on_income - monthly_total_credits) / calculate_credits_based_on_income)*100)

    if(calculate_credits_based_on_income > monthly_total_credits){
        var achievement_icon = '<i class="fa-solid fa-circle-xmark"></i>';
        var monthly_achievement_color = ' <a class="text-danger text-md" style="font-weight: bold;">';
    }
    else if(calculate_credits_based_on_income < monthly_total_credits){
        var achievement_icon = '<i class="fa-solid fa-circle-check"></i>';
        var monthly_achievement_color = ' <a class="text-success text-md" style="font-weight: bold;">';
    }

    var credits_goal_percent = convertTo2_Decimals(100-((final_credits_goal - total_credits)/final_credits_goal)*100) + '%';
    var credits_account_percent = JSON.parse(localStorage.getItem('credits_account_percent'));
    var credits_account_html = '';

    if(credits_account_percent == null){
        var percent_array = [];
        for(var i = 0; i < credit_types.length-1; i++){
            percent_array.push(credits_BudgetPlan / (credit_types.length - 1));
            
            credits_account_html += '<div style="border-bottom: 1px solid grey;"><a class="text-secondary text-sm">'+credit_types[i]+':</a> <a class="text-dark text-md" style="font-weight: bold;">$'
                                    +numberWithCommas(convertTo2_Decimals(total_income))+'</a></div>';
        }
        localStorage.setItem('credits_account_percent', JSON.stringify(percent_array));
    }

    for(var i = 0; i < credit_types.length-1; i++){

        credits_account_html += '<div style="border-bottom: 1px solid grey;" class="edit-sbp-values"><a class="text-secondary text-sm">'+credit_types[i]+' %:</a> <a class="text-dark text-md" style="font-weight: bold;"  id="sbp-'+credit_types[i]+'">'
                                +credits_account_percent[i]+'% </a></div>';
    }
    
        new Chart(document.getElementById("barChart-right"), {
            type: "bar",
            data: {
                labels: month_strings_for_LINEGRAPH,
                datasets: [{
                    label: "Income in "+currentYear,
                    backgroundColor: window.theme.primary,
                    borderColor: window.theme.primary,
                    hoverBackgroundColor: window.theme.primary,
                    hoverBorderColor: window.theme.primary,
                    data: income_array,
                    barPercentage: .75,
                    categoryPercentage: .5
                }, {
                    label: "Credit in "+currentYear,
                    backgroundColor: window.theme.success,
                    borderColor: window.theme.success,
                    hoverBackgroundColor: window.theme.success,
                    hoverBorderColor: window.theme.success,
                    data: credit_array,
                    barPercentage: 1.0,
                    categoryPercentage: 0.75
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
                            stepSize: 500
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

function updateTransactionTable(){
    var transactionData = All_income_DATA;
    var table_body = $('#credits-transaction-table');

    if(selected_user=='All Users'){
        for(var key in transactionData){
            var docData = transactionData[key];

            //if(docData.category == 'credits'){
                var title = docData.transaction;
                var date = docData.date;
                var type = docData.type;
                var reportedBy = docData.reportedBy;
                    reportedBy = (reportedBy.replaceAll('Me - ','')).split(' ');
                    reportedBy = reportedBy[0] + ' ' + reportedBy[1][0]+'.';
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
    else{
        for(var key in transactionData){
            var docData = transactionData[key];

            if(docData.reportedBy==selected_user){
                var title = docData.transaction;
                var date = docData.date;
                var type = docData.type;
                var reportedBy = docData.reportedBy;
                    reportedBy = (reportedBy.replaceAll('Me - ','')).split(' ');
                    reportedBy = reportedBy[0] + ' ' + reportedBy[reportedBy.length-1][0]+'.';
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
        "order": [1, 'des']
    });
}