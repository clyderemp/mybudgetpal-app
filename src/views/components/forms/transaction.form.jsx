import { useEffect, useState } from "react";
import CustomInput from "../customs/customInput";
import CustomButton from "../customs/customButton";
import { useFormUtils } from "@/utils/form.utils";
import { useAuth } from "@/context/auth.provider";
import Loader from "../static/Loader";
import { useModal } from "@/context/modal.provider";
import {
  ACCOUNT_TYPES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  TRANSACTION_CATEGORIES,
} from "@/constants/transaction.constants";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useGeneratorUtils } from "@/utils/generator.utils";

const TransactionForm = ({ data = {}, onSuccess = () => {} }) => {
  const { user, accountUsers, updateReceipts } = useAuth();
  const { closeModal } = useModal();

  const [transactionData, setTransactionData] = useState(data);

  const [isFormValid, setIsFormValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userOptions, setUserOptions] = useState([]);

  useEffect(() => {
    const usersOptions = getAccountUsers();
    setUserOptions(usersOptions);
    if (data?._id) {
      setTransactionData((prev) => ({ ...prev, ...data }));
    }
  }, [data]);

  useEffect(() => {
    const validate = async () => {
      const valid = await useFormUtils.isFormComplete(transactionData);
      setIsFormValid(valid);
    };
    validate();
  }, [transactionData]);

  const handleUpdateForm = async (key, value) => {
    await useFormUtils.updateData(key, value, setTransactionData);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      let response;
      if (data?._id) {
        response = await useFirestoreServices.updateDocument(
          `users/${user?._id}/receipts`,
          data?._id,
          transactionData
        );
        await updateReceipts("update", transactionData);
      } else {
        const finalData = {
          ...transactionData,
          _id: useGeneratorUtils.generateUid("receipt"),
          creationDate: new Date().toISOString(),
        };
        response = await useFirestoreServices.addDocument(
          `users/${user?._id}/receipts`,
          finalData
        );
        await updateReceipts("add", transactionData);
      }

      if (response) {
        closeModal();
        onSuccess?.();
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!data?._id) return;
    try {
      setLoading(true);
      await useFirestoreServices.deleteDocument(
        `users/${user?._id}/receipts`,
        data._id
      );
      closeModal();
      onSuccess?.();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      await updateReceipts("delete", transactionData);
      setLoading(false);
    }
  };

  const getAccountUsers = () => {
    if (!accountUsers || typeof accountUsers !== "object") return [];

    return Object.entries(accountUsers).map(([id, user]) => {
      const first = user.fname || "";
      const last = user.lname || "";
      return {
        value: id,
        label: `${first} ${last}`.trim(),
      };
    });
  };

  if (loading) {
    return (
      <Loader text={data?._id ? "Saving changes" : "Uploading transaction"} />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {data?._id ? "Edit Transaction" : "Create New Transaction"}
      </h2>

      <CustomInput
        type="text"
        value={transactionData?.merchant}
        onChange={(e) => handleUpdateForm("merchant", e.target.value)}
        placeholder="Merchant Name"
      />

      <CustomInput
        type="money"
        value={transactionData?.value}
        selectedCurrency={transactionData?.currency}
        onChange={(e) => handleUpdateForm("value", parseFloat(e.target.value))}
        onCurrencyChange={(currency) => handleUpdateForm("currency", currency)}
        placeholder="Amount"
      />

      <CustomInput
        type="dropdown"
        options={TRANSACTION_TYPES}
        value={transactionData?.type || TRANSACTION_TYPES[0]}
        onChange={(e) => handleUpdateForm("type", e.target.value)}
        placeholder="Transaction Type"
      />

      <CustomInput
        type="dropdown"
        options={TRANSACTION_CATEGORIES[transactionData?.type]}
        value={transactionData?.category}
        onChange={(e) => handleUpdateForm("category", e.target.value)}
        placeholder="Category"
      />

      <CustomInput
        type="date"
        value={transactionData?.date || new Date()}
        onChange={(e) => handleUpdateForm("date", e.target.value)}
        placeholder="Transaction Date"
      />

      <CustomInput
        type="dropdown"
        options={PAYMENT_METHODS}
        value={transactionData?.paymentMethod || PAYMENT_METHODS[0]}
        onChange={(e) => handleUpdateForm("paymentMethod", e.target.value)}
        placeholder="Payment Method"
      />

      <CustomInput
        type="dropdown"
        options={ACCOUNT_TYPES}
        value={transactionData?.account || ACCOUNT_TYPES[0]}
        onChange={(e) => handleUpdateForm("account", e.target.value)}
        placeholder="Account Type"
      />

      <CustomInput
        type="dropdown"
        options={userOptions}
        value={transactionData?.reportedBy || userOptions[0]}
        onChange={(e) => handleUpdateForm("reportedBy", e.target.value)}
        placeholder="Reported By"
      />

      <CustomInput
        type="textarea"
        value={transactionData?.note}
        onChange={(e) => handleUpdateForm("note", e.target.value)}
        placeholder="Additional Note"
      />

      <div className="flex space-x-2">
        <CustomButton
          label={data?._id ? "Save Changes" : "Create Transaction"}
          isDisabled={!isFormValid}
          onClick={handleSubmit}
        />
        {data?._id && (
          <CustomButton
            label="Delete Transaction"
            color="danger"
            onClick={handleDelete}
          />
        )}
      </div>
    </div>
  );
};

export default TransactionForm;
