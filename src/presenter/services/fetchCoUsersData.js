import { db, auth } from '../../../firebase.js'
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { uid } from '../../../main.js';

export const fetchCoUsersData = async() => {
    let coUserDataVal = JSON.parse(await localStorage.getItem('coUserData-'+uid));

    if(coUserDataVal === null){
        coUserDataVal = [];
        console.log('Fetching co user data from firebase...');
        const coUsersCollectionRef = collection(db, 'users', uid, 'co_users');
        const coUsersCollection = await getDocs(coUsersCollectionRef);
        if(!coUsersCollection.empty){
            coUsersCollection.forEach(coUser => {
                coUserDataVal.push(coUser?.data()); 
            })
        }
        await localStorage.setItem('coUserData-'+uid, JSON.stringify(coUserDataVal));
        return (coUserDataVal);
    } else {
        console.log('Fetching co user data from local...');
        return (coUserDataVal);
    }

}