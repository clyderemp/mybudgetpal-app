import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import { BudgetTable } from "@/views/components/tables/budgetplanner.table";
import { useModal } from "@/context/modal.provider";
import DynamicForm from "@/views/components/forms/dynamic.form";
import { TRANSACTION_CATEGORIES } from "@/constants/transaction.constants";
import { useDateUtils } from "@/utils/date.utils";
import { useTextUtils } from "@/utils/text.utils";
import { useCacheUtils } from "@/utils/cache.utils";
import CustomPieChart from "@/views/components/charts/pie.chart";

const budgetTable = [
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "actual", label: "Actual" },
  { key: "difference", label: "+/-" },
];

const BudgetPlannerPage = () => {
  const {
    accountUsers,
    exchangeRate,
    filteredTransactions,
    budgetData,
    updateBudgetData,
  } = useAuth();
  const { openModal, closeModal } = useModal();
  const date = new Date().toDateString();
  const [monthlyBudgetData, setMonthlyBudgetData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  useEffect(() => {
    if (filteredTransactions) fetchMonthlyData();
  }, [filteredTransactions]);

  const fetchMonthlyData = async () => {
    // Step 0: Try to get cached data
    let monthsData = await useCacheUtils.get("monthsData");

    if (!monthsData) {
      // Wait until transactions are loaded
      const allTxns = filteredTransactions.all || [];
      if (!allTxns.length) {
        console.warn("No transactions available yet.");
        return;
      }

      // Step 1: Group transactions by month
      monthsData = Array.from(
        new Map(
          allTxns.map((txn) => {
            const dateObj = new Date(txn.date);
            const monthName = dateObj.toLocaleString("default", {
              month: "long",
            });
            const year = dateObj.getFullYear();
            const label = `${monthName} ${year}`;
            return [
              label,
              {
                label,
                value: `${year}-${dateObj.getMonth() + 1}`, // unique month value
                transactions: [txn],
              },
            ];
          })
        ).values()
      );

      // Step 2: Merge transactions for the same month
      monthsData.forEach((month) => {
        month.transactions = allTxns.filter((txn) => {
          const dateObj = new Date(txn.date);
          const monthName = dateObj.toLocaleString("default", {
            month: "long",
          });
          const year = dateObj.getFullYear();
          return `${monthName} ${year}` === month.label;
        });

        // Step 3: Generate pieData by category as objects { name, value }
        const pieMap = {};

        month.transactions.forEach((txn) => {
          const cat = txn.type || "Uncategorized";
          const value = JSON.parse(txn?.value) || 0;
          pieMap[cat] = (pieMap[cat] || 0) + value;
        });

        month.pieData = Object.entries(pieMap).map(([name, value]) => ({
          name: useTextUtils.capitalize(name),
          value: Number(value.toFixed(2)),
        }));
      });

      // Step 4: Save computed data to cache
      await useCacheUtils.save("monthsData", monthsData);
    }

    // Step 5: Update state

    if (!selectedMonth) setSelectedMonth(monthsData[0]);
    setMonthlyBudgetData(monthsData);
  };

  const handleSave = async (type, data) => {
    const selectedMonth = new Date(data?.month); // first of the month
    switch (type) {
      case "money-in":
        const totalMoneyIn = filteredTransactions.income.reduce((sum, txn) => {
          const txnDate = new Date(txn?.date);

          // Check if txn is in the same month/year as selectedMonth
          const withinDateFrame =
            txnDate.getFullYear() === selectedMonth.getFullYear() &&
            txnDate.getMonth() === selectedMonth.getMonth();

          if (withinDateFrame && data?.categories?.includes(txn.category)) {
            return sum + Number(txn.value); // always parse value as number
          }

          return sum;
        }, 0);
        data.type = "money-in";
        data.actual = totalMoneyIn?.toFixed(2);
        data.difference = (totalMoneyIn?.toFixed(2) - data?.amount).toFixed(2);
        break;

      case "money-out":
        const totalMoneyOut = filteredTransactions.expenses.reduce(
          (sum, txn) => {
            const txnDate = new Date(txn?.date);

            // Check if txn is in the same month/year as selectedMonth
            const withinDateFrame =
              txnDate.getFullYear() === selectedMonth.getFullYear() &&
              txnDate.getMonth() === selectedMonth.getMonth();

            if (withinDateFrame && data?.categories?.includes(txn.category)) {
              return sum + Number(txn.value); // always parse value as number
            }

            return sum;
          },
          0
        );
        data.type = "money-out";
        data.actual = totalMoneyOut?.toFixed(2);
        data.difference = (data?.amount - totalMoneyOut?.toFixed(2)).toFixed(2);
        break;
    }
    await updateBudgetData("edit", data);
    closeModal();
  };

  const handleNewItem = (type, data) => {
    let form = null;
    switch (type) {
      case "money-in":
        const moneyInSchema = {
          month: {
            label: "Month",
            type: "dropdown",
            options: monthlyBudgetData.map((month, index) => ({
              key: index, // unique key
              label: month.label, // e.g. "January 2025"
              value: month.value, // e.g. "2025-0"
            })),
            placeholder: "a month",
            allowEdit: true,
          },
          name: {
            label: "Category",
            placeholder: "Enter category name",
            type: "text",
            allowEdit: true,
          },
          categories: {
            label: "Select category filter",
            type: "dropdown",
            options: TRANSACTION_CATEGORIES?.income,
            placeholder: "Choose category",
            multiSelect: true,
            allowEdit: true,
          },
          amount: {
            label: "Expected",
            type: "money",
            placeholder: "Enter expected amount",
            allowEdit: true,
          },
        };

        form = (
          <DynamicForm
            title={"Money in"}
            schema={moneyInSchema}
            defaultData={data || {}}
            onSubmit={(val) => {
              handleSave("money-in", data ? { ...data, ...val } : val);
            }}
          />
        );
        break;
      case "money-out":
        const moneyOutSchema = {
          month: {
            label: "Month",
            type: "dropdown",
            options: monthlyBudgetData.map((month, index) => ({
              key: index, // unique key
              label: month.label, // e.g. "January 2025"
              value: month.value, // e.g. "2025-0"
            })),
            placeholder: "a month",
            allowEdit: true,
          },
          name: {
            label: "Category",
            placeholder: "Enter category name",
            type: "text",
            allowEdit: true,
          },
          categories: {
            label: "Select category filter",
            type: "dropdown",
            options: TRANSACTION_CATEGORIES?.expenses,
            placeholder: "Choose category",
            multiSelect: true,
            allowEdit: true,
          },
          amount: {
            label: "Expected",
            type: "money",
            placeholder: "Enter expected amount",
            allowEdit: true,
          },
        };

        form = (
          <DynamicForm
            title={"Money out"}
            schema={moneyOutSchema}
            defaultData={data || {}}
            onSubmit={(val) => {
              handleSave("money-out", data ? { ...data, ...val } : val);
            }}
          />
        );
        break;
      default:
        break;
    }

    if (form) openModal(form, "panel");
  };

  return (
    <div className="flex h-screen flex-col bg-dashboard-background">
      {/* Header Section */}
      <div className="px-8 pt-8">
        <CustomHeaderBanner
          date={date}
          title={`Budget Planner`}
          message={`Manage all of your reported transactions here.`}
        />
      </div>

      {/* Top Row */}
      <div className="flex flex-1 px-6 gap-6">
        {/* Left Column - Month Buttons */}
        <div className="flex flex-col w-1/3 gap-4 max-h-[400px] overflow-y-auto pr-2">
          {monthlyBudgetData?.map((month, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedMonth(month);
              }}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                selectedMonth?.label === month?.label
                  ? "bg-primary text-white shadow-lg"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {`${month?.label} (${month?.transactions?.length})`}
            </button>
          ))}
        </div>

        {/* Right Column - Pie Chart */}
        <div className="flex-1 flex justify-center items-center bg-white rounded-2xl shadow p-4">
          <CustomPieChart
            data={selectedMonth?.pieData}
            onReload={async () => {
              await useCacheUtils.remove("monthsData");
              fetchMonthlyData();
            }}
          />
        </div>
      </div>

      {/* Bottom Row - Table */}
      <div className="flex-1 bg-white m-6 rounded-2xl shadow">
        <BudgetTable
          title="Money In"
          columns={budgetTable}
          onAdd={() => {
            handleNewItem("money-in");
          }}
          onRowClick={(row) => handleNewItem("money-in", row)}
          data={budgetData?.filter(
            (item) =>
              item.month === selectedMonth?.value && item?.type === "money-in"
          )}
        />

        <BudgetTable
          title="Money Out"
          columns={budgetTable}
          onAdd={() => {
            handleNewItem("money-out");
          }}
          onRowClick={(row) => handleNewItem("money-out", row)}
          data={budgetData?.filter(
            (item) =>
              item.month === selectedMonth?.value && item?.type === "money-out"
          )}
        />
      </div>
    </div>
  );
};

export default BudgetPlannerPage;
