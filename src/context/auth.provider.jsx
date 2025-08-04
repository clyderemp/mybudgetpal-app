import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useFirebaseConfig } from "@/configs/firebase.config";
import { useFirebaseAuth } from "@/services/client/firebase-auth.service";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useCacheUtils } from "@/utils/cache.utils";
import { useActionUtils } from "@/utils/action.utils";
import { useExchangeRateServices } from "@/services/server/exchange-rate.services";
import { useFormUtils } from "@/utils/form.utils";
import { useAnalyticsUtils } from "@/utils/analytics.utils";
import { useSorterUtils } from "@/utils/sorter.utils";

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
  const [activeUser, setActiveUser] = useState(null);
  const [accountUsers, setAccountUsers] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState(null);
  const [coUsers, setCoUsers] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [allExchangeRates, setAllExchangeRates] = useState(null);
  const [runRateConversion, setRunRateConversion] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

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

  // useEffect(() => {
  //   // if (runRateConversion && !dataLoaded) loadUserData();
  // }, [runRateConversion]);

  const loadUserData = async (uid) => {
    try {
      const storedUserData = await useCacheUtils.get("userData");
      const storedActiveUser = await useCacheUtils.get("activeUser");
      const storedReceiptsData = await useCacheUtils.get("receiptsData");
      const storedCoUsersData = await useCacheUtils.get("coUsersData");
      const storedExchangeRate = await useCacheUtils.get("exchangeRateData");
      const storedExchangeRates = await useCacheUtils.get("exchangeRates");
      if (storedExchangeRates) setAllExchangeRates(storedExchangeRates);

      setLoading(true);
      let user = null;

      if (storedActiveUser) {
        setActiveUser(storedActiveUser);
      }

      if (!storedUserData) {
        console.log("Fetching fresh user data");
        const userData = await useFirestoreServices.getDocument("users", uid);
        await useCacheUtils.save("userData", userData);

        const exchangeRateData = userData?.exchangeRate;
        const savingsBalance = {
          value: userData?.savings?.balance,
          currency: userData?.savings?.currency || "CAD",
        };
        const savingsGoal = {
          value: userData?.savings?.goal,
          currency: userData?.savings?.currency || "CAD",
        };

        const convertedSavingsBalance =
          await useExchangeRateServices.convertRate(
            savingsBalance,
            exchangeRateData
          );
        const convertedSavingsGoal = await useExchangeRateServices.convertRate(
          savingsGoal,
          exchangeRateData
        );
        userData.savings = {
          balance: convertedSavingsBalance,
          goal: convertedSavingsGoal,
          currency: exchangeRateData?.code,
        };
        user = userData;
        useFormUtils.updateData(user?._id, user, setAccountUsers);
        setExchangeRate(exchangeRateData);
        await useCacheUtils.save("exchangeRateData", exchangeRateData);
        setUser(userData);
        if (!storedActiveUser) setActiveUser(userData);
      } else {
        console.log("Fetching cached user data");
        const savingsBalance = {
          value: storedUserData?.savings?.balance,
          currency: storedUserData?.savings?.currency || "CAD",
        };
        const savingsGoal = {
          value: storedUserData?.savings?.goal,
          currency: storedUserData?.savings?.currency || "CAD",
        };

        const convertedSavingsBalance =
          await useExchangeRateServices.convertRate(
            savingsBalance,
            storedExchangeRate
          );
        const convertedSavingsGoal = await useExchangeRateServices.convertRate(
          savingsGoal,
          storedExchangeRate
        );
        storedUserData.savings = {
          balance: convertedSavingsBalance,
          goal: convertedSavingsGoal,
          currency: storedExchangeRate?.code,
        };

        user = storedUserData;
        useFormUtils.updateData(
          storedUserData?._id,
          storedUserData,
          setAccountUsers
        );
        setUser(storedUserData);
        if (!storedActiveUser) setActiveUser(storedUserData);

        if (!storedExchangeRate) {
          console.log("Fetching fresh exchange rate data");
          const exchangeRateData = storedUserData?.exchangeRate;
          setExchangeRate(exchangeRateData);
          await useCacheUtils.save("exchangeRateData", exchangeRateData);
        } else {
          console.log("Fetching cached exchange rate data");
          setExchangeRate(storedExchangeRate);
        }
      }
      const coUsersInfo = [];

      if (!storedCoUsersData) {
        console.log("Fetching fresh co-users data");
        const coUsersData = await useFirestoreServices.getAllDocuments(
          `users/${uid}/coUsers`
        );
        coUsersData.forEach((coUser) => {
          useFormUtils.updateData(coUser?._id, coUser, setAccountUsers);
          coUsersInfo.push({
            id: coUser?._id,
            name: `${coUser.fname} ${coUser.lname}`,
          });
        });

        await useCacheUtils.save("coUsersData", coUsersData);
        setCoUsers(coUsersData);
      } else {
        storedCoUsersData.forEach((coUser) => {
          useFormUtils.updateData(coUser?._id, coUser, setAccountUsers);
        });
        console.log("Fetching cached co-users data");
        setCoUsers(storedCoUsersData);
      }

      if (!storedReceiptsData) {
        console.log("Fetching fresh receipts data");
        let receiptsData = await useFirestoreServices.getAllDocuments(
          `users/${uid}/receipts`
        );
        receiptsData = await useSorterUtils.sortByKey(
          receiptsData,
          "date",
          "descending"
        );
        const convertedRates =
          await useExchangeRateServices.convertRateForReceipts(
            receiptsData,
            exchangeRate ? exchangeRate : user?.exchangeRate
          );

        setFilteredTransactions(
          await useAnalyticsUtils?.getFilteredData(convertedRates)
        );
        await useCacheUtils.save("receiptsData", convertedRates);
        setTransactions(convertedRates);
      } else {
        console.log("Fetching cached receipts data");
        const convertedRates =
          await useExchangeRateServices.convertRateForReceipts(
            storedReceiptsData,
            storedExchangeRate ? storedExchangeRate : exchangeRate
          );

        setFilteredTransactions(
          await useAnalyticsUtils?.getFilteredData(convertedRates)
        );
        setTransactions(convertedRates);
      }
    } catch (err) {
      setUser(null);
      setTransactions(null);
      setCoUsers(null);
      console.error(err);
    } finally {
      setDataLoaded(true);
      setRunRateConversion(false);
      setLoading(false);
    }
  };

  const handleReloadData = async (type = "all") => {
    switch (type) {
      case "all":
        await useCacheUtils.remove("userData");
        await useCacheUtils.remove("exchangeRateData");
        await useCacheUtils.remove("coUsersData");
        await useCacheUtils.remove("receiptsData");
        break;
      case "user":
        await useCacheUtils.remove("userData");
        break;
      case "exchangeRate":
        await useCacheUtils.remove("exchangeRateData");
        break;
      case "coUsers":
        await useCacheUtils.remove("exchangeRateData");
        break;
      default:
        break;
    }
    await loadUserData(uid);
  };

  const handleUpdateReceipts = async (type, data) => {
    if (!data?._id) return;

    let updatedTransactions = [...transactions];
    if (type === "add") {
      updatedTransactions.push(data);
    } else if (type === "update") {
      const index = updatedTransactions?.findIndex((tx) => tx._id === data._id);
      if (index !== -1) {
        updatedTransactions[index] = {
          ...updatedTransactions[index],
          ...data,
        };
      }
    } else if (type === "delete") {
      const index = updatedTransactions?.findIndex((tx) => tx._id === data._id);
      if (index !== -1) {
        updatedTransactions.splice(index, 1);
      }
    } else {
      console.warn("Unknown type passed to handleUpdateReceipts");
      return;
    }

    // Continue with sorting, rate conversion, and updating state/cache
    updatedTransactions = await useSorterUtils.sortByKey(
      updatedTransactions,
      "date",
      "descending"
    );

    const convertedRates = await useExchangeRateServices.convertRateForReceipts(
      updatedTransactions,
      exchangeRate || user?.exchangeRate
    );

    const filtered = await useAnalyticsUtils?.getFilteredData(convertedRates);
    setFilteredTransactions(filtered);
    await useCacheUtils.save("receiptsData", convertedRates);
    setTransactions(convertedRates);
    await loadUserData(uid);
  };

  const handleLogout = async () => {
    // await useActionUtils.onLogout(uid);
    logout?.();
  };

  const handleActiveUserSwitch = async (uid) => {
    setLoading(true);
    const selectedUser = accountUsers[uid];
    await useCacheUtils.save("activeUser", selectedUser);
    setActiveUser(selectedUser);
    loadUserData();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUser,
        switchActiveUser: handleActiveUserSwitch,
        accountUsers,
        transactions,
        filteredTransactions,
        coUsers,
        exchangeRate,
        setExchangeRate,
        allExchangeRates,
        setAllExchangeRates,
        login,
        logout: handleLogout,
        loading,
        reloadData: handleReloadData,
        runRateConversion: setRunRateConversion,
        updateReceipts: handleUpdateReceipts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
