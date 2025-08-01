import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GenderSignups = () => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalStats, setTotalStats] = useState({ male: 0, female: 0, total: 0 });
  const [maxUsers, setMaxUsers] = useState(100);

  useEffect(() => {
    const fetchGenderData = async () => {
      try {
        console.log("📊 Fetching gender chart data from backend...");
        const response = await fetch("http://localhost:3000/api/mongo/stats/users");
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("📊 Gender chart data received:", result.data);
        
        // Set chart data
        const genderChartData = result.data.monthlyGenderAcquisitions;
        setChartData(genderChartData);
        
        // Set total stats for display
        setTotalStats({
          male: result.data.genderBreakdown.male,
          female: result.data.genderBreakdown.female,
          total: result.data.totalUsers
        });
        
        // Calculate dynamic Y-axis max based on data
        const maxMale = Math.max(...genderChartData.map(item => item.male));
        const maxFemale = Math.max(...genderChartData.map(item => item.female));
        const overallMax = Math.max(maxMale, maxFemale);
        setMaxUsers(Math.ceil(overallMax * 1.2)); // Add 20% padding
        
        setLoading(false);
      } catch (error) {
        console.error("❌ Failed to fetch gender data:", error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchGenderData();
  }, []);

  return (
    <div className="bg-gradient-to-br from-blue-100 to-pink-100 rounded-2xl p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-1">
          Gender Signups
        </h3>
        <p className="text-gray-600 text-sm">Monthly breakdown - Last 12 months</p>
      </div>

      {/* Total Stats Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Male</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {loading ? "..." : totalStats.male.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Female</span>
          </div>
          <div className="text-2xl font-bold text-pink-600">
            {loading ? "..." : totalStats.female.toLocaleString()}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading gender data...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">Error: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorMale" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorFemale" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                domain={[0, maxUsers]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-900">{`${label}`}</p>
                        {payload.map((entry, index) => (
                          <p key={index} style={{ color: entry.color }} className="text-sm">
                            {`${entry.name}: ${entry.value} users`}
                          </p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="female"
                stroke="#ec4899"
                strokeWidth={3}
                fill="url(#colorFemale)"
                name="Female"
              />
              <Area
                type="monotone"
                dataKey="male"
                stroke="#3b82f6"
                strokeWidth={3}
                fill="url(#colorMale)"
                name="Male"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No gender data available</div>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4 text-center">
          <p className="text-gray-600 text-sm">
            Total: {totalStats.total.toLocaleString()} users
          </p>
        </div>
      )}
    </div>
  );
};

export default GenderSignups;
