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
  const {
    user,
    transactions,
    accountUsers,
    updateReceipts,
    exchangeRate,
    financialAccounts,
  } = useAuth();
  const { closeModal } = useModal();

  const [transactionData, setTransactionData] = useState({
    ...data,
    items: data?.items || [],
  });

  const [newItem, setNewItem] = useState({ name: "", price: "", quantity: "" });

  const [isFormValid, setIsFormValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userOptions, setUserOptions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(PAYMENT_METHODS);
  const [customCategories, setCustomCategories] = useState([]);

  useEffect(() => {
    mapFinancialAccountsToOptions();
    mapCustomCategories();
  }, []);

  useEffect(() => {
    const usersOptions = getAccountUsers();
    setUserOptions(usersOptions);

    if (data?._id) {
      setTransactionData((prev) => ({ ...prev, ...data }));
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isoDateWithoutTime = today.toISOString().split("T")[0];
      handleUpdateForm("currency", exchangeRate?.code);
      handleUpdateForm("date", isoDateWithoutTime);
    }
  }, [data]);

  useEffect(() => {
    const validate = async () => {
      const { note, items, ...rest } = transactionData;
      const valid = await useFormUtils.isFormComplete(rest);
      setIsFormValid(valid);
    };
    validate();
  }, [transactionData]);

  const mapFinancialAccountsToOptions = () => {
    const newOptions = financialAccounts
      .map(({ id, owner, bank, provider, accountType: type }) => {
        const user = accountUsers?.[owner];
        const userName = user ? `${user.fname}`.trim() : "Unknown User";
        const accountType = ACCOUNT_TYPES.find((b) => b.value === type);

        return {
          label: `${userName}'s ${bank?.replaceAll("card", "")} ${
            provider ?? ""
          } Card ${accountType?.label ? `- ${accountType?.label}` : ""}`,
          value: id,
        };
      })
      .filter(({ value }) => !paymentMethods.some((pm) => pm.value === value));

    if (newOptions.length > 0) {
      setPaymentMethods([...paymentMethods, ...newOptions]);
    }
  };

  const mapCustomCategories = () => {
    if (!transactions || transactions.length === 0) return [];

    // Extract all customCategory values for transactions where category is 'Others'
    const extractedCustomCategories = Array.from(
      new Set(
        transactions
          .filter((tx) => tx.category === "Custom" && tx.customCategory?.trim())
          .map((tx) => tx.customCategory.trim())
      )
    );
    setCustomCategories(extractedCustomCategories);
  };

  const handleUpdateForm = async (key, value) => {
    await useFormUtils.updateData(key, value, setTransactionData);
  };

  const handleAddItem = () => {
    const { name, price, quantity } = newItem;

    if (!name.trim() || isNaN(price) || isNaN(quantity)) return;

    const parsedPrice = parseFloat(price);
    const parsedQty = parseInt(quantity);
    const itemTotal = parsedPrice * parsedQty;

    const updatedItems = [
      ...(transactionData.items || []),
      {
        name: name.trim(),
        price: parsedPrice,
        quantity: parsedQty,
        total: itemTotal,
      },
    ];

    const newTotalValue = updatedItems.reduce(
      (sum, item) => sum + item.total,
      0
    );

    setTransactionData((prev) => ({
      ...prev,
      items: updatedItems,
      value: newTotalValue,
    }));

    setNewItem({ name: "", price: "", quantity: "" });
  };

  const handleRemoveItem = (index) => {
    const updatedItems = [...(transactionData.items || [])];
    updatedItems.splice(index, 1);

    const newTotalValue = updatedItems.reduce(
      (sum, item) => sum + item.total,
      0
    );

    setTransactionData((prev) => ({
      ...prev,
      items: updatedItems,
      value: newTotalValue,
    }));
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
        const receiptID = useGeneratorUtils.generateUid("receipt");
        const finalData = {
          ...transactionData,
          _id: receiptID,
          id: receiptID,
          creationDate: new Date().toISOString(),
        };
        response = await useFirestoreServices.addDocument(
          `users/${user?._id}/receipts`,
          finalData
        );
        await updateReceipts("add", finalData);
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
      await updateReceipts("delete", data);
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

      {transactionData?.type && (
        <CustomInput
          type="dropdown"
          options={[
            ...TRANSACTION_CATEGORIES[transactionData?.type],
            ...customCategories,
          ]}
          value={transactionData?.category}
          onChange={(e) => handleUpdateForm("category", e.target.value)}
          placeholder="Category"
        />
      )}

      {transactionData?.category === "Custom" && (
        <CustomInput
          type="text"
          value={transactionData?.customCategory}
          onChange={(e) => handleUpdateForm("customCategory", e.target.value)}
          placeholder="Custom Category"
        />
      )}

      <CustomInput
        type="date"
        value={transactionData?.date}
        onChange={(e) =>
          handleUpdateForm("date", new Date(e.target.value).toISOString())
        }
        placeholder="Transaction Date"
      />

      <CustomInput
        type="dropdown"
        options={paymentMethods}
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

      {/* Items Bought Section */}
      {transactionData?.type === "expenses" && (
        <div className="border rounded-md p-4 space-y-3">
          <h3 className="font-medium text-base">Items Bought</h3>

          {transactionData.items?.length > 0 && (
            <ul className="space-y-2">
              {transactionData.items.map((item, index) => (
                <li
                  key={index}
                  className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-md border"
                >
                  <span>
                    {item.name} x {item.quantity} = {item.total.toFixed(2)}{" "}
                    {transactionData.currency}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <CustomInput
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Item Name"
            />
            <CustomInput
              type="number"
              value={newItem.price}
              onChange={(e) =>
                setNewItem({ ...newItem, price: e.target.value })
              }
              placeholder="Item Price"
            />
            <CustomInput
              type="number"
              value={newItem.quantity}
              onChange={(e) =>
                setNewItem({ ...newItem, quantity: e.target.value })
              }
              placeholder="Quantity"
            />
            <CustomButton label="Add Item" onClick={handleAddItem} />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2 pt-2">
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
