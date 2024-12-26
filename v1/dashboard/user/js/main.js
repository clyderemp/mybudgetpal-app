import { db, auth } from '../../../js/firebase.js';
import { hyperlink_manager } from '../js/hyperlink-manager.js';
import { loadProfile, sendCoUserDataToProfile } from './profile.js';
import { generateCoUsersTable } from './coUserManager.js'
import { updateAnalytics } from './dashboard-analytics.js';
import { convert_CAD_to_SelectedCurrency, exchange_rate } from './currencyExchange.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, getDocs, collection} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { currencySymbols } from './dataFile.js';
import { renderSidebar } from '../reusables/sidebar.js';
import { loadHeaderComponent } from '../reusables/topbar.js';

//GET ANY SAVED LOCAL STORAGE DATA
export const uid = localStorage.getItem('uid');
export var  userData = await JSON.parse(localStorage.getItem(uid+'-userInfoData')),
            transactionData = await JSON.parse(localStorage.getItem(uid+'-transactionData')),
            coUserData = await JSON.parse(localStorage.getItem(uid+'-coUserData'));


export var transactions, transaction_ID = [];
export var sorted_transactions = [];

//MONTHLY EXPENSE DOC ID
export var monthly_expense_docID = [];
export var monthly_income_docID = [];
export var monthly_savings_docID = [];

// loadHeaderComponent();

const currentPage = (window.location.pathname).toString().split('/');
const pageString = currentPage[currentPage.length-2].toString() + '/' + currentPage[currentPage.length-1];
const showHeaderText = currentPage[currentPage.length-1].toString().includes('index');

renderSidebar(pageString, loadHeaderComponent, showHeaderText);

$(function(){
  hyperlink_manager();

  $(".loader").delay(1000).fadeOut("slow");

  //localStorage.clear();
  try{
    disableFutureDatePicker();
  }catch(err){

  setInterval(updatePageTime, 500);

  }
  $('#refresh-btn').click(function(){
    localStorage.clear();
    localStorage.removeItem(uid+'-transactionData'),
    window.location.reload();
  });

  $('#logout-btn').click(function(){
    logout();
  });
  
    onAuthStateChanged(auth, (user) => {
        if (user) {
          // User is signed in, see docs for a list of available properties
          // https://firebase.google.com/docs/reference/js/auth.user
          const uid = user.uid;
          console.log('Logged in as: '+uid);
          localStorage.setItem('uid', uid);
          
          //LOAD USER DATA
          if(userData==null){
              retrieveUserDataFromFirestore(uid);
              console.log('Retrieved User Data from Firebase Database');
          }
          else{
              retrieveUserDataFromLocalStorage(uid);
              console.log('Retrieved User Data from Local Storage');
          }
          //LOAD TRANSACTIONS
          if(transactionData==null){
            retrieveBudgetDataFromFirestore(uid);
            console.log('Retrieved Transactions Data from Firebase Database');
          }
          else{
            retrieveBudgetDataFromLocalStorage(uid);
            console.log('Retrieved Transactions Data from Local Storage');
          }

          // //LOAD CO USER
          if(coUserData==null){
              retrieveCoUsersDataFromFirebase(uid);
              console.log('Retrieved Co-users Data from Firebase Database');
          }else{
              retrieveCoUsersDataFromLocalStorage(uid);
              console.log('Retrieved Co-users Data from Local Storage');
          }

          /**
           * SEND USER TO DASHBOARD IF LOGGED IN
           */
        }
        else {
            console.log('logged out');
                window.location.replace("../../../index.html");
        }

    });
});

function updatePageTime(){
  var date = new Date();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      minutes = minutes < 10 ? '0'+minutes : minutes;
  var seconds = (new Date()).getSeconds();
      seconds = ("0" + seconds).slice(-2);

  var strTime = hours + ':' + minutes +':'+parseFloat(seconds)+' ' + ampm;

  var date = new Date().toDateString();
  $('#page-time-value').html('<i class="fa-regular fa-clock"></i> Current Time: '+date+' '+strTime)
}
//USER DATA
async function retrieveUserDataFromFirestore(uid){
  
    getDoc(doc(db, "users", uid)).then(async (docSnap) => {
        if (docSnap.exists()) {
          userData = docSnap.data();
          localStorage.setItem(uid+'-userInfoData', JSON.stringify(userData));

          var fname = userData.fname;
          var lname = userData.lname;
          var lastDelete = userData.lastDelete;
          var lastSave = userData.lastSave;
          var exchange_rate = userData.exchange_rate;
          var new_account = userData.new_account;
          var currentPage = window.location.pathname.toString();
          if(exchange_rate ===  undefined){
            exchange_rate = {
              code: 'CAD',
              value: 1,
            }
          }
        await localStorage.setItem('exchange_rate', JSON.stringify(exchange_rate));
          try{
            loadProfile(userData);
          }catch(err){

          }
          //$('#home-Modal').show();
          if(new_account){
            if(!currentPage.includes('settings')){
              $('#home-Modal').show();
              $('#modal-text').html('Welcome!<br>Since your account is new, you will be redirected to a page where you will need to input some information to help us better analyze your data!');
              $('#confirm-new').click(function(){
                  window.location.replace("../settings/user.html");
              })
            }
          }
          loadProfile(userData);
          feedDataToIndexPage(fname, lname, lastDelete, lastSave);
        } else {
          console.log("No such document!");
          signOut(auth);
        }
    });
}

