import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/views/components/static/Sidebar"; // Adjust path if needed

const MainLayout = () => {
  return (
    <div className="flex max-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
