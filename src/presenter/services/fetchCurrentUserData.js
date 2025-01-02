import { db, auth } from '../../../firebase.js'
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { uid } from '../../../main.js';

export const fetchCurrentUserData = async() => {
    // await localStorage.removeItem('currentUserData-'+uid);
    let currentUserDataVal = JSON.parse(await localStorage.getItem('currentUserData-'+uid));
    if(currentUserDataVal === null){
        console.log('Fetching current user data from firebase...');
        const userDocRef = doc(db, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);
        if(userDocSnap.exists()){
            currentUserDataVal = userDocSnap?.data();
        }
        await localStorage.setItem('currentUserData-'+uid, JSON.stringify(currentUserDataVal));
        // console.log('Fetched data: ', currentUserDataVal);
        return (currentUserDataVal);
    } else {
        console.log('Fetching current user data from local...');
        // console.log('Fetched data: ', currentUserDataVal);
        return (currentUserDataVal);
    }

}