async function retrieveUserDataFromLocalStorage(uid){
  userData = await JSON.parse(localStorage.getItem(uid+'-userInfoData'));
  var fname = userData.fname;
  var lname = userData.lname;
  var lastDelete = userData.lastDelete;
  var lastSave = userData.lastSave;
  var exchange_rate = userData.exchange_rate;
  console.log(userData)
  var new_account = userData.new_account;
  var currentPage = window.location.pathname?.toString();

  if(exchange_rate ===  undefined){
    exchange_rate = {
      code: 'CAD',
      value: 1,
    }
  }
  
  await localStorage.setItem('exchange_rate', JSON.stringify(exchange_rate));
  userData.savings_goal = parseInt(userData.savings_goal) * exchange_rate.value;
  userData.credit_max = parseInt(userData.credit_max) * exchange_rate.value;
  userData.credit_balance = parseInt(userData.credit_balance) * exchange_rate.value;

  if(new_account){
    if(!currentPage.includes('settings')){
      $('#home-Modal').show();
      $('#modal-text').html('Welcome!<br>Since your account is new, you will be redirected to a page where you will need to input some information to help us better analyze your data!');
      $('#confirm-new').click(function(){
          window.location.replace("../settings/user.html");
      })
    }
  }
  loadProfile(userData);
  feedDataToIndexPage(fname, lname, lastDelete, lastSave);
}

//BUDGET DATA
function retrieveBudgetDataFromFirestore(uid){
  var count = 0;

  transactionData = [];
  transactionData.length = count;
  const query = getDocs(collection(db, "users/"+uid+'/transactions'));
  if(!query.empty){
    query.then(function(query) {
      query.forEach(doc => {
        count++;
          transactionData.length = count;
          transactionData[doc.id] = (doc.data());
          transactionData[doc.id].creation_date = (doc.data().creation_date.toDate()).toISOString();
          
      });

    }).then(function(){
      var arr = [];
      for( var key in transactionData){
        //transactionData[key].value *= exchange_rate;
        arr.push(transactionData[key]);
      }
      //SORTS THE RECENT FIRST
      arr.sort(function(a, b) {
        var keyA = new Date(a.creation_date),
          keyB = new Date(b.creation_date);
        // Compare the 2 dates
        if (keyA < keyB) return 1;
        if (keyA > keyB) return -1;
        return 0;
      });
    
      sorted_transactions = arr;
      localStorage.setItem(uid+'-transactionData', JSON.stringify(sorted_transactions));
      updateAnalytics(sorted_transactions);
    });
  }
}
function retrieveBudgetDataFromLocalStorage(uid){
  var count = 0;
  transactionData = [];
  transactionData.length = count;
  
  transactionData = JSON.parse(localStorage.getItem(uid+'-transactionData'));
      var arr = []
      for( var key in transactionData){
        //transactionData[key] *= exchange_rate;
        arr.push(transactionData[key]);
      }
      //SORTS THE RECENT FIRST
      arr.sort(function(a, b) {
        var keyA = new Date(a.creation_date),
          keyB = new Date(b.creation_date);
        // Compare the 2 dates
        if (keyA < keyB) return 1;
        if (keyA > keyB) return -1;
        return 0;
      });
    
      sorted_transactions = arr;
      localStorage.setItem(uid+'-transactionData', JSON.stringify(sorted_transactions));
      updateAnalytics(sorted_transactions);
}

//CO-USER DATA
function retrieveCoUsersDataFromFirebase(uid){
  var count = 0;
  coUserData = {};
  const query = getDocs(collection(db, "users/"+uid+'/co_users'));
  
    if(!query.empty){
          
      query.then(function(query) {
              
        query.forEach(doc => {
            count++;
            coUserData[doc.id] = doc.data();
            //coUserData.length = count;
        });
        localStorage.setItem(uid+'-coUserData', JSON.stringify(coUserData));
        generateCoUsersTable(coUserData);
        sendCoUserDataToProfile(coUserData);
      })
      
    }
    
}
function retrieveCoUsersDataFromLocalStorage(uid){
    coUserData = JSON.parse(localStorage.getItem(uid+'-coUserData'));
    sendCoUserDataToProfile(coUserData);
    generateCoUsersTable(coUserData);
}

function feedDataToIndexPage(fname, lname, lastDelete, lastSave){
    //CAPITALIZE FIRST LETTER
    fname = fname.toLowerCase().replace(/\b[a-z]/g, function(letter) {
        return letter.toUpperCase();
    });
    lname = lname.toLowerCase().replace(/\b[a-z]/g, function(letter) {
        return letter.toUpperCase();
    });

    localStorage.setItem('fullname',fname+' '+lname); 
    $('#leftnavbar-title').text('Welcome Back, '+fname+'!');
    $("#topright-title").text(fname+' '+lname);

    $('#last-save-txt').append(lastSave);
    $('#last-delete-txt').append(lastDelete);
}

function logout(){
  localStorage.clear();
  signOut(auth);
}

function disableFutureDatePicker(){
  var today = new Date();
        $('.datepicker').datepicker({
            dateFormat: 'yy-mm-dd',
            autoclose:true,
            endDate: "today",
            maxDate: today
        }).on('changeDate', function (ev) {
          console.log(this.value);
                $(this).datepicker('hide');
        });


}
