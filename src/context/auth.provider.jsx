import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useFirebaseConfig } from "@/configs/firebase.config";
import { useFirebaseAuth } from "@/services/client/firebase-auth.service";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useBackendServices } from "@/services/server/backend.services";
import { useCacheUtils } from "@/utils/cache.utils";
import { useFilterUtils } from "@/utils/filter.utils";
import { useActionUtils } from "@/utils/action.utils";
import { useGeneratorUtils } from "@/utils/generator.utils";

const { auth } = useFirebaseConfig;

// Create the context
export const AuthContext = createContext();

// Hook to consume context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default function AuthProvider({ children }) {
  const [uid, setUID] = useState(null);
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [coUsers, setCoUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  const { login, logout } = useFirebaseAuth;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.uid) {
        setUID(firebaseUser?.uid);
        await loadUserData(firebaseUser.uid);
      } else {
        setUser(null);
        setLoading(false);
        await useActionUtils.onLogin(firebaseUser?.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (uid) => {
    try {
      const storedUserData = await useCacheUtils.get("userData");
      const storedReceiptsData = await useCacheUtils.get("receiptsData");
      const storedCoUsersData = await useCacheUtils.get("coUsersData");
      setLoading(true);

      if (!storedUserData) {
        console.log("Fetching fresh user data");
        const userData = await useFirestoreServices.getDocument("users", uid);
        await useCacheUtils.save("userData", userData);
        setUser(userData);
      } else {
        console.log("Fetching cached user data");
        setUser(storedUserData);
      }

      if (!storedReceiptsData) {
        console.log("Fetching fresh receipts data");
        const receiptsData = await useFirestoreServices.getAllDocuments(
          `users/${uid}/receipts`
        );
        await useCacheUtils.save("receiptsData", receiptsData);

        setTransactions(receiptsData);
      } else {
        console.log("Fetching cached receipts data");
        setTransactions(storedReceiptsData);
      }

      if (!storedCoUsersData) {
        console.log("Fetching fresh co-users data");
        const coUsersData = await useFirestoreServices.getAllDocuments(
          `users/${uid}/co_users`
        );

        setCoUsers(coUsersData);
      } else {
        console.log("Fetching cached co-users data");
        setCoUsers(storedCoUsersData);
      }
    } catch (err) {
      setUser(null);
      setTransactions(null);
      setCoUsers(null);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadData = async () => {
    console.log("Cache cleared. Fetching fresh data");
    await useCacheUtils.remove("userData");
    await useCacheUtils.remove("receiptsData");
    await useCacheUtils.remove("coUsersData");
    await loadUserData(uid);
  };

  const handleLogout = async () => {
    await useActionUtils.onLogout(uid);
    logout?.();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        transactions,
        login,
        logout: handleLogout,
        loading,
        reloadData: handleReloadData, // expose this function so components can reload manually
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

//EXTRA

// for (let i = 0; i < transactionData.length; i++) {
//   const item = transactionData[i];
//   const newID = useGeneratorUtils.generateUid("receipt");
//   const newData = {
//     _id: newID,
//     id: newID,
//     merchant: item.transaction,
//     note: item?.note,
//     paymentMethod: item?.paymentMethod,
//     reportedBy: item?.reportedBy,
//     value: item?.value,
//     type: item?.category,
//     category: item?.type,
//     currency: item?.currency ? item?.currency : "CAD",
//     exchangeRate: item?.exchange_rate ? item?.exchange_rate : 1,
//     creationDate: item?.creation_date?.toDate
//       ? item.creation_date.toDate().toISOString()
//       : new Date(item.date).toISOString(),
//     account:
//       item?.paymentMethod === "debit" && item?.category === "expenses"
//         ? "expenses"
//         : item?.paymentMethod === "debit" && item?.category === "income"
//         ? "salary"
//         : item?.paymentMethod === "debit" && item?.category === "income"
//         ? "savings"
//         : null,
//     date:
//       item.date instanceof Date
//         ? item.date.toISOString()
//         : new Date(item.date).toISOString(),
//   };
//   // await useFirestoreServices.addDocument(
//   //   `users/${uid}/receipts`,
//   //   newData
//   // );
//   console.log(newData);
// }
