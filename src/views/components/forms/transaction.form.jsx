import { useEffect, useState } from "react";
import CustomInput from "../customs/customInput";
import CustomButton from "../customs/customButton";
import { useFormUtils } from "@/utils/form.utils";
import { useAuth } from "@/context/auth.provider";
import { useBackendServices } from "@/services/server/backend.services";
import Loader from "../static/Loader";
import { useModal } from "@/context/modal.provider";

const TransactionForm = ({ data = {}, onSuccess = () => {} }) => {
  const { user } = useAuth();
  const { closeModal } = useModal();

  const [transactionData, setTransactionData] = useState({
    category: "income",
    creation_date: new Date().toISOString(),
    date: "",
    item_id: "",
    note: "",
    paymentMethod: "",
    reportedBy: "",
    transaction: "",
    type: "",
    value: 0,
    ...data,
  });

  const [isFormValid, setIsFormValid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
        response = await useBackendServices.update(
          "transactions",
          data._id,
          transactionData
        );
      } else {
        const finalData = {
          ...transactionData,
          creation_date: new Date().toISOString(),
          adminID: user?.uid,
        };
        response = await useBackendServices.create("transactions", finalData);
      }

      console.log("Transaction saved:", response);
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
      await useBackendServices.delete("transactions", data._id);
      closeModal();
      onSuccess?.();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Loader
        text={data?._id ? "Saving changes..." : "Uploading transaction..."}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {data?._id ? "Edit Transaction" : "Create New Transaction"}
      </h2>

      <CustomInput
        type="text"
        value={transactionData.transaction}
        onChange={(e) => handleUpdateForm("transaction", e.target.value)}
        placeholder="Transaction Name"
      />

      <CustomInput
        type="text"
        value={transactionData.type}
        onChange={(e) => handleUpdateForm("type", e.target.value)}
        placeholder="Transaction Type"
      />

      <CustomInput
        type="text"
        value={transactionData.category}
        onChange={(e) => handleUpdateForm("category", e.target.value)}
        placeholder="Category (income/expense)"
      />

      <CustomInput
        type="date"
        value={transactionData.date}
        onChange={(e) => handleUpdateForm("date", e.target.value)}
        placeholder="Transaction Date"
      />

      <CustomInput
        type="text"
        value={transactionData.item_id}
        onChange={(e) => handleUpdateForm("item_id", e.target.value)}
        placeholder="Item ID"
      />

      <CustomInput
        type="text"
        value={transactionData.paymentMethod}
        onChange={(e) => handleUpdateForm("paymentMethod", e.target.value)}
        placeholder="Payment Method"
      />

      <CustomInput
        type="text"
        value={transactionData.reportedBy}
        onChange={(e) => handleUpdateForm("reportedBy", e.target.value)}
        placeholder="Reported By"
      />

      <CustomInput
        type="text"
        value={transactionData.note}
        onChange={(e) => handleUpdateForm("note", e.target.value)}
        placeholder="Note"
      />

      <CustomInput
        type="number"
        value={transactionData.value}
        onChange={(e) => handleUpdateForm("value", parseFloat(e.target.value))}
        placeholder="Value"
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
