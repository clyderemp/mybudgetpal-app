import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import LocationCard from "@/views/components/cards/location.card";
import DataCorrectorCard from "@/views/components/cards/dataCorrector.card";

const SettingsPage = () => {
  const { activeUser, transactions } = useAuth();
  const date = new Date().toDateString();
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    if (transactions) {
      const now = new Date();
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setDate(now.getDate() - 30);
      const recent = transactions.filter((t) => {
        const txDate = new Date(t?.date);
        return txDate >= oneMonthAgo && txDate <= now;
      });
      setRecentTransactions(recent);
    }
  }, [transactions]);

  return (
    <div className="flex h-screen bg-dashboard-background">
      <div className="flex-1 overflow-auto">
        <div className="p-8 space-y-6">
          <CustomHeaderBanner
            date={date}
            title={`Welcome ${activeUser?.fname}!`}
            message={`Hi! I'm AL, your AI budgetpAL...`}
            buttonText="Chat with AL"
            onButtonClick={() => {}}
            showImage
          />
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationCard />
            <DataCorrectorCard />
          </div>

          {/* Optionally: display recentTransactions here */}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
