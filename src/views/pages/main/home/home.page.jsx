import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import CustomBlogCards from "@/views/components/customs/customBlogCards";
import { useAuth } from "@/context/auth.provider";
import AnalyticsSection from "./sections/analytics.section";
import ReceiptCards from "@/views/components/cards/receipt.cards";

const HomePage = () => {
  const { user, transactions } = useAuth();
  const date = new Date().toDateString();
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    if (transactions?.length > 0) fetchRecentTransactions();
  }, [transactions]);

  const fetchRecentTransactions = async () => {
    const now = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(now.getDate() - 30);
    const recent = [];
    for (const data of transactions) {
      const date = new Date(data?.date);

      if (date >= twoWeeksAgo && date <= now) {
        recent.push(data); // This transaction is within the past 7 days
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
            title={`Welcome ${user?.fname}!`}
            message={`Hi! I'm AL, your AI budgetpAL. I'll be here to help you budget and achieve your financial goals. Feel free to let me know if you have any concerns or questions!`}
            buttonText="Chat with AL"
            onButtonClick={() => {}}
            showImage
          />

          {/* News Articles Section */}
          <ReceiptCards title="Recent Transactions" data={recentTransactions} />

          {/* Analytics Section */}
          {/* <AnalyticsSection /> */}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
