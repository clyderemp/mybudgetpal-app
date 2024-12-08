import { db, auth } from '../../../firebase.js'
import { getAuth, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 

let rememberMeChecked = false;
$(function(){
    const email = $('#login-email');
    const password = $('#login-pw');
    const forgot_password_btn = $('#forgot-pw');
    const remember_me_btn = $('#remember-me');
    const submitLogin = $('#submitLogin');
    console.log('fetchUserAuthentication.js is loaded...');
    remember_me_btn.on('change',function() {
        if ($(this).prop('checked')) {
            rememberMeChecked = true;
            console.log('Checkbox is checked');
        } else {
            rememberMeChecked = false;
            console.log('Checkbox is unchecked');
        }
    });

    submitLogin.click(function(){handleLoginWithCredentials(email.val(), password.val())});
});


const handleLoginWithCredentials = async (email, password) => {
    const auth = getAuth();
    console.log(email, password)
    signInWithEmailAndPassword(auth, email, password)
          .then((userCredential) => {
            // Signed in 
            const user = userCredential.user;
            console.log(user);
            window.location.replace("../home/index.html");
            // ...
          })
          .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            window.alert(errorMessage);
          });
}