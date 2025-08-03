import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const env = import.meta.env;

const firebaseConfig = JSON.parse(env.VITE_FIREBASE_CONFIG);

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const storage = getStorage(app);
const firestore = getFirestore(app);

export const useFirebaseConfig = {
  app,
  auth,
  storage,
  firestore,
};
