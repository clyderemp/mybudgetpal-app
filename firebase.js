import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBMZiaC0lOx07nV7Y6MghTUARJL_Ypefgs",
    authDomain: "budget-web-2022.firebaseapp.com",
    databaseURL: "https://budget-web-2022-default-rtdb.firebaseio.com",
    projectId: "budget-web-2022",
    storageBucket: "budget-web-2022.appspot.com",
    messagingSenderId: "309044228923",
    appId: "1:309044228923:web:1af043e9ed838b467dbd1e",
    measurementId: "G-B9E9ZKVST8"
  };

  // Initialize Firebase
  export const app = initializeApp(firebaseConfig);
  export const analytics = getAnalytics(app);
  export const db = getFirestore(app);
  export const auth = getAuth();
