import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import ReceiptCards from "@/views/components/cards/receipt.cards";
import CustomTable from "@/views/components/tables/custom.table";

const IncomePage = () => {
  const { filteredTransactions } = useAuth();
  const transactions = filteredTransactions.income;
  const date = new Date().toDateString();
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [tableEdit, setTableEdit] = useState(null);

  useEffect(() => {
    if (transactions) fetchRecentTransactions();
  }, [transactions]);

  const fetchRecentTransactions = async () => {
    const now = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(now.getDate() - 14);
    const recent = [];
    for (const data of transactions) {
      const date = new Date(data?.date);
      //   console.log(data.currency);
      if (date >= twoWeeksAgo && date <= now) {
        recent.push({ ...data }); // This transaction is within the past 7 days
      }
    }
    setRecentTransactions(recent);
  };

  const handleAction = (type, data) => {
    setTableEdit({ open: true, data: type === "add" ? {} : data });
  };

  return (
    <div className="flex h-screen bg-dashboard-background">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header Section */}
          <CustomHeaderBanner
            date={date}
            title={`Overall Income History`}
            message={`Manage all of your reported income here.`}
            buttonText="Generate income report"
            onButtonClick={() => {}}
            showImage
          />

          {/* News Articles Section */}
          <ReceiptCards
            title={`Recent Transactions (Last 14 days) - Found ${recentTransactions.length} results`}
            data={recentTransactions}
            triggerForm={tableEdit}
            showAddButton
          />
          {filteredTransactions && (
            <CustomTable
              title={"Income History"}
              tableData={{ income: filteredTransactions?.income }}
              defaultTable="income"
              onModify={handleAction}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default IncomePage;
