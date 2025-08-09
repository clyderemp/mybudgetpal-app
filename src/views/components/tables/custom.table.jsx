import { useEffect, useState } from "react";
import { useTextUtils } from "@/utils/text.utils";
import { useDateUtils } from "@/utils/date.utils";
import { useAuth } from "@/context/auth.provider";
import { useCacheUtils } from "@/utils/cache.utils";
import { usePaymentCardUtils } from "@/utils/paymentCard.utils";
import CustomInput from "../customs/customInput";

const CustomTable = ({
  title,
  tableData = {},
  defaultTable = "all",
  onModify,
}) => {
  const { accountUsers } = useAuth();
  const [dataset, setDataset] = useState(defaultTable);
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredUser, setFilteredUser] = useState("all");
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [search, setSearch] = useState("");
  const [showDaysAgo, setShowDaysAgo] = useState(true);
  const [showCategory, setShowCategory] = useState(true);

  const textUtils = useTextUtils;
  const dateUtils = useDateUtils;
  const cardUtils = usePaymentCardUtils;

  // Get the data array for the selected transaction type (dataset)
  const data = tableData?.[dataset] || [];

  useEffect(() => {
    fetchCache();
  }, []);

  const fetchCache = async () => {
    const storedValuePerPage = await useCacheUtils.get("valuePerPage");
    const storedPageNum = await useCacheUtils.get("pageNum");
    const storedUserFilter = await useCacheUtils.get("userFilter");
    const storedSearchInput = await useCacheUtils.get("searchInput");
    setItemsPerPage(storedValuePerPage || 5);
    setCurrentPage(storedPageNum || 1);
    setFilteredUser(storedUserFilter || "all");
    setSearch(storedSearchInput || "");
  };

  // Handle user filter change
  const handleUserFilterChange = async (e) => {
    const value = e.target.value;
    await useCacheUtils.save("userFilter", value);
    setFilteredUser(value);
    setCurrentPage(1); // Reset page
  };

  // Handle dataset (transaction type) change
  const handleChange = (e) => {
    setDataset(e.target.value);
    setCurrentPage(1);
  };

  // Handle items per page change
  const handleItemsPerPageChange = async (e) => {
    const value = Number(e.target.value);
    await useCacheUtils.save("valuePerPage", value);
    setItemsPerPage(value);
  };

  // Handle search input change
  const handleSearchChange = async (e) => {
    const value = e.target.value;
    await useCacheUtils.save("searchInput", value);
    setSearch(value);
    setCurrentPage(1);
  };

  // Filter data based on:
  // 1. User filter (if not "all", filter by reportedBy)
  // 2. Search filter (merchant or category match)
  const filteredData = data.filter((item) => {
    const matchesUser =
      filteredUser === "all" || item.reportedBy === filteredUser;

    const searchLower = search.toLowerCase();
    const matchesSearch =
      item?.merchant?.toLowerCase().includes(searchLower) ||
      item?.category?.toLowerCase().includes(searchLower);

    return matchesUser && matchesSearch;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentData = filteredData.slice(startIdx, startIdx + itemsPerPage);

  const handlePageChange = async (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      await useCacheUtils.save("pageNum", newPage);
      setCurrentPage(newPage);
    }
  };

  // Helper to get user's full name
  const getUser = (uid) => {
    return `${accountUsers[uid]?.fname} ${accountUsers[uid]?.lname}`;
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        <div className="flex gap-3 items-center overflow-x-auto whitespace-nowrap">
          <CustomInput
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search..."
          />

          <CustomInput
            type="dropdown"
            value={filteredUser}
            onChange={handleUserFilterChange}
            placeholder="User"
            options={[
              { label: "All Users", value: "all" },
              ...Object.keys(accountUsers).map((key) => ({
                label: accountUsers[key].fname,
                value: key,
              })),
            ]}
          />

          <CustomInput
            type="dropdown"
            value={dataset}
            onChange={handleChange}
            placeholder="Transaction type"
            options={[
              ...Object.keys(tableData).map((key) => ({
                label: `${useTextUtils.capitalize(key)} Receipts`,
                value: key,
              })),
            ]}
          />

          <CustomInput
            type="dropdown"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            placeholder="Items per page"
            options={[
              { label: "5 per page", value: 5 },
              { label: "10 per page", value: 10 },
              { label: "25 per page", value: 25 },
              { label: "50 per page", value: 50 },
              { label: "100 per page", value: 100 },
            ]}
          />

          {onModify && (
            <button
              onClick={() => onModify("add", null)}
              className="bg-gray-800 text-white px-3 py-1 rounded-md text-sm"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No receipt data available
        </div>
      ) : (
        <>
          <div className="space-y-4 overflow-x-auto">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 pb-2 border-b border-gray-100 min-w-[700px]">
              <div className="col-span-1">User</div>
              <div
                className="col-span-2 cursor-pointer"
                onClick={() => setShowDaysAgo((prev) => !prev)}
              >
                {showDaysAgo ? "Days Ago" : "Item Date"}
              </div>
              <div className="col-span-3">Merchant</div>
              <div
                className="col-span-2 cursor-pointer"
                onClick={() => setShowCategory((prev) => !prev)}
              >
                {showCategory ? "Category" : "Receipt Info"}
              </div>
              <div className="col-span-2">Paid via</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            {currentData.map((item, index) => {
              const itemDate = showDaysAgo
                ? dateUtils.getDaysAgo(item?.date)
                : dateUtils.getFormattedDateString(item?.date);
              const itemData = showCategory
                ? item?.category
                : item?.items?.length > 0
                ? `${item?.items?.length} items`
                : item?.note;
              const initials = textUtils?.getInitials(
                getUser(item?.reportedBy)
              );
              const paymentCard = cardUtils?.getCardDetails(
                item?.paymentMethod
              );

              return (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-4 items-center p-2 text-sm text-gray-900 min-w-[700px] hover:bg-secondary cursor-pointer"
                  onClick={() => onModify?.("edit", item)}
                >
                  <div className="col-span-1">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                      {initials}
                    </div>
                  </div>
                  <div className="col-span-2">{itemDate}</div>
                  <div className="col-span-3">{item?.merchant}</div>
                  <div className="col-span-2">
                    {showCategory
                      ? item?.category === "Custom"
                        ? item?.customCategory
                        : item?.category
                      : itemData}
                  </div>
                  <div className="col-span-2">
                    {paymentCard?.bankLogo ? (
                      <img
                        src={paymentCard.bankLogo}
                        alt={item?.paymentMethod || "Bank Logo"}
                        className="h-6 object-contain"
                      />
                    ) : (
                      textUtils.capitalize(item?.paymentMethod)
                    )}
                  </div>
                  <div className="col-span-2 text-right font-semibold">
                    {`${item.symbol} ${Number(item.value).toFixed(2)}`}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
            <div>
              Showing {startIdx + 1}–
              {Math.min(startIdx + itemsPerPage, filteredData.length)} of{" "}
              {filteredData.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomTable;
