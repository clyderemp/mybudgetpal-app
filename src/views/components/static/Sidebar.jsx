import { useAuth } from "@/context/auth.provider";
import {
  BarChart3,
  LineChart,
  ChevronDown,
  ChevronRight,
  Database,
  Users,
  LayoutDashboard,
  ShoppingBasket,
  Settings,
  LogOut,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTextUtils } from "@/utils/text.utils";
import { MODE } from "@/configs/servers.config";
import { useDateUtils } from "@/utils/date.utils";
import { CURRENCIES } from "@/constants/currencies.constants";
import { useModal } from "@/context/modal.provider";
import CurrencySelectorModal from "../modals/currencySelector.modal";
import { useToast } from "@/context/toast.provider";
import { useExchangeRateServices } from "@/services/server/exchange-rate.services";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useCacheUtils } from "@/utils/cache.utils";

const Sidebar = () => {
  const {
    logout,
    user,
    activeUser,
    switchActiveUser,
    accountUsers,
    exchangeRate,
    setExchangeRate,
    allExchangeRates,
    setAllExchangeRates,
    runRateConversion,
  } = useAuth();

  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const [isHoveringEnv, setIsHoveringEnv] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const accountName = `${activeUser?.fname} ${activeUser?.lname}` || "Admin";
  const environment = useTextUtils.capitalize(MODE);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const [expandedItems, setExpandedItems] = useState({
    "data-management":
      location.pathname.includes("/data-management") ||
      location.pathname.includes("/app-users"),
  });

  const navigationItems = [
    { name: "Dashboard Overview", icon: LayoutDashboard, path: "/" },
    {
      name: "Transaction History",
      icon: Database,
      path: "/transactions",
      hasSubmenu: true,
      key: "transactions",
      submenu: [
        { name: "Overall History", path: "/transactions/all" },
        { name: "Expense History", path: "/transactions/expenses" },
        { name: "Income History", path: "/transactions/income" },
        { name: "Savings History", path: "/transactions/savings" },
        { name: "Credit History", path: "/transactions/credit" },
      ],
    },
    {
      name: "Account Manager",
      icon: Users,
      path: "/accounts",
      hasSubmenu: true,
      key: "accounts",
      submenu: [
        { name: "Co-User Accounts", path: "/accounts/users" },
        { name: "Financial Accounts", path: "/accounts/financial" },
      ],
    },
    {
      name: "Shopping Tools",
      icon: ShoppingBasket,
      path: "/shopping",
      hasSubmenu: true,
      key: "shopping",
      submenu: [
        { name: "Grocery List", path: "/shopping/grocery" },
        { name: "Store Finder", path: "/shopping/stores" },
        { name: "Coupon Finder", path: "/shopping/coupons" },
      ],
    },
    { name: "Reports", icon: BarChart3, path: "/reports" },
  ];

  const handleNavigation = (path) => navigate(path);

  const toggleSubmenu = (key) =>
    setExpandedItems((prev) => ({ ...prev, [key]: !prev[key] }));

  const isActive = (path) => location.pathname === path;

  const isParentActive = (item) =>
    item.submenu?.some((sub) => location.pathname === sub.path);

  const handleOpenCurrencyModal = () => {
    openModal(
      <CurrencySelectorModal
        exchangeRates={allExchangeRates} // [{ code, symbol, rate }]
        selectedCurrency={exchangeRate}
        onSelect={async (data) => {
          const flag = CURRENCIES.flags[data?.code];
          const newRates = await useExchangeRateServices.getExchangeRates(
            data?.code
          );
          setAllExchangeRates(newRates);
          const newExchangeRate = { ...data, flag };
          setExchangeRate(newExchangeRate);
          closeModal();
          await useFirestoreServices.updateDocument("users", user?._id, {
            exchangeRate: newExchangeRate,
          });
          await useCacheUtils.save("exchangeRateData", newExchangeRate);
          showToast(
            `Currency set to ${flag} (${data?.symbol}) ${data?.code}.`,
            "success"
          );
          runRateConversion(true);
        }}
      />
    );
  };

  return (
    <div className="w-70 bg-white h-screen shadow-lg flex flex-col">
      {/* Profile with User Switcher */}
      <div className="p-4 border-b border-gray-100 relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-3 w-full focus:outline-none"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-semibold">
            {useTextUtils.getInitials(accountName)}
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center space-x-1">
              <h3 className="font-semibold text-gray-900">
                {`${activeUser.fname} ${activeUser.lname[0]}.`}
              </h3>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500">
              {`Member since ${useDateUtils.getFormattedDateString(
                activeUser.createdOn
              )}`}
            </p>
          </div>
        </button>

        {dropdownOpen && (
          <ul
            role="listbox"
            className="absolute left-4 right-4 mt-2 bg-white border border-gray-200 rounded shadow max-h-60 overflow-auto z-50"
          >
            {/* Co-users */}
            {Object.entries(accountUsers).map(([uid, u]) => (
              <li
                key={uid}
                className={`cursor-pointer px-4 py-2 hover:bg-gray-100 ${
                  activeUser._id === uid ? "bg-gray-100 font-semibold" : ""
                }`}
                onClick={() => {
                  if (activeUser._id !== uid) switchActiveUser(uid);
                  setDropdownOpen(false);
                }}
              >
                {`${u.fname} ${u.lname}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {navigationItems.map((item, index) => (
            <div key={index}>
              <div
                onClick={() =>
                  item.hasSubmenu
                    ? toggleSubmenu(item.key)
                    : handleNavigation(item.path)
                }
                className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isActive(item.path) || isParentActive(item)
                    ? "bg-purple-50 text-secondary"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 mr-3 ${
                    isActive(item.path) || isParentActive(item)
                      ? "text-secondary"
                      : "text-gray-400"
                  }`}
                />
                <span className="flex-1 text-sm font-medium">{item.name}</span>
                {item.hasSubmenu &&
                  (expandedItems[item.key] ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  ))}
              </div>

              {/* Submenu */}
              {expandedItems[item.key] && item.submenu && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.submenu.map((subItem, subIndex) => (
                    <div
                      key={subIndex}
                      onClick={() => handleNavigation(subItem.path)}
                      className={`px-3 py-1 text-sm cursor-pointer rounded transition-colors ${
                        isActive(subItem.path)
                          ? "text-secondary bg-blue-50 border-r-2 border-secondary"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {subItem.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Settings & Logout */}
      <div className="px-3 py-2 space-y-1">
        <div
          onClick={() => handleNavigation("/settings")}
          className="flex items-center px-3 py-2 rounded-lg cursor-pointer text-gray-700 hover:bg-gray-50"
        >
          <Settings className="w-5 h-5 mr-3 text-gray-400" />
          <span className="text-sm font-medium">Settings</span>
        </div>

        <div
          onClick={() => logout()}
          className="flex items-center px-3 py-2 rounded-lg cursor-pointer text-gray-700 hover:bg-gray-50"
        >
          <LogOut className="w-5 h-5 mr-3 text-gray-400" />
          <span className="text-sm font-medium">Logout</span>
        </div>
      </div>

      {/* Environment Badge */}
      <div className="p-4">
        <button
          onMouseEnter={() => setIsHoveringEnv(true)}
          onMouseLeave={() => setIsHoveringEnv(false)}
          onClick={() => {
            if (exchangeRate) handleOpenCurrencyModal();
          }}
          className={`w-full px-3 py-2 rounded-full text-sm font-medium text-center transition-colors ${
            isHoveringEnv ? "bg-primary text-white" : "bg-secondary text-white"
          }`}
        >
          {isHoveringEnv
            ? "Change Currency"
            : `Currency: ${exchangeRate?.flag} ${exchangeRate?.code} (${
                CURRENCIES.symbols[exchangeRate?.code]
              })`}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
