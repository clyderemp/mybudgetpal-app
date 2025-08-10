import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Area,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const AnalyticsCard = ({
  title,
  subtitle,
  value,
  description,
  percentage = 75,
  gradientFrom = "white",
  gradientTo = "purple-300",
  accentColor = "purple-600",
  strokeColor = "#8b5cf6",
  graphType = "radial", // 'radial' | 'line' | 'bar'
  chartData = [],
  comparisonDataKey = null, // e.g. "value2"
  comparisonStrokeColor = "#34d399", // e.g. green
}) => {
  const gradientClass = `bg-gradient-to-br from-${gradientFrom} to-${gradientTo}`;
  const accentTextClass = `text-${accentColor}`;

  const renderGraph = () => {
    switch (graphType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              {/* Area for primary data */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill={strokeColor}
                fillOpacity={0.3}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              {/* Optional comparison line */}
              {comparisonDataKey && (
                <>
                  <Area
                    type="monotone"
                    dataKey={comparisonDataKey}
                    stroke="none"
                    fill={comparisonStrokeColor}
                    fillOpacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey={comparisonDataKey}
                    stroke={comparisonStrokeColor}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill={strokeColor} radius={[4, 4, 0, 0]} />
              {comparisonDataKey && (
                <Bar
                  dataKey={comparisonDataKey}
                  fill={comparisonStrokeColor}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case "radial":
        const radius = 100;
        const circumference = Math.PI * radius;
        return (
          <div className="relative w-full h-44 flex flex-col items-center justify-center">
            <svg
              width="300"
              height="1500"
              viewBox={`-${radius} -${radius * 1.5} ${radius * 2} ${
                radius * 2
              }`}
            >
              {/* Background arc */}
              <path
                d={`M -${radius} 0 A ${radius} ${radius} 0 0 1 ${radius} 0`}
                fill="none"
                stroke="#D3D3D3"
                strokeWidth="25"
                strokeLinecap="round"
              />
              {/* Progress arc */}
              <path
                d={`M -${radius} 0 A ${radius} ${radius} 0 0 1 ${radius} 0`}
                fill="none"
                stroke={strokeColor}
                strokeWidth="25"
                strokeDasharray={`${
                  (percentage / 100) * circumference
                } ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`${gradientClass} bg-white rounded-2xl p-6`}>
      <div className="mb-6">
        <h3 className={`text-lg font-semibold ${accentTextClass} mb-1`}>
          {title}
        </h3>
        <p className="text-gray-600 text-sm">{subtitle}</p>
      </div>

      <div className="text-center">
        <div className="mb-4">
          <h2 className={`text-2xl font-bold ${accentTextClass} mb-2`}>
            {value}
          </h2>
          <p className="text-gray-600 text-sm">{description}</p>
        </div>

        {renderGraph()}
      </div>
    </div>
  );
};

export default AnalyticsCard;
