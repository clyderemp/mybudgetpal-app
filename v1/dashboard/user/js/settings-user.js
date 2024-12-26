import { db, auth } from '../../../js/firebase.js'
import { signInWithEmailAndPassword, getAuth, updateEmail, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, getDocs, updateDoc, deleteDoc, collection} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { userData, uid } from './main.js';

var totalBudget = 0,
    expenseBudget = 0,
    savingsBudget = 0,
    creditPaymentBudget = 0;

$(function(){
  retrieveDataForSettings();  
    $('#settings-submit').click(function(){
      $('input:required').each(function() {
        if ($(this).val() === ''){
              $(this).css('border-color', 'red');

        }else{
            var uid = $('#settings-uid').val(),
                fname = $('#settings-fname').val(),
                lname = $('#settings-lname').val(),
                email = $('#settings-email').val(),
                dob = $('#settings-dob').val(),
                expenseBudget = parseInt($('#settings-expenseBudget').val()),
                savingsBudget = parseInt($('#settings-savingsBudget').val()),
                creditPaymentBudget = parseInt($('#settings-creditPaymentBudget').val()),
                savings = $('#settings-savings').val(),
                credit = $('#settings-credit').val(),
                credit_max = $('#settings-creditMAX').val();

                totalBudget = expenseBudget + savingsBudget + creditPaymentBudget;
                if(!isFinite(totalBudget)){
                  totalBudget=0;
                }

            var docData = {
                fname: fname,
                lname: lname,
                email: email,
                dob: dob,
                expenseBudget: expenseBudget,
                savingsBudget: savingsBudget,
                creditPaymentBudget: creditPaymentBudget,
                savings_goal: savings,
                credit_balance: credit,
                credit_max: credit_max,
                new_account: false
            }
            
            if(totalBudget==100){
              saveEditReportToDB(uid, docData);
              updateUsersEmail(email);
            }
            else{
              $('#total-budget').text(totalBudget+'%');
              $('#settings-expenseBudget').css('border-color', 'red');
              $('#settings-savingsBudget').css('border-color', 'red');
              $('#settings-creditPaymentBudget').css('border-color', 'red');
              //window.alert('Total budget percentage does not add up to 100%');
            }
          }
        });
    });

    $('#delete-account').click(function(){
        // Get the modal
        var modal = document.getElementById("SettingsModal");

        var span = document.getElementsByClassName("cancel-btn")[0];

        modal.style.display = "block";

        span.onclick = function() {
        modal.style.display = "none";
        }

        window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
        }
        $('#settings-modalQuestion').text("Are you sure you would like to PERMANENTLY delete your account?");
      
    });

    $('#confirm-account-delete').click(function(){
      console.log('confirmed')
      var email = $('#settings-email').val();
      var password = $('#settings-password').val();

      signInWithEmailAndPassword(auth, email, password).then((userCredential) => {
            // Signed in 
            const auth = getAuth();
            const user = auth.currentUser;
            const uid = user.uid;
            localStorage.setItem('uid',uid);
            getDoc(doc(db, "users/", uid)).then(doc => {
              if (doc.exists()) {
                var docRef = collection(db, "users/"+uid+"/transactions");
                const query = getDocs(docRef);
                console.log('here')
                if(!query.empty){
                  query.then(function(query) {
                    query.forEach(doc => {
                      var uid = localStorage.getItem('uid');
                      deleteUserData('users/'+uid+"/transactions/", doc.id);
                    });
                  });
                }
              }
            }).then(function(){
              deleteCoUsers(uid);
              deleteUserData('users/', uid);
              deleteUser(user);
            });
            // ...
      }).catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          window.alert(errorMessage);
      });


      
    });

});

function retrieveDataForSettings(){
  console.log(userData);
  var fname = userData.fname;
  var lname = userData.lname;
  var email = userData.email;
  var dob = userData.dob;
  var savings = userData.savings_goal;
  var credit = userData.credit_balance;
  var credit_max = userData.credit_max;
  //BUDGET
      expenseBudget = userData.expenseBudget;
      savingsBudget = userData.savingsBudget;
      creditPaymentBudget = userData.creditPaymentBudget;

  totalBudget += expenseBudget + savingsBudget + creditPaymentBudget;
    if(totalBudget > 0){
      $('#total-budget').text(totalBudget+'%');
    }else{

      $('#total-budget').text('Insufficient Data');
    }
  $('#settings-uid').val(uid);
  $('#settings-fname').val(fname);
  $('#settings-lname').val(lname);
  $('#settings-email').val(email);
  $('#settings-dob').val(dob);
  $('#settings-expenseBudget').val(expenseBudget);
  $('#settings-savingsBudget').val(savingsBudget);
  $('#settings-creditPaymentBudget').val(creditPaymentBudget);
  $('#settings-savings').val(savings);
  $('#settings-credit').val(credit);
  $('#settings-creditMAX').val(credit_max);
}

function deleteUserData(collection_ref, doc_id){
  deleteDoc(doc(db, collection_ref, doc_id));
}

function deleteCoUsers(uid){
  var docRef = collection(db, "users/"+uid+"/co_users");
  const query = getDocs(docRef);
    if(!query.empty){
        query.then(function(query) {
            query.forEach(doc => {
              var collection_ref =  "users/"+uid+"/co_users";
              var doc_id = doc.id;
              deleteDoc(doc(db, collection_ref, doc_id));
            });
        });
    }
}
/**
 * SAVE DATA TO FIRESTORE
 */
function saveEditReportToDB(uid, docData){
    //localStorage.removeItem(uid+'-userInfoData');
    localStorage.setItem(uid+'-userInfoData', JSON.stringify(docData));
    //alert('User info updated!')
    //window.scrollTo(0, 0);
    updateDoc(doc(db, "users", uid ), docData).then(function(){
      window.location.reload();
    });
}

function updateUsersEmail(new_email){
    //const auth = getAuth();
    updateEmail(auth.currentUser, new_email).then(() => {
      }).catch((error) => {
        // An error occurred
        // ...
      });
}

function updateUsersPassword(new_password){
    //const auth = getAuth();
    updatePassword(auth.currentUser, new_password).then(() => {
        // Update successful.
        window.alert("Password Updated!");
      }).catch((error) => {
        // An error ocurred
        // ...
      });
}
