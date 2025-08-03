import React, { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import OverviewCard from "@/views/components/cards/overview.card";
import AnalyticsCard from "@/views/components/cards/analytics.card";
import { useAuth } from "@/context/auth.provider";
import { useAnalyticsUtils } from "@/utils/analytics.utils";
import { useTextUtils } from "@/utils/text.utils";
import CustomTable from "@/views/components/tables/custom.table";

const AnalyticsSection = () => {
  const {
    user,
    activeUser,
    coUsers,
    accountUsers,
    transactions,
    filteredTransactions,
    exchangeRate,
  } = useAuth();

  const [weeklyAnalytics, setWeeklyAnalytics] = useState([]);

  const [savingsGoalTracker, setSavingsGoalTracker] = useState({
    string: "",
    value: 0,
    user: activeUser?.fname,
  });
  const [spendingInsightRatio, setSpendingInsightRatio] = useState({
    string: "",
    value: 0,
    user: activeUser?.fname,
  });

  const [tableData, setTableData] = useState({
    weekly: {
      array: [],
      total: 0,
    },
    yearly: {
      array: [],
      total: 0,
    },
  });

  useEffect(() => {
    runAnalytics();
  }, [transactions]);

  const runAnalytics = async () => {
    await fetchExpenseSummmaryOverviewData();
    await fetchSavingsGoalTrackerData();
    await fetchSpendingInsightsData();
    await fetchTableData();
  };

  const fetchExpenseSummmaryOverviewData = async () => {
    const dailyAnalytics = await useAnalyticsUtils.getAverage(
      transactions,
      "daily"
    );
    const monthlyAnalytics = await useAnalyticsUtils.getAverage(
      transactions,
      "monthly"
    );
    const weeklyAnalytics = await useAnalyticsUtils.getAverage(
      transactions,
      "weekly"
    );
    const yearlyAnalytics = await useAnalyticsUtils.getAverage(
      transactions,
      "yearly"
    );

    setWeeklyAnalytics([
      {
        icon: dailyAnalytics?.isHigher ? TrendingUp : TrendingDown,
        label: "Daily Average",
        value: `${useTextUtils.getMoneyText(
          dailyAnalytics.average,
          exchangeRate.code
        )} (${dailyAnalytics?.percent} % from yesterday)`,
        trend: dailyAnalytics?.isHigher ? "down" : "up",
      },
      {
        icon: weeklyAnalytics?.isHigher ? TrendingUp : TrendingDown,
        label: "Weekly Average",
        value: `${useTextUtils.getMoneyText(
          weeklyAnalytics.average,
          exchangeRate.code
        )} (${weeklyAnalytics?.percent} % from last week)`,
        trend: weeklyAnalytics?.isHigher ? "down" : "up",
      },
      {
        icon: monthlyAnalytics?.isHigher ? TrendingUp : TrendingDown,
        label: "Monthly Average",
        value: `${useTextUtils.getMoneyText(
          monthlyAnalytics.average,
          exchangeRate.code
        )} (${monthlyAnalytics?.percent} % from last month)`,
        trend: monthlyAnalytics?.isHigher ? "down" : "up",
      },
      {
        icon: yearlyAnalytics?.isHigher ? TrendingUp : TrendingDown,
        label: "Yearly Average",
        value: `${useTextUtils.getMoneyText(
          yearlyAnalytics.average,
          exchangeRate.code
        )} (${yearlyAnalytics?.percent} % from last year)`,
        trend: yearlyAnalytics?.isHigher ? "down" : "up",
      },
    ]);
  };

  const fetchSavingsGoalTrackerData = async () => {
    const savingsInsights = await useAnalyticsUtils.getUserAnalytics(
      transactions,
      accountUsers,
      "all"
    );
    const totalSavings = Object.values(savingsInsights).reduce((sum, user) => {
      // Ensure savings is a valid number before adding
      const savings =
        typeof user.savings === "number" && !isNaN(user.savings)
          ? user.savings
          : 0;
      return sum + savings;
    }, 0);

    const currency = user?.savings?.currency || "CAD";
    const progress = (totalSavings / user?.savings?.goal) * 100;
    setSavingsGoalTracker({
      string: `${useTextUtils.getMoneyText(
        user?.savings?.goal,
        currency,
        "short"
      )}`,
      value: progress,
      user: activeUser?.fname,
    });
  };

  const fetchSpendingInsightsData = async () => {
    const spendingInsights = useAnalyticsUtils.getUserAnalytics(
      transactions,
      accountUsers,
      "all"
    );
    const activeUserId = activeUser._id;
    const activeUserExpenses =
      spendingInsights[activeUserId]?.expenses?.total || 0;

    // Sum expenses of all other users except activeUser
    const otherUsersExpenses =
      Object.entries(spendingInsights)
        .filter(([uid]) => uid !== activeUserId)
        .reduce((sum, [, data]) => sum + (data.expenses?.total || 0), 0) || 0;

    const ratio =
      otherUsersExpenses > 0 ? activeUserExpenses / otherUsersExpenses : 0;
    setSpendingInsightRatio({
      string: `${useTextUtils.getMoneyText(
        activeUserExpenses,
        exchangeRate.code,
        "short"
      )} : ${useTextUtils.getMoneyText(
        otherUsersExpenses,
        exchangeRate.code,
        "short"
      )}`,
      value: ratio,
      user: `${activeUser.fname}`,
    });
  };

  const fetchTableData = async () => {
    const last7DaysSpending = await useAnalyticsUtils.getLast7DaysData(
      "expenses",
      transactions
    );

    const totalWeeklySpending = last7DaysSpending.reduce((sum, item) => {
      const val =
        typeof item.value === "number" && !isNaN(item.value) ? item.value : 0;
      return sum + val;
    }, 0);

    const dailyAverage = totalWeeklySpending / (last7DaysSpending.length || 1);

    const lastYearSpending = await useAnalyticsUtils.getLast12MonthsData(
      "expenses",
      transactions
    );
    const totalYearSpending = lastYearSpending.reduce((sum, item) => {
      const val =
        typeof item.value === "number" && !isNaN(item.value) ? item.value : 0;
      return sum + val;
    }, 0);

    const monthlyAverage = totalYearSpending / (lastYearSpending.length || 1);

    setTableData({
      weekly: {
        array: last7DaysSpending,
        total: useTextUtils.getMoneyText(
          dailyAverage,
          exchangeRate?.code,
          "short"
        ),
      },
      yearly: {
        array: lastYearSpending,
        total: useTextUtils.getMoneyText(
          monthlyAverage,
          exchangeRate?.code,
          "short"
        ),
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Top - Overview */}
        <OverviewCard
          title={"Expense Summary Overview"}
          data={weeklyAnalytics}
        />

        {/* Right Top - Split into 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnalyticsCard
            title="Savings Goal Tracker"
            subtitle={`As of ${new Date().toDateString()}`}
            description={`${savingsGoalTracker?.value?.toFixed(
              0
            )}% towards achieving your savings goal`}
            value={`${savingsGoalTracker?.string}`}
            graphType="radial"
            percentage={savingsGoalTracker?.value}
          />
          <AnalyticsCard
            title={`Spending Insights`}
            subtitle={`As of ${new Date().toDateString()}`}
            description={`${spendingInsightRatio?.user} (You) : Others`}
            value={spendingInsightRatio?.string}
            graphType="radial"
            percentage={spendingInsightRatio?.value}
          />
        </div>

        {/* Bottom Left */}
        <AnalyticsCard
          title="Weekly Expense Tracker"
          subtitle="Last 7 days"
          description="Daily Spending Average"
          value={tableData?.weekly?.total}
          graphType="line"
          chartData={tableData?.weekly?.array}
        />

        {/* Bottom Right */}
        <AnalyticsCard
          title="Monthly Expense Tracker"
          subtitle="Last 12 months"
          description="Monthly Spending Average"
          value={tableData?.yearly?.total}
          graphType="bar"
          chartData={tableData?.yearly?.array}
        />
      </div>
      {filteredTransactions && (
        <CustomTable title={"Receipts"} tableData={filteredTransactions} />
      )}
    </div>
  );
};

export default AnalyticsSection;
