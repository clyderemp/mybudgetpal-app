import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import AnalyticsSection from "./sections/analytics.section";
import ReceiptCards from "@/views/components/cards/receipt.cards";

const HomePage = () => {
  const { user, activeUser, transactions } = useAuth();
  console.log(user);
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
      //   console.log(data.currency);
      if (date >= oneMonthAgo && date <= now) {
        recent.push({ ...data }); // This transaction is within the past 30 days
      }
    }
    setRecentTransactions(recent);
  };

  return (
    <div className="flex h-screen bg-dashboard-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header Section */}
          <CustomHeaderBanner
            date={date}
            title={`Welcome ${activeUser?.fname}!`}
            message={`Hi! I'm AL, your AI budgetpAL. I'll be here to help you budget and achieve your financial goals. Feel free to let me know if you have any concerns or questions!`}
            buttonText="Chat with AL"
            onButtonClick={() => {}}
            showImage
          />

          {/* News Articles Section */}
          <ReceiptCards
            title={`Recent Transactions (Last 30 days) - Found ${recentTransactions.length} results`}
            data={recentTransactions}
          />

          {/* Analytics Section */}
          <AnalyticsSection />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
