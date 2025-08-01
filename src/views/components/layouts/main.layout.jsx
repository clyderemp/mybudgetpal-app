import React from "react";
import { Outlet } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import Sidebar from "@/views/components/static/Sidebar";

const MainLayout = () => {
  const handleRefresh = () => {
    window.location.reload(); // Or use custom logic
  };

  return (
    <div className="flex max-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <Outlet />

        {/* Floating Refresh Button */}
        <button
          onClick={handleRefresh}
          className="group fixed bottom-6 right-6 z-50 bg-white text-gray-800 hover:bg-secondary hover:text-white border border-gray-300 shadow-lg rounded-full w-14 h-14 flex items-center justify-center transition-all duration-300"
        >
          <RotateCcw className="w-6 h-6 transform transition-transform duration-300 group-hover:-rotate-180" />
        </button>
      </main>
    </div>
  );
};

export default MainLayout;
