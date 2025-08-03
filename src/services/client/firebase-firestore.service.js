import { useFirebaseConfig } from "@/configs/firebase.config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";

const { firestore } = useFirebaseConfig;

class FirestoreService {
  async getDocument(collectionName, docId) {
    try {
      // Try with Document ID
      const docRef = doc(firestore, collectionName, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { _id: docSnap.id, ...docSnap.data() };
      }

      // If not found, try querying by uid field
      const colRef = collection(firestore, collectionName);
      const q = query(colRef, where("uid", "==", docId));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const firstDoc = querySnap.docs[0];
        return { _id: firstDoc.id, ...firstDoc.data() };
      }

      return null;
    } catch (error) {
      console.error("FirestoreService.getDocument error:", error);
      throw error;
    }
  }

  async getAllDocuments(collectionName) {
    try {
      const colRef = collection(firestore, collectionName);
      const snapshot = await getDocs(colRef);
      const docs = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));
      return docs;
    } catch (error) {
      console.error("FirestoreService.getAllDocuments error:", error);
      throw error;
    }
  }

  async addDocument(collectionName, data) {
    try {
      const colRef = collection(firestore, collectionName);
      if (data._id) {
        // Use setDoc with specific doc ID
        const docRef = doc(colRef, data._id);
        await setDoc(docRef, data);
        return data._id;
      } else {
        // Use addDoc to generate ID automatically
        const docRef = await addDoc(colRef, data);
        return docRef.id;
      }
    } catch (error) {
      console.error("FirestoreService.addDocument error:", error);
      throw error;
    }
  }

  async updateDocument(collectionName, docId, data) {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await updateDoc(docRef, data);
      return true;
    } catch (error) {
      console.error("FirestoreService.updateDocument error:", error);
      throw error;
    }
  }

  async deleteDocument(collectionName, docId) {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("FirestoreService.deleteDocument error:", error);
      throw error;
    }
  }

  async queryDocuments(collectionName, field, value) {
    try {
      const colRef = collection(firestore, collectionName);
      const q = query(colRef, where(field, "==", value));
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      return results;
    } catch (error) {
      console.error("FirestoreService.queryDocuments error:", error);
      throw error;
    }
  }

  async replaceDocument(collectionName, docId, newData) {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await setDoc(docRef, newData, { merge: false }); // full replacement
      return docId;
    } catch (error) {
      console.error("FirestoreService.replaceDocument error:", error);
      throw error;
    }
  }
}

export const useFirestoreServices = new FirestoreService();
