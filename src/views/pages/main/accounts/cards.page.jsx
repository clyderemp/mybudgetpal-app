import React, { useEffect, useMemo, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import PaymentCard from "@/views/components/cards/payment.card";
import { useModal } from "@/context/modal.provider";
import PaymentCardForm from "@/views/components/forms/paymentCard.form";
import { useGeneratorUtils } from "@/utils/generator.utils";
import CustomInput from "@/views/components/customs/customInput";

const CardsPage = () => {
  const {
    activeUser,
    accountUsers,
    transactions,
    financialAccounts,
    updateFinancialAccounts,
  } = useAuth();
  const { openModal, closeModal } = useModal();
  const date = new Date().toDateString();

  const [selectedUserId, setSelectedUserId] = useState("all");
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    if (transactions) fetchRecentTransactions();
  }, [transactions]);

  const fetchRecentTransactions = async () => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);
    const recent = transactions.filter((tx) => {
      const txDate = new Date(tx?.date);
      return txDate >= oneMonthAgo && txDate <= now;
    });
    setRecentTransactions(recent);
  };

  const handleOpenForm = (formData = null) => {
    openModal(
      <PaymentCardForm
        data={formData}
        onSubmit={(data) =>
          handleManageAccount(formData ? "update" : "add", data)
        }
      />
    );
  };

  const handleManageAccount = async (type, data) => {
    data = {
      ...data,
      id: data?.id ? data?.id : useGeneratorUtils.generateUid("card"),
      date: new Date().toISOString(),
    };
    await updateFinancialAccounts(type, data);
    closeModal();
  };

  // Get unique account holders from financialAccounts
  const accountHolders = useMemo(() => {
    const owners = financialAccounts?.map((acc) => acc.owner);
    return [...new Set(owners)];
  }, [financialAccounts]);

  const filteredAccounts = useMemo(() => {
    if (selectedUserId === "all") return financialAccounts;
    return financialAccounts?.filter((acc) => acc.owner === selectedUserId);
  }, [financialAccounts, selectedUserId]);

  return (
    <div className="flex h-screen bg-dashboard-background">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <CustomHeaderBanner
            date={date}
            title={`Cards Account Manager`}
            message={`To better manage your finances, help us understand your card usages based on your reported transactions. Manage your accounts here.`}
            buttonText="Chat with AL"
            onButtonClick={() => {}}
            showImage
          />

          {/* Card Accounts */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Card Accounts</h2>
              <div className="w-48">
                <CustomInput
                  type="dropdown"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  placeholder="Filter by Account Holder"
                  options={[
                    { label: "All Users", value: "all" },
                    ...accountHolders.map((holderId) => ({
                      value: holderId,
                      label: accountUsers?.[holderId]?.fname || "Unknown User",
                    })),
                  ]}
                />
              </div>
            </div>

            <div className="flex space-x-6 overflow-x-auto">
              {filteredAccounts?.map((acc) => (
                <PaymentCard
                  onEdit={handleOpenForm}
                  onDelete={handleManageAccount}
                  key={acc.id}
                  data={{
                    owner: accountUsers?.[acc.owner]?.fname || "Cardholder",
                    ...acc,
                  }}
                />
              ))}

              {/* Always show Add Account Card */}
              <div
                onClick={() => handleOpenForm()}
                className="min-w-[320px] h-[200px] flex flex-col justify-center items-center border-2 border-dashed border-gray-400 rounded-xl p-6 text-gray-500 cursor-pointer hover:bg-gray-100 hover:text-gray-900 transition"
              >
                <div className="text-4xl font-bold mb-2">+</div>
                <div>Add a card</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CardsPage;
