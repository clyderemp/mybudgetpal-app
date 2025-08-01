import { Filter, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../../components/static/Sidebar";
import {
  DataTable,
  PageHeader,
  StatusBadge,
  TabNavigation,
} from "../../../../components/customs";

const AppUsers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    usersPerPage: 50,
  });

  // Fetch users from backend
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        console.log("👥 Fetching users from backend...");

        const queryParams = new URLSearchParams({
          page: pagination.currentPage.toString(),
          limit: pagination.usersPerPage.toString(),
          search: searchTerm,
          status: activeTab === "all" ? "" : activeTab,
        });

        const response = await fetch(
          `http://localhost:3000/api/mongo/users?${queryParams}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("👥 Users data received:", result.data);

        setUsers(result.data.users);
        setPagination(result.data.pagination);
        setError(null);
      } catch (error) {
        console.error("❌ Failed to fetch users:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [pagination.currentPage, searchTerm, activeTab]);

  const tabs = [
    { key: "all", label: "All Users", count: pagination.totalUsers },
    {
      key: "active",
      label: "Active",
      count: users.filter((u) => u.status === "active").length,
    },
    {
      key: "inactive",
      label: "Inactive",
      count: users.filter((u) => u.status === "inactive").length,
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (user) => (
        <div className="flex items-center space-x-3">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full"
          />
          <div>
            <span className="font-medium">{user.name}</span>
            {user.isVerified && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                Verified
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
    },
    {
      key: "phone",
      header: "Phone Number",
    },
    {
      key: "location",
      header: "Location",
      render: (user) => (
        <span className="text-sm text-gray-600">
          {user.location !== "N/A"
            ? `${user.location}, ${user.country}`
            : user.country}
        </span>
      ),
    },
    {
      key: "accountTier",
      header: "Account Tier",
      render: (user) => (
        <StatusBadge
          status={user.accountTier}
          variant={user.accountTier.toLowerCase()}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <StatusBadge
          status={user.status}
          variant={user.status === "active" ? "success" : "warning"}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Created on",
    },
  ];

  const filteredUsers = users;

  const handleUserView = (user) => {
    navigate(`/data-management/app-users/${user.id}`);
  };

  const handleUserEdit = (user) => {
    console.log("Edit user:", user);
    // Navigate to edit page or open modal
  };

  const handleUserDelete = (user) => {
    console.log("Delete user:", user);
    // Show confirmation dialog
  };

  const handleRowClick = (user) => {
    navigate(`/data-management/app-users/${user.id}`);
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, currentPage: newPage }));
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPagination((prev) => ({ ...prev, currentPage: 1 })); // Reset to first page on search
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <PageHeader
            title="App Users"
            subtitle="Manage your application users"
          />

          {/* Tab Navigation */}
          <div className="mb-6">
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {/* Search and Filter Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {loading
                  ? "Loading..."
                  : `Showing ${
                      (pagination.currentPage - 1) * pagination.usersPerPage + 1
                    } - ${Math.min(
                      pagination.currentPage * pagination.usersPerPage,
                      pagination.totalUsers
                    )} of ${pagination.totalUsers} results`}
              </span>
              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Filter className="w-4 h-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading users...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">Error: {error}</p>
            </div>
          )}

          {/* Users Table */}
          {!loading && !error && (
            <DataTable
              data={filteredUsers}
              columns={columns}
              onView={handleUserView}
              onEdit={handleUserEdit}
              onDelete={handleUserDelete}
              onRowClick={handleRowClick}
            />
          )}

          {/* Pagination */}
          {!loading && !error && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center mt-6">
              <div className="flex space-x-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    pagination.hasPrevPage
                      ? "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  }`}
                >
                  Previous
                </button>

                {/* Page Numbers */}
                {Array.from(
                  { length: Math.min(5, pagination.totalPages) },
                  (_, i) => {
                    const pageNum = Math.max(1, pagination.currentPage - 2) + i;
                    if (pageNum > pagination.totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          pageNum === pagination.currentPage
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                )}

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    pagination.hasNextPage
                      ? "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                      : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppUsers;
