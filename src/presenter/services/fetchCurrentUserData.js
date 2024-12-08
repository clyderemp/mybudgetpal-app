import { db, auth } from '../../../firebase.js'
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { uid } from '../../../main.js';

export const fetchCurrentUserData = async() => {
    console.log(uid)
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if(userDocSnap.exists()){
        return userDocSnap?.data();
    }
}