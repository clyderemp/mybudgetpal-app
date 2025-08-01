import { useState } from "react";
import { useTextUtils } from "@/utils/text.utils";


const GeographicTable = ({ title, usersData = [], waitlistData = [], onSwitch }) => {
  const [dataset, setDataset] = useState("Users");

  const data = dataset === "Users" ? usersData : waitlistData;

  // Calculate total users to compute percentages
  const totalUsers = data.reduce((acc, loc) => acc + loc.count, 0) || 1;

  const locationData = data.map((location) => {
    const percentage = Math.round((location.count / totalUsers) * 100);
    const flag = useTextUtils.getFlagEmoji(location.code);
    return {
      country: location.country,
      flag: flag || "🌍",
      users: location.count,
      popularity: Math.min(percentage * 2, 100),
      rate: `${percentage}%`,
    };
  });

  const handleChange = (e) => {
    setDataset(e.target.value);
    if (onSwitch) onSwitch(e.target.value);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        <select
          value={dataset}
          onChange={handleChange}
          className="border text-sm rounded-md px-2 py-1"
        >
          <option value="Users">Users</option>
          <option value="Waitlist">Waitlist</option>
        </select>
      </div>

      {locationData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No location data available
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 pb-2 border-b border-gray-100">
            <div className="col-span-2">Users</div>
            <div className="col-span-4">Country</div>
            <div className="col-span-4">Popularity</div>
            <div className="col-span-2">Rate</div>
          </div>

          {locationData.map((loc, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-4 items-center py-2"
            >
              <div className="col-span-2 font-semibold text-gray-900">
                {loc.users}
              </div>
              <div className="col-span-4 flex items-center space-x-2">
                <span className="text-lg">{loc.flag}</span>
                <span className="text-gray-900 font-medium">{loc.country}</span>
              </div>
              <div className="col-span-4">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loc.popularity}%` }}
                  ></div>
                </div>
              </div>
              <div className="col-span-2">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {loc.rate}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeographicTable;
