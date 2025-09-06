import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

// Firebase + Services
import { useFirebaseConfig } from "@/configs/firebase.config";
import { useFirebaseAuth } from "@/services/client/firebase-auth.service";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useFrankfurterCurrencyServices } from "@/services/server/frankfurter.api.services";

// Utilities
import { useCacheUtils } from "@/utils/cache.utils";
import { useActionUtils } from "@/utils/action.utils";
import { useFormUtils } from "@/utils/form.utils";
import { useAnalyticsUtils } from "@/utils/analytics.utils";
import { useSorterUtils } from "@/utils/sorter.utils";
import { useEncryptionUtils } from "@/utils/encryption.utils";

// Toast
import { useToast } from "./toast.provider";
import { useGeneratorUtils } from "@/utils/generator.utils";

// Firebase Auth init
const { auth } = useFirebaseConfig;

// Auth Context
export const AuthContext = createContext();
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export default function AuthProvider({ children }) {
  // Services
  const { showToast } = useToast();
  const { login, logout } = useFirebaseAuth;

  // State
  const [uid, setUID] = useState(null);
  const [user, setUser] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [accountUsers, setAccountUsers] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [filteredTransactions, setFilteredTransactions] = useState(null);
  const [coUsers, setCoUsers] = useState(null);
  const [financialAccounts, setFinancialAccounts] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [allExchangeRates, setAllExchangeRates] = useState(null);
  const [runRateConversion, setRunRateConversion] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 🔁 Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.uid) {
        setUID(firebaseUser.uid);
        await loadUserData(firebaseUser.uid);
        setLoading(false);
      } else {
        setUser(null);
        await useActionUtils.onLogin();
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 📦 Load Full User Session Data
  const loadUserData = async (uid) => {
    try {
      setLoading(true);

      // 1. Load all cache at once
      const [
        storedUserData,
        storedActiveUser,
        storedReceiptsData,
        storedBudgetData,
        storedCoUsersData,
        storedExchangeRate,
        storedExchangeRates,
        storedFinancialAccounts,
      ] = await Promise.all([
        useCacheUtils.get("userData"),
        useCacheUtils.get("activeUser"),
        useCacheUtils.get("receiptsData"),
        useCacheUtils.get("budgetData"),
        useCacheUtils.get("coUsersData"),
        useCacheUtils.get("exchangeRateData"),
        useCacheUtils.get("exchangeRates"),
        useCacheUtils.get("financialAccounts"),
      ]);

      // 2. Active user
      if (storedActiveUser) setActiveUser(storedActiveUser);

      // 3. User Data (from cache or Firestore)
      let currentUser;

      if (!storedUserData) {
        showToast("Loaded Fresh Data", "success");
        const userData = await useFirestoreServices.getDocument("users", uid);

        // Convert Correction Params
        const entries = Object.entries(userData.correctionParams || {});

        await Promise.all(
          entries.map(async ([uid, correction]) => {
            const convertedVals = await handleCorrectionParamsConversion(
              correction,
              userData?.exchangeRate
            );
            userData.correctionParams[uid].data = convertedVals;
          })
        );

        // Decrypt accounts
        if (userData?.financialAccounts) {
          const decrypted = await useEncryptionUtils.decryptData(
            userData._id,
            userData.financialAccounts
          );
          setFinancialAccounts(decrypted);
          await useCacheUtils.save("financialAccounts", decrypted);
        } else {
          setFinancialAccounts([]);
        }
        currentUser = userData;
        useFormUtils.updateData(userData._id, userData, setAccountUsers);
        await useCacheUtils.save("userData", userData);
        if (!storedActiveUser) setActiveUser(userData);
      } else {
        showToast("Loaded Cached Data", "success");
        currentUser = storedUserData;
        if (!storedActiveUser) setActiveUser(currentUser);
        if (storedFinancialAccounts)
          setFinancialAccounts(storedFinancialAccounts);
        useFormUtils.updateData(currentUser._id, currentUser, setAccountUsers);
      }
      // 4. Exchange Rate (after user known)
      const exchangeRateData = storedExchangeRate || currentUser.exchangeRate;
      if (!exchangeRateData?.code) throw new Error("Missing exchange rate");

      setExchangeRate(exchangeRateData);
      await useCacheUtils.save("exchangeRateData", exchangeRateData);

      const rates =
        storedExchangeRates?.length > 0
          ? storedExchangeRates
          : await useFrankfurterCurrencyServices.getExchangeRates(
              exchangeRateData.code
            );

      setAllExchangeRates(rates);
      if (!storedExchangeRates) {
        await useCacheUtils.save("exchangeRates", rates);
      }

      // 5. Convert savings using latest rate
      const savingsBalance = {
        value: Number(currentUser?.savings?.balance),
        currency: currentUser?.savings?.currency || "CAD",
      };
      const savingsGoal = {
        value: Number(currentUser?.savings?.goal),
        currency: currentUser?.savings?.currency || "CAD",
      };

      currentUser.savings = {
        balance: await useFrankfurterCurrencyServices.convertRate(
          savingsBalance,
          exchangeRateData
        ),
        goal: await useFrankfurterCurrencyServices.convertRate(
          savingsGoal,
          exchangeRateData
        ),
        currency: exchangeRateData.code,
      };

      // 6. Co-Users
      if (!storedCoUsersData) {
        const coUsersData = await useFirestoreServices.getAllDocuments(
          `users/${uid}/coUsers`
        );
        coUsersData?.forEach((user) => {
          useFormUtils.updateData(user._id, user, setAccountUsers);
        });
        setCoUsers(coUsersData);
        await useCacheUtils.save("coUsersData", coUsersData);
      } else {
        storedCoUsersData.forEach((user) => {
          useFormUtils.updateData(user._id, user, setAccountUsers);
        });
        setCoUsers(storedCoUsersData);
      }

      // 7. Receipts / Transactions
      if (!storedReceiptsData) {
        let receipts = await useFirestoreServices.getAllDocuments(
          `users/${uid}/receipts`
        );
        receipts = await useSorterUtils.sortByKey(
          receipts,
          "date",
          "descending"
        );

        const converted =
          await useFrankfurterCurrencyServices.convertRateForReceipts(
            receipts,
            exchangeRateData
          );

        setTransactions(converted);
        setFilteredTransactions(
          await useAnalyticsUtils.getFilteredData(converted)
        );
        await useCacheUtils.save("receiptsData", converted);
      } else {
        const converted =
          await useFrankfurterCurrencyServices.convertRateForReceipts(
            storedReceiptsData,
            exchangeRateData
          );
        setTransactions(converted);
        setFilteredTransactions(
          await useAnalyticsUtils.getFilteredData(converted)
        );
      }

      // 8. Budget Data
      if (!storedBudgetData) {
        let budgetData = await useFirestoreServices.getAllDocuments(
          `users/${uid}/budgetData`
        );
        await useCacheUtils.save("budgetData", budgetData);
        setBudgetData(budgetData || []);
      } else {
        setBudgetData(storedBudgetData);
      }

      setUser(currentUser);
    } catch (err) {
      console.error("AuthProvider Error:", err);
      setUser(null);
      setTransactions(null);
      setCoUsers(null);
    } finally {
      showToast(`Data successfully loaded`, "success");
      setLoading(false);
      setDataLoaded(true);
      setRunRateConversion(false);
    }
  };

  const handleCorrectionParamsConversion = async (
    correctionParams,
    exchangeRateData
  ) => {
    const { expenses, income, savings, credit } = correctionParams?.data;
    const exchangeRate = correctionParams?.exchangeRate;
    const expenseParams = {
      value: Number(expenses),
      currency: exchangeRate?.code || "CAD",
    };
    const incomeParams = {
      value: Number(income),
      currency: exchangeRate?.code || "CAD",
    };
    const savingsParams = {
      value: Number(savings),
      currency: exchangeRate?.code || "CAD",
    };
    const creditParams = {
      value: Number(credit),
      currency: exchangeRate?.code || "CAD",
    };
    const converted = {
      expenses: Number(
        await useFrankfurterCurrencyServices.convertRate(
          expenseParams,
          exchangeRateData
        )
      ),
      income: Number(
        await useFrankfurterCurrencyServices.convertRate(
          incomeParams,
          exchangeRateData
        )
      ),
      savings: Number(
        await useFrankfurterCurrencyServices.convertRate(
          savingsParams,
          exchangeRateData
        )
      ),
      credit: Number(
        await useFrankfurterCurrencyServices.convertRate(
          creditParams,
          exchangeRateData
        )
      ),
    };
    return converted;
  };

  // 🔁 Data Reload Handler
  const handleReloadData = async (type = "all") => {
    const keys = {
      all: [
        "userData",
        "exchangeRates",
        "exchangeRateData",
        "coUsersData",
        "receiptsData",
        "budgetData",
        "financialAccounts",
      ],
      user: ["userData"],
      exchangeRate: ["exchangeRateData"],
      coUsers: ["coUsersData"],
    };

    for (const key of keys[type] || []) {
      await useCacheUtils.remove(key);
    }

    await loadUserData(uid);
  };

  // 💳 Handle Add/Update/Delete Financial Account
  const handleUpdateFinancialAccounts = async (type, data) => {
    try {
      if (!data?.id) throw new Error("Card ID Required");

      let updated = [...(financialAccounts || [])];
      const index = updated.findIndex((item) => item.id === data.id);

      if (type === "add") updated.push(data);
      else if (type === "update" && index !== -1)
        updated[index] = { ...updated[index], ...data };
      else if (type === "delete" && index !== -1) updated.splice(index, 1);
      else throw new Error("Invalid operation or missing index");

      const encrypted = await useEncryptionUtils.encryptData(
        uid,
        updated,
        true
      );
      await useFirestoreServices.updateDocument("users", uid, {
        financialAccounts: encrypted,
      });

      const sorted = await useSorterUtils.sortByKey(
        updated,
        "date",
        "descending"
      );
      await useCacheUtils.save("financialAccounts", sorted);
      setFinancialAccounts(sorted);
      await loadUserData(uid);

      showToast("Changes to Financial Accounts Saved", "success");
    } catch (err) {
      console.error("Update Card Error:", err);
      showToast(err?.message || "Failed to update financial account", "error");
    }
  };

  // 🧾 Handle Add/Update/Delete Receipts
  const handleUpdateReceipts = async (type, data) => {
    if (!data?._id) return;

    let updated = [...(transactions || [])];
    const index = updated.findIndex((tx) => tx._id === data._id);

    if (type === "add") updated.push(data);
    else if (type === "update" && index !== -1)
      updated[index] = { ...updated[index], ...data };
    else if (type === "delete" && index !== -1) updated.splice(index, 1);
    else return;

    const sorted = await useSorterUtils.sortByKey(
      updated,
      "date",
      "descending"
    );
    const converted =
      await useFrankfurterCurrencyServices.convertRateForReceipts(
        sorted,
        exchangeRate || user?.exchangeRate
      );
    const filtered = await useAnalyticsUtils.getFilteredData(converted);

    setTransactions(converted);
    setFilteredTransactions(filtered);
    await useCacheUtils.save("receiptsData", converted);
    await loadUserData(uid);
  };

  // 👤 Handle Active User Switch
  const handleActiveUserSwitch = async (userId) => {
    if (!userId || !accountUsers?.[userId]) return;
    setLoading(true);
    const user = accountUsers[userId];
    await useCacheUtils.save("activeUser", user);
    setActiveUser(user);
    await loadUserData(uid);
    setLoading(false);
  };

  const handleUpdateBudgetData = async (type, data) => {
    if (!data) return;

    // Edit or Delete existing document
    if (data._id) {
      if (type === "edit") {
        await useFirestoreServices.updateDocument(
          `users/${uid}/budgetData`,
          data._id,
          data
        );

        // Update local state and cache
        const updatedData = budgetData.map((item) =>
          item._id === data._id ? data : item
        );
        setBudgetData(updatedData);
        await useCacheUtils.save("budgetData", updatedData);
      } else if (type === "delete") {
        await useFirestoreServices.deleteDocument(
          `users/${uid}/budgetData`,
          data._id
        );

        // Remove from local state and cache
        const updatedData = budgetData.filter((item) => item._id !== data._id);
        setBudgetData(updatedData);
        await useCacheUtils.save("budgetData", updatedData);
      }
    } else {
      // Add new document
      const newData = {
        ...data,
        _id: useGeneratorUtils.generateUid(`budget-${data?.type}`),
      };
      await useFirestoreServices.addDocument(
        `users/${uid}/budgetData`,
        newData
      );

      // Update local state and cache
      const updatedData = [...budgetData, newData];
      setBudgetData(updatedData);
      await useCacheUtils.save("budgetData", updatedData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUser,
        switchActiveUser: handleActiveUserSwitch,
        accountUsers,
        financialAccounts,
        transactions,
        budgetData,
        filteredTransactions,
        coUsers,
        exchangeRate,
        setExchangeRate,
        allExchangeRates,
        setAllExchangeRates,
        login,
        logout: logout,
        loading,
        reloadData: handleReloadData,
        runRateConversion: setRunRateConversion,
        updateReceipts: handleUpdateReceipts,
        updateFinancialAccounts: handleUpdateFinancialAccounts,
        updateBudgetData: handleUpdateBudgetData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
