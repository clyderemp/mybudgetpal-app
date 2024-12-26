import { db } from '../../..//js/firebase.js';
import { expense_types, income_types, savings_types, credit_types } from '../js/dataFile.js';
import { populateType, populateReporter } from '../js/add.js';
import { collection, doc, setDoc, addDoc, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { transactionData } from './main.js';
import { convertTo2_Decimals, numberWithCommas } from './dashboard-analytics.js';


//FOR MONTHS
export const month_strings = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
export const month_strings_for_LINEGRAPH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];

var transactions =  JSON.parse(localStorage.getItem('transactions'));

let exchange_rate = null;

$(function(){

    setTimeout(async function(){
        populateReporter();
        var item_id = localStorage.getItem('selected_item');
        exchange_rate = JSON.parse(await localStorage.getItem('exchange_rate'));
        loadEditPage(item_id);
       }, 500);

    setInterval(function(){
        var value = numberWithCommas(convertTo2_Decimals($('#edit-value').val() / exchange_rate));
        localStorage.setItem('converted_value', value);
        $('#exchangeRate').text(parseFloat(exchange_rate).toFixed(2));
        $('#edit-exchangeValue').text(value);
    }, 500);

    $('#edit-category').change(function(){

        if($('#edit-category').val() == "expenses"){
            populateType(expense_types);
            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }
        else if($('#edit-category').val() == "savings"){
            populateType(savings_types);

            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }else if($('#edit-category').val() == "income"){
            populateType(income_types);

            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }else if($('#edit-category').val() == "credit"){
            populateType(credit_types);

            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }
        else{
            $('#type-card').hide();
        }
    });

    $('#edit-item-submitReport').click(function(){
        var item_id = $('#edit-itemID').val();
        var title = $('#edit-title').val();
        var note = $('#edit-note').val();
        var category = $('#edit-category').val();
        var type = $('#edit-type').val();
        var value = numberWithCommas(convertTo2_Decimals($('#edit-value').val() /exchange_rate));
            
        if(!isFinite(value)){
            value=0;
        }

        var paymentMethod = $('#edit-paymentMethod').val();
        var date = ($('#edit-date').val()).toString(),
            dateSplit = date.split("-"),
            month = dateSplit[1],
            day = dateSplit[2],
            year = dateSplit[0];
        var reporter = $('#edit-reportedBy').val();
        var uid = localStorage.getItem('uid');
        var docData = {
            item_id: item_id,
            transaction: title,
            note: note,
            date: date,
            category: category,
            type: type,
            value: ($('#edit-value').val() /exchange_rate),
            reportedBy: reporter,
            paymentMethod: paymentMethod,
            exchange_rate: exchange_rate? exchange_rate : 1,
        }
        saveEditReportToDB(item_id, uid, docData);
    });
});

function loadEditPage(item_id){
        try{
            for(var key in transactionData){
                var docData = transactionData[key];
                if(docData.item_id == item_id){
                    var title = docData.transaction;
                    var note = docData.note;
                    var date = docData.date;
                    var value = docData.value * docData.exchange_rate;
                    exchange_rate = docData.exchange_rate;
                    var category = docData.category;
                    var paymentMethod = docData.paymentMethod;
                    var type = docData.type;
                    var reportedBy = docData.reportedBy;
                        
                        if(category == "expenses"){
                            populateType(expense_types);
                            $('#edit-type-card').removeAttr('hidden');
                            $('#edit-type-card').show();
                        }
                        else if(category == "savings"){
                            populateType(savings_types);
                
                            $('#edit-type-card').removeAttr('hidden');
                            $('#edit-type-card').show();
                        }else if(category == "income"){
                            populateType(income_types);
                
                            $('#edit-type-card').removeAttr('hidden');
                            $('#edit-type-card').show();
                        }else if(category == "credit"){
                            populateType(credit_types);
                
                            $('#edit-type-card').removeAttr('hidden');
                            $('#edit-type-card').show();
                        }
                        $('#edit-itemID').val(item_id);
                        $('#edit-title').val(title);
                        $('#edit-note').val(note);
                        $('#edit-date').val(date);
                            localStorage.setItem('input-date', date);
                        $('#edit-value').val(value);
                        $('#edit-paymentMethod').val(paymentMethod);
                        $('#edit-type').val(type);
                        $('#edit-category').val(category);
                        $('#edit-reportedBy').val(reportedBy);
                    }
            }
        }
        catch(err){
            console.log(err);
            //window.location.replace('transactions-report.html');
        }
}
/**
 * SAVE DATA TO FIRESTORE
 */
function saveEditReportToDB(item_id, uid, docData){

    localStorage.removeItem(uid+'-transactionData');
    var lastEdit = (new Date()).toDateString();
    var lastEditData = {
        lastEdit: lastEdit
    }
    updateDoc(doc(db, "users/"+uid ), lastEditData);
    updateDoc(doc(db, "users/"+uid+"/transactions/", item_id ), docData)
                .then(function(){
                window.alert("Edit Saved!");
                window.location.href = "transactions-report.html";

                }).catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    window.alert(errorMessage);
    });
}
