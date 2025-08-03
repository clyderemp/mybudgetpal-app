import React, { useEffect, useState } from "react";
import Sidebar from "@/views/components/static/Sidebar";
import { useAuth } from "@/context/auth.provider";
import { useExchangeRateServices } from "@/services/server/exchange-rate.services";
import { useCacheUtils } from "@/utils/cache.utils";
import { Outlet } from "react-router-dom";
import { RotateCcw, Menu } from "lucide-react";
import ChatIcon from "@/assets/images/budgetpAL-agent.png";

const MainLayout = () => {
  const { exchangeRate, allExchangeRates, setAllExchangeRates, reloadData } =
    useAuth();
  const currencyCode = exchangeRate?.code;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!allExchangeRates) {
      fetchExchangeRates();
    }
  }, [exchangeRate]);

  const fetchExchangeRates = async () => {
    const storedExchangeRates = await useCacheUtils.get("exchangeRates");

    if (!storedExchangeRates) {
      const rates = await useExchangeRateServices.getExchangeRates(
        currencyCode
      );
      setAllExchangeRates(rates);
      await useCacheUtils.save("exchangeRates", rates);
    } else {
      setAllExchangeRates(storedExchangeRates);
    }
  };

  const handleRefresh = () => {
    reloadData?.();
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex max-h-screen bg-gray-100 relative">
      {/* Sidebar */}
      <div
        className={`fixed z-40 top-0 left-0 h-full transition-transform duration-300 transform bg-white shadow-lg md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:flex`}
      >
        <Sidebar />
      </div>

      {/* Overlay on small screens when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative min-h-screen">
        {/* Mobile Menu Toggle */}
        <div className="p-4 md:hidden flex items-center justify-between">
          <button
            onClick={toggleSidebar}
            className="text-gray-700 hover:text-secondary"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <Outlet />

        {/* Floating Buttons */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-wrap gap-2 sm:gap-3">
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="group bg-white text-gray-800 hover:bg-secondary hover:text-white border border-gray-300 shadow-lg rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-all duration-300"
          >
            <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 transform transition-transform duration-300 group-hover:-rotate-180" />
          </button>

          {/* Chat Button */}
          <button
            className="bg-white hover:bg-secondary border border-gray-300 shadow-lg rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-all duration-300 overflow-hidden"
            onClick={() => console.log("Chat clicked")}
          >
            <img
              src={ChatIcon}
              alt="Chat"
              className="w-8 h-8 sm:w-10 sm:h-10 scale-125 object-contain hover:p-[3px]"
            />
          </button>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
