import { db, auth } from './firebase.js'
import { getAuth, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { currentUserData } from './src/model/currentUserData.js';
import { allTransactionsData } from './src/model/allTransactionsData.js';
import { coUsersData } from './src/model/coUsersData.js';
import { topbarActionHandlers } from './src/view/components/navbars/topbar.js';
import { currencyConverter } from './src/presenter/APIs/currencyConverter.js';
import { launchPrimaryUserPicker } from './src/presenter/APIs/primaryUserPicker.js'

let loaderDiv = $('#loading');
const topNavBar = $('#top-navbar');
export let uid = auth?.currentUser?.uid;

$('#side-navbar').load('../../components/navbars/sidebar.html');
$('#top-navbar').load('../../components/navbars/topbar.html');
$('#primaryUserModal').load('../../components/modals/primaryUserModal.html')
$(function(){
    console.log('main.js loaded...');
    loaderDiv.fadeOut(2000); // 500ms fade duration
    const currentLocation = window.location; //get current html page
    onAuthStateChanged(auth, async (user) => {
        if (user) {
          // User is signed in, see docs for a list of available properties
          // https://firebase.google.com/docs/reference/js/auth.user
            uid = user.uid;
            // localStorage.removeItem('primaryUserData-'+uid);
            const primaryUser = await localStorage.getItem('primaryUserData-'+uid);
            if(primaryUser === null || primaryUser === undefined){
                $('#primaryUserModal').modal('show');
                await launchPrimaryUserPicker();
            }
            console.log('logged in: '+uid);
          

          
          var currentPage = currentLocation.pathname.toString();
          if(!currentPage.includes('home')){
            getDoc(doc(db, "users", uid)).then(docSnap => {
                if (docSnap.exists()) {
                    window.location.replace("../home/");
                } else {
                    alert('No user data exists!');
                    signOut(auth);
                }
            });
          }
          await handleLoggedInUser();

        } else {
            console.log('logged out');
            var currentPage = currentLocation.pathname.toString();
            console.log(currentLocation, currentPage)
            if(currentPage=='/src/view/pages/home/'){
                window.location.replace("../auth/");
            }
        }
      });

    $('#login-btn').click(function(){
        const auth = getAuth();
        var email = $('#signin-email').val();
        var password = $('#signin-password').val();

        signInWithEmailAndPassword(auth, email, password)
          .then((userCredential) => {
            // Signed in 
            const user = userCredential.user;
            // ...
          })
          .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            window.alert(errorMessage);
          });
    });
    $('.owl-carousel').each(function() {
        let jQuerycarousel = jQuery(this);
        jQuerycarousel.owlCarousel({
            items: jQuerycarousel.data("items"),
            loop: jQuerycarousel.data("loop"),
            margin: jQuerycarousel.data("margin"),
            nav: jQuerycarousel.data("nav"),
            dots: jQuerycarousel.data("dots"),
            autoplay: jQuerycarousel.data("autoplay"),
            autoplayTimeout: jQuerycarousel.data("autoplay-timeout"),
            navText: ["<i class='fa fa-angle-left fa-2x'></i>", "<i class='fa fa-angle-right fa-2x'></i>"],
            responsiveClass: true,
            responsive: {
                // breakpoint from 0 up
                0: {
                    items: jQuerycarousel.data("items-mobile-sm"),
                    nav: false,
                    dots: true
                },
                // breakpoint from 480 up
                480: {
                    items: jQuerycarousel.data("items-mobile"),
                    nav: false,
                    dots: true
                },
                // breakpoint from 786 up
                786: {
                    items: jQuerycarousel.data("items-tab")
                },
                // breakpoint from 1023 up
                1023: {
                    items: jQuerycarousel.data("items-laptop")
                },
                1199: {
                    items: jQuerycarousel.data("items")
                }
            }
        });
    });
});

async function handleLoggedInUser(){
    await currencyConverter();
    await currentUserData();
    await coUsersData();
    await topbarActionHandlers();
    await allTransactionsData();
}