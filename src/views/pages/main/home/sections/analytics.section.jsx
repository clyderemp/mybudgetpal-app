import React, { useEffect, useState } from "react";
import { Download, TrendingUp, UserCheck, Users } from "lucide-react";
import OverviewCard from "@/views/components/cards/overview.card";
import AnalyticsCard from "@/views/components/cards/analytics.card";
import { useAuth } from "@/context/auth.provider";
import { useCalcUtils } from "@/utils/calculator.utils";
import { useFormUtils } from "@/utils/form.utils";
import { useAnalyticsUtils } from "@/utils/analytics.utils";
import GeographicTable from "@/views/components/tables/geographic.table";

const metrics = [
  {
    icon: TrendingUp,
    label: "Website Visits",
    value: "-10% from yesterday",
    trend: "down",
  },
  {
    icon: Users,
    label: "New Signups",
    value: "+15% from yesterday",
    trend: "up",
  },
  {
    icon: Download,
    label: "App Downloads",
    value: "-16% from yesterday",
    trend: "down",
  },
  {
    icon: UserCheck,
    label: "Active Users",
    value: "+10% from yesterday",
    trend: "up",
  },
];

const AnalyticsSection = () => {
  const { users, waitlist } = useAuth();
  const [acquisitionTracker, setAcquisitionTracker] = useState({
    array: [],
    total: 0,
  });
  const [waitlistTracker, setWaitlistTracker] = useState({
    array: [],
    total: 0,
  });
  const [performanceRate, setPerformanceRate] = useState({
    string: "",
    value: 0,
  });
  const [genderRatio, setGenderRatio] = useState({ string: "", value: 0 });
  const [geographicData, setGeographicData] = useState({
    users: [],
    waitlist: [],
  });

  useEffect(() => {
    runAnalytics();
  }, []);

  const runAnalytics = async () => {
    let maleCount = 0;
    let femaleCount = 0;
    let matchacodeScore = 0;
    let matchacodeMatches = 0;

    users.forEach((user) => {
      const gender = user?.userData?.basicProfile?.gender?.toLowerCase();
      const matchacodeResults = user?.matchacodeData?.matches?.daily || [];
      if (matchacodeResults?.length > 0) {
        matchacodeResults.forEach((match) => {
          matchacodeMatches++;
          matchacodeScore += match.scores.finalScore;
        });
      }
      if (gender === "male") maleCount++;
      else if (gender === "female") femaleCount++;
    });

    const total = maleCount + femaleCount;
    const ratioString =
      total > 0 ? useCalcUtils.getRatioString(maleCount, femaleCount) : "0:0";
    useFormUtils.updateData("string", ratioString, setGenderRatio);
    useFormUtils.updateData(
      "value",
      total > 0 ? (maleCount / total) * 100 : 0,
      setGenderRatio
    );

    useFormUtils.updateData(
      "string",
      matchacodeMatches > 0
        ? (matchacodeScore / matchacodeMatches).toFixed(2)
        : 0,
      setPerformanceRate
    );
    useFormUtils.updateData(
      "value",
      matchacodeMatches > 0
        ? (matchacodeScore / matchacodeMatches).toFixed(2)
        : 0,
      setPerformanceRate
    );

    const userSignup = useAnalyticsUtils.getLast12MonthsData(
      users,
      (user) => new Date(user?.createdOn)
    );
    useFormUtils.updateData("array", userSignup, setAcquisitionTracker);
    useFormUtils.updateData(
      "total",
      (users.length / 12).toFixed(2),
      setAcquisitionTracker
    );

    const waitlistSignup = useAnalyticsUtils.getLast7DaysData(
      waitlist,
      (user) => new Date(user.date)
    );
    useFormUtils.updateData("array", waitlistSignup, setWaitlistTracker);
    useFormUtils.updateData("total", waitlist.length, setWaitlistTracker);

    const userCountryData = useAnalyticsUtils.getCountryCounts(
      users,
      (user) => user?.userData?.basicProfile?.location?.country
    );
    const waitlistCountryData = useAnalyticsUtils.getCountryCounts(
      waitlist,
      (user) => user?.location?.country
    );
    useFormUtils.updateData("users", userCountryData, setGeographicData);
    useFormUtils.updateData("waitlist", waitlistCountryData, setGeographicData);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Top - Overview */}
        <OverviewCard title="Daily Overview" data={metrics} />

        {/* Right Top - Split into 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnalyticsCard
            title="MatchaCode Performance"
            subtitle={`As of ${new Date().toDateString()}`}
            description="Average output match score"
            value={`${performanceRate?.string}%`}
            graphType="radial"
            percentage={performanceRate?.value}
          />
          <AnalyticsCard
            title="Gender Demographics"
            subtitle={`As of ${new Date().toDateString()}`}
            description="Gender Ratio (M:F)"
            value={genderRatio.string}
            graphType="radial"
            percentage={genderRatio.value}
          />
        </div>

        {/* Bottom Left */}
        <AnalyticsCard
          title="Monthly User Acquisition"
          subtitle="Last 7 days"
          description="Average Monthly Acquisition"
          value={acquisitionTracker?.total}
          graphType="line"
          chartData={acquisitionTracker?.array}
        />

        {/* Bottom Right */}
        <AnalyticsCard
          title="Waitlist Signups"
          subtitle="Last 7 days"
          description="Early Adopters Program Total Signups"
          value={waitlistTracker?.total}
          graphType="bar"
          chartData={waitlistTracker?.array}
        />
      </div>
      <GeographicTable
        title={"Location Demographics"}
        usersData={geographicData?.users}
        waitlistData={geographicData?.waitlist}
      />
    </div>
  );
};

export default AnalyticsSection;
