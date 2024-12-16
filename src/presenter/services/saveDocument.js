import { doc, setDoc, updateDoc} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { db } from "../../../firebase.js";
import { uid } from "../../../main.js";

export const saveDocument = async (collectionPath, documentPath, docData) => {
    const docRef = doc(db, collectionPath, documentPath);
    const result = await setDoc(docRef, docData);

    return result;
}

export const updateDocument = async (collectionPath, documentPath, docData) => {
    const docRef = doc(db, collectionPath, documentPath);
    const result = await updateDoc(docRef, docData);

    return result;
}