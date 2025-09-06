import React from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#AF19FF",
  "#FF4560",
  "#1E90FF",
  "#FF8C00",
];

const CustomPieChart = ({ data = [], onReload }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex justify-end w-full">
        {onReload && (
          <button
            onClick={onReload}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark transition"
          >
            Reload
          </button>
        )}
      </div>
      <PieChart width={400} height={400}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
          label
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </div>
  );
};

export default CustomPieChart;
