import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import PaymentCard from "@/views/components/cards/payment.card";
import { useModal } from "@/context/modal.provider";
import PaymentCardForm from "@/views/components/forms/paymentCard.form";
import { useGeneratorUtils } from "@/utils/generator.utils";

const CardsPage = () => {
  const {
    activeUser,
    transactions,
    financialAccounts,
    updateFinancialAccounts,
  } = useAuth();
  const { openModal, closeModal } = useModal();
  const date = new Date().toDateString();
  const [recentTransactions, setRecentTransactions] = useState([]);
  useEffect(() => {
    if (transactions) fetchRecentTransactions();
  }, [transactions]);

  const fetchRecentTransactions = async () => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);
    const recent = [];
    for (const data of transactions) {
      const date = new Date(data?.date);
      if (date >= oneMonthAgo && date <= now) {
        recent.push({ ...data }); // This transaction is within the past 30 days
      }
    }
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

          {/* Default Accounts */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Card Accounts</h2>
            <div className="flex space-x-6 overflow-x-auto">
              {financialAccounts?.map((acc) => (
                <PaymentCard
                  onEdit={handleOpenForm}
                  onDelete={handleManageAccount}
                  key={acc.id}
                  data={{
                    owner: activeUser?.fname || "Cardholder",
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
