import { doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js"; 
import { db } from "../../../firebase.js";
import { uid } from "../../../main.js";

// Save document to Firestore
export const saveDocument = async (collectionPath, documentPath, docData) => {
    const docRef = doc(db, collectionPath, documentPath);
    try {
        // Try to set the document
        await setDoc(docRef, docData);
        return true; // Indicate success
    } catch (error) {
        console.error("Error saving document: ", error);
        return false; // Indicate failure
    }
}

// Update document in Firestore
export const updateDocument = async (collectionPath, documentPath, docData) => {
    const docRef = doc(db, collectionPath, documentPath);
    try {
        // Try to update the document
        await updateDoc(docRef, docData);
        return true; // Indicate success
    } catch (error) {
        console.error("Error updating document: ", error);
        return false; // Indicate failure
    }
}
