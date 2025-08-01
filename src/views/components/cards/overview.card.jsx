import React from "react";

const OverviewCard = ({ title = "Daily Overview", date = new Date().toDateString(), data = [] }) => {
  return (
    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-1">{title}</h3>
        <p className="text-purple-100 text-sm">as of {date}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {data.map(({ icon: Icon, label, value, trend }, index) => (
          <div
            key={index}
            className="bg-white bg-opacity-10 rounded-xl p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <Icon className="w-6 h-6 text-white" />
              <div
                className={`text-xs px-2 py-1 rounded-full ${
                  trend === "up"
                    ? "bg-green-500 bg-opacity-20 text-green-100"
                    : "bg-red-500 bg-opacity-20 text-red-100"
                }`}
              >
                {trend === "up" ? "+" : "-"}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-sm mb-1">{label}</h4>
              <p className="text-xs text-purple-100">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OverviewCard;
