import { db } from '../../../js/firebase.js';
import { userData, coUserData } from './main.js';
import { expense_types, income_types, credit_types, savings_types } from '../js/dataFile.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import { doc, setDoc, getDocs, updateDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { convertTo2_Decimals, numberWithCommas } from './dashboard-analytics.js';

export const type = [];

export var co_users_data = JSON.parse(localStorage.getItem('co_users_data'));
export var co_users_id = JSON.parse(localStorage.getItem('co_users_id'));

let exchange_rate = JSON.parse(await localStorage.getItem('exchange_rate'));
    exchange_rate = exchange_rate?.value;


var uid, fname, lname,
    creation_date = new Date();

$(function(){
    itemIDGenerator();
    
    setInterval(function(){

        var value = numberWithCommas(convertTo2_Decimals($('#add-value').val() / exchange_rate));
        localStorage.setItem('converted_value', value);
        $('#exchangeRate').text(parseFloat(exchange_rate).toFixed(2));
        $('#add-exchangeValue').text(value);
        $('#exchangeValue').html(numberWithCommas(convertTo2_Decimals(($('#add-value').val())/exchange_rate)));
    }, 500);

    var currentPage = window.location.pathname.toString();

    if(currentPage.includes('report/add.html')){
        populateReporter();
    }
    $('#reportedBy-other').click(function(){
        $('#otherReporter-name').prop("disabled", false);
    });

    /**
     * IF EXPENSE IS CLICKED, DO THIS
     */
    $('#add-category').change(function(){

        if($('#add-category').val() == "expenses"){
            populateType(expense_types);
            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }
        else if($('#add-category').val() == "savings"){
            populateType(savings_types);

            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }else if($('#add-category').val() == "income"){
            populateType(income_types);

            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }else if($('#add-category').val() == "credit"){
            populateType(credit_types);

            $('#type-card').removeAttr('hidden');
            $('#type-card').show();
        }
        else{
            $('#type-card').hide();
        }
    });

    /**IF ADD NEW PERSON IS CLICKED*/
    $('#add-reportedBy').change(function(){
        if($('#add-reportedBy').val() == "ADD NEW PERSON"){
            $('#otherReporter-name').removeAttr('hidden');
            $('#otherReporter-name').show();
        }
        else{
            $('#otherReporter-name').hide();
        }
    });


    $('#add-submitReport').click(function(){

        var title = $('#add-title').val();
        var note = $('#add-note').val();
        var category = $('#add-category').val();
        var type = $('#add-type').val();
        var value = $('#add-value').val() / exchange_rate;
        if(!isFinite(value)){
            value=0;
        }
        var date = $('#add-date').val();
        var reporter = $('#add-reportedBy').val();
        var paymentMethod = $('#add-paymentMethod').val();

        var id = localStorage.getItem('item_id');
        creation_date = new Date();
        var docData = {
            item_id: id,
            transaction: title,
            note: note,
            date: date,
            category: category,
            type: type,
            value: value,
            reportedBy: reporter,
            paymentMethod: paymentMethod,
            creation_date: creation_date,
            exchange_rate: exchange_rate? exchange_rate : 1,
        }

        

        const auth = getAuth();
        onAuthStateChanged(auth, (user) => {
            if (user) {
            // User is signed in, see docs for a list of available properties
            // https://firebase.google.com/docs/reference/js/auth.user
            uid = user.uid;
            fname = user.fname;
            lname = user.lname;

            //console.log(uid, month, day, year, docData)
            saveReportToDB(id, uid, docData);
            }
            else {
                console.log('logged out');
                    window.location.href = "../../index.html";
            }
        });

    });

});

/**
 * SAVE DATA TO FIRESTORE
 */
function saveReportToDB(item_id, uid, docData){
    localStorage.removeItem(uid+'-transactionData');
    var lastSave = (new Date()).toDateString().split(' ').slice(1).join(' ');
    var lastSaveData = {
        lastSave: lastSave
    }
    updateDoc(doc(db, "users/"+uid ), lastSaveData);
    setDoc(doc(db, "users/"+uid+"/transactions/", item_id ), docData)
                .then(function(){
                window.alert("Report Saved!");
                window.location.href = "transactions-report.html";
                }).catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    window.alert(errorMessage);
    });
}

/**
 * GENERATE RANDOM ITEM ID
 */
function itemIDGenerator(){
    var d = new Date(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    var fulldate = [year, month, day].join('-');

    $('#add-date').val(fulldate);

    var item_id =  fulldate+"10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
    localStorage.setItem('item_id', item_id);
    $('#item_id').text(item_id);
}
/**
 * MAINLY HANDLE THE POPULATION OF THE EXPENSE CATEGORY
 */
export function populateType(category_type){
    var type = [];
        type = category_type;
        $('#add-type').html('<option value="N/A" selected>Select the type</option>');
        $('#edit-type').html('<option value="N/A" selected>Select the type</option>');
   for(var index = 0; index < type.length; index++){
        var option_template = "<option value="+JSON.stringify(type[index])+">"+type[index]+"</option>";
        $('#add-type').append(option_template);
        $('#edit-type').append(option_template);
   }
}
/**
 * POPULATE THE USERS AND CO USERS
 */
export async function populateReporter(){
    var user = userData;
        user = user.fname + ' '+ user.lname;
    const reporter = [
        "Me - "+user,
   ]

   for(var key in coUserData){
    var data = coUserData[key];
    var fname = data.fname,
        lname = data.lname,
        co_users = fname+' '+lname;
                       
        //ADD TO ARRAY
        reporter.push(co_users);
        
   }

   for(var index = 0; index < reporter.length; index++){
        var option_template = "<option value="+JSON.stringify(reporter[index])+">"+reporter[index]+"</option>";

        $('#add-reportedBy').append(option_template);
        $('#edit-reportedBy').append(option_template);

        $('#add-reportedBy').val(reporter[0]);
    }
}