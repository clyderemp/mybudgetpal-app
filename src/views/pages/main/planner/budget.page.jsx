import React, { useEffect, useState, useRef, useCallback } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import { BudgetTable } from "@/views/components/tables/budgetplanner.table";
import { useModal } from "@/context/modal.provider";
import DynamicForm from "@/views/components/forms/dynamic.form";
import { TRANSACTION_CATEGORIES } from "@/constants/transaction.constants";
import { useTextUtils } from "@/utils/text.utils";
import { useCacheUtils } from "@/utils/cache.utils";
import CustomPieChart from "@/views/components/charts/pie.chart";
import Loader from "@/views/components/static/Loader";
import { CheckCheck } from "lucide-react";

const trafficTable = [
  { key: "money-in", label: "Money In" },
  { key: "savings", label: "Savings" },
  { key: "money-out", label: "Money Out" },
  { key: "difference", label: "+/-" },
];

const budgetTable = [
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "actual", label: "Actual" },
  { key: "difference", label: "+/-" },
];

const BudgetPlannerPage = () => {
  const { filteredTransactions, budgetData, updateBudgetData } = useAuth();
  const { openModal, closeModal } = useModal();
  const date = new Date().toDateString();

  const [loading, setLoading] = useState(true);
  const [monthlyBudgetData, setMonthlyBudgetData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const monthRefs = useRef([]); // Store button refs for scrollIntoView

  // Scroll selectedMonth into view when it changes
  useEffect(() => {
    if (!selectedMonth) return;
    const idx = monthlyBudgetData.findIndex(
      (m) => m.label === selectedMonth.label
    );
    if (idx >= 0 && monthRefs.current[idx]) {
      monthRefs.current[idx].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedMonth, monthlyBudgetData]);

  useEffect(() => {
    if (filteredTransactions) fetchMonthlyData();
  }, [filteredTransactions]);

  const fetchMonthlyTxnFilter = useCallback(
    async (month) => {
      setLoading(true);

      const selectedMonthBudget = budgetData?.filter(
        (item) => item.month === month?.value
      );

      const pieMap = {};
      const trafficData = {
        "money-in": 0,
        "money-out": 0,
        savings: 0,
        difference: 0,
      };
      const actualTraffic = {
        "money-in": 0,
        "money-out": 0,
        savings: 0,
        difference: 0,
      };

      // Properly await async operations using for..of
      for (const budget of selectedMonthBudget || []) {
        trafficData[budget.type] =
          Number(trafficData[budget.type].toFixed(2)) + Number(budget.amount);
        budget.amount = Number(budget.amount).toFixed(2);
        budget.actual = 0;

        for (const txn of filteredTransactions.all || []) {
          const dateObj = new Date(txn.date);
          const monthName = dateObj.toLocaleString("default", {
            month: "long",
          });
          const year = dateObj.getFullYear();

          if (`${monthName} ${year}` === month.label) {
            const val = Number(Number(txn.value).toFixed(2));
            const cat = txn.type || "Uncategorized";
            if (budget.categories.includes(txn?.category)) {
              pieMap[cat] = (pieMap[cat] || 0) + val;
              budget.actual += val;
              actualTraffic[budget.type] =
                Number(actualTraffic[budget.type].toFixed(2)) + val;
            } else if (cat === "expenses") {
              const uncat = "Not Budgetted";
              pieMap[uncat] = (pieMap[uncat] || 0) + val;
            }
          }
        }

        budget.actual = Number(budget.actual).toFixed(2);
        budget.difference =
          budget.type === "money-in"
            ? (budget.actual - budget.amount).toFixed(2)
            : (budget.amount - budget.actual).toFixed(2);
      }

      trafficData.difference =
        trafficData["money-in"] -
        (trafficData["savings"] + trafficData["money-out"]);

      setSelectedMonth((prev) => ({
        ...month,
        transactions: selectedMonthBudget,
        budgetData: selectedMonthBudget,
        pieData: Object.entries(pieMap).map(([name, value]) => ({
          name: useTextUtils.capitalize(name),
          value: Number(value.toFixed(2)),
        })),
        budget_traffic: [trafficData],
        actual_traffic: [actualTraffic],
      }));

      setLoading(false);
    },
    [budgetData, filteredTransactions]
  );

  const fetchMonthlyData = async () => {
    let monthsData = await useCacheUtils.get("monthsData");
    const allTxns = filteredTransactions.all || [];

    if (!monthsData) {
      if (!allTxns.length)
        return console.warn("No transactions available yet.");

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
                value: `${year}-${dateObj.getMonth() + 1}`,
                transactions: [],
              },
            ];
          })
        ).values()
      );

      monthsData.forEach((month) => {
        month.transactions = allTxns.filter((txn) => {
          const dateObj = new Date(txn.date);
          const monthName = dateObj.toLocaleString("default", {
            month: "long",
          });
          const year = dateObj.getFullYear();
          return `${monthName} ${year}` === month.label;
        });

        const pieMap = {};
        month.transactions.forEach((txn) => {
          const cat = txn.type || "Uncategorized";
          const value = Number(txn.value);
          pieMap[cat] = (pieMap[cat] || 0) + value;
        });

        month.pieData = Object.entries(pieMap).map(([name, value]) => ({
          name: useTextUtils.capitalize(name),
          value: Number(value.toFixed(2)),
        }));
      });

      await useCacheUtils.save("monthsData", monthsData);
    }

    setMonthlyBudgetData(monthsData);
    if (!selectedMonth && monthsData.length > 0) {
      setSelectedMonth(monthsData[0]);
      await fetchMonthlyTxnFilter(monthsData[0]);
    }
    setLoading(false);
  };

  const handleSave = async (type, data) => {
    const monthDate = new Date(data?.month);
    const filterByMonth = (txn) => {
      const txnDate = new Date(txn?.date);
      return (
        txnDate.getFullYear() === monthDate.getFullYear() &&
        txnDate.getMonth() === monthDate.getMonth()
      );
    };

    const transactions = {
      "money-in": filteredTransactions.income,
      "money-out": filteredTransactions.expenses,
      savings: filteredTransactions.savings,
    };

    const total = transactions[type].reduce((sum, txn) => {
      if (filterByMonth(txn) && data?.categories?.includes(txn.category)) {
        return sum + Number(txn.value);
      }
      return sum;
    }, 0);

    data.type = type;
    data.actual = total.toFixed(2);
    data.difference =
      type === "money-out"
        ? (data.amount - total).toFixed(2)
        : (total - data.amount).toFixed(2);

    await updateBudgetData("edit", data);
    closeModal();
  };

  const handleNewItem = (type, data) => {
    const schema = {
      month: {
        label: "Month",
        type: "dropdown",
        options: monthlyBudgetData.map((month, index) => ({
          key: index,
          label: month.label,
          value: month.value,
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
        options: TRANSACTION_CATEGORIES?.[type],
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

    openModal(
      <DynamicForm
        title={type}
        schema={schema}
        defaultData={data || {}}
        onSubmit={(val) => handleSave(type, data ? { ...data, ...val } : val)}
      />,
      "panel"
    );
  };

  return (
    <div className="flex h-screen flex-col bg-dashboard-background">
      <div className="px-4 pt-4">
        <CustomHeaderBanner
          date={date}
          title="Budget Planner"
          message="Manage all of your reported transactions here."
        />
      </div>

      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="flex flex-1 px-4 gap-2">
            {/* Left Column: Month Selector */}
            <div className="flex flex-col bg-white w-1/3 gap-4 max-h-[500px] rounded-2xl shadow overflow-y-auto">
              {monthlyBudgetData.map((month, idx) => {
                const hasBudgetData = budgetData?.some(
                  (item) => item.month === month.value
                );

                return (
                  <button
                    key={idx}
                    ref={(el) => (monthRefs.current[idx] = el)}
                    onClick={() => fetchMonthlyTxnFilter(month)}
                    className={`flex items-center justify-between px-6 py-3 rounded-lg font-medium transition ${
                      selectedMonth?.label === month.label
                        ? "bg-primary text-white shadow-lg"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>{`${month.label} (${
                      month.transactions?.length || 0
                    })`}</span>

                    {/* ✅ Show Lucide Check if budgetData found */}
                    {hasBudgetData && (
                      <CheckCheck
                        className={`ml-2 h-5 w-5 ${
                          selectedMonth?.label === month.label
                            ? "text-white"
                            : "text-green-600"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Column: Pie Chart */}
            <div className="flex-1 flex justify-center items-center bg-white rounded-2xl shadow p-2 max-h-[600px]">
              <CustomPieChart
                data={selectedMonth?.pieData}
                onReload={async () => {
                  await useCacheUtils.remove("monthsData");
                  fetchMonthlyData();
                }}
              />
            </div>
          </div>

          {/* Bottom Row: Tables */}
          <div className="flex-1 bg-white m-4 rounded-2xl shadow p-2">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <BudgetTable
                title="Planned Budget"
                columns={trafficTable}
                data={selectedMonth?.budget_traffic || []}
              />
              <BudgetTable
                title="Actual Traffic"
                columns={trafficTable}
                data={selectedMonth?.actual_traffic || []}
              />
            </div>

            {["money-in", "money-out", "savings"].map((type) => (
              <BudgetTable
                key={type}
                title={useTextUtils.capitalize(type.replace("-", " "))}
                columns={budgetTable}
                onAdd={() => handleNewItem(type)}
                onRowClick={(row) => handleNewItem(type, row)}
                data={budgetData?.filter(
                  (item) =>
                    item.month === selectedMonth?.value && item.type === type
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BudgetPlannerPage;
