import { db } from '/js/firebase.js'
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, Timestamp, getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; 

$(function(){

    //SIGN UP BUTTON HANDLER
    $('#sign-up').click(function(){
        window.location.href = "signup.html";
    })
    $('#log-in').click(function(){
        window.location.href = "index.html";
    })

    //SIGN UP SUBMISSION
    $('#signup-submit').click(function(){
        var email = $('#signup-username').val();
        var password = $('#signup-password').val();
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed up 
                const user = userCredential.user;
                const uid = user.uid;
                window.alert('Account has been created for: '+uid);
                createFirestore(uid);
                // ...
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                // ..
            });
    })


    console.log('works');
    const auth = getAuth();
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
          // User is signed in, see docs for a list of available properties
          // https://firebase.google.com/docs/reference/js/auth.user
          const uid = user.uid;
          console.log('logged in: '+uid);
          //window.location.href = "dashboard.html";
          // ...
        } else {
            console.log('logged out');
            //window.location.href = "index.html";
          // User is signed out
          // ...
        }
      });

});

function createFirestore(uid){
    var docData = {
        id: uid
    }
    setDoc(doc(db, "users", uid), docData)
            .then(function(){
              window.alert("Account Created!");
              $('#signupform').hide();
            });
}

