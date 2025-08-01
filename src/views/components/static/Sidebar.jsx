import { useAuth } from "@/context/auth.provider";
import {
  BarChart3,
  LineChart,
  ChevronDown,
  ChevronRight,
  Database,
  Users,
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTextUtils } from "@/utils/text.utils";
import { MODE } from "@/configs/servers.config";

const Sidebar = () => {
  const { logout, user, reloadData } = useAuth();
  const accountName = `${user?.fname} ${user?.lname}` || "Admin";
  const [isHoveringEnv, setIsHoveringEnv] = useState(false);
  const environment = useTextUtils.capitalize(MODE);
  const navigate = useNavigate();
  const location = useLocation();

  const [expandedItems, setExpandedItems] = useState({
    "data-management":
      location.pathname.includes("/data-management") ||
      location.pathname.includes("/app-users"),
  });

  const navigationItems = [
    { name: "Dashboard Overview", icon: LayoutDashboard, path: "/" },
    {
      name: "Specifications",
      icon: Database,
      path: "/specifications",
      hasSubmenu: true,
      key: "specifications",
      submenu: [
        { name: "MatchaCode", path: "/specifications/matchacode" },
        { name: "CuePid", path: "/specifications/cuepid" },
        { name: "VisMatch", path: "/specifications/vismatch" },
        { name: "Digital Twin Dating", path: "/specifications/dtd" },
      ],
    },
    {
      name: "Accounts",
      icon: Users,
      path: "/accounts",
      hasSubmenu: true,
      key: "accounts",
      submenu: [
        { name: "Admin Accounts", path: "/accounts/admin" },
        { name: "User Accounts", path: "/accounts/users" },
        { name: "Waitlist Users", path: "/accounts/waitlist" },
      ],
    },
    { name: "Chats", icon: MessageSquare, path: "/chats" },
    {
      name: "Marketing",
      icon: LineChart,
      path: "/marketing",
      hasSubmenu: true,
      key: "marketing",
      submenu: [
        { name: "Blogs & Articles", path: "/marketing/blogs" },
        { name: "Content Calendar", path: "/marketing/users" },
        { name: "Analytics", path: "/marketing/analytics" },
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

  return (
    <div className="w-60 bg-white h-screen shadow-lg flex flex-col">
      {/* Profile */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-semibold">
            {useTextUtils.getInitials(accountName)}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-1">
              <h3 className="font-semibold text-gray-900">{`${user.fname} ${user.lname[0]}.`}</h3>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">{user?.role}</p>
          </div>
        </div>
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
            if (user?.uid) reloadData("all");
          }}
          className={`w-full px-3 py-2 rounded-full text-sm font-medium text-center transition-colors ${
            isHoveringEnv
              ? "bg-primary text-white"
              : MODE === "production"
              ? "bg-secondary text-white"
              : MODE === "development"
              ? "bg-primary text-white"
              : MODE === "testing"
              ? "bg-warning text-white"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {isHoveringEnv
            ? "Reload Data"
            : `${useTextUtils.getEnvironmentModeEmoji(environment)} ${
                environment.charAt(0).toUpperCase() + environment.slice(1)
              } Mode`}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
