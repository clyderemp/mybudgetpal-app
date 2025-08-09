import { useEffect, useState } from "react";
import { useTextUtils } from "@/utils/text.utils";
import { useDateUtils } from "@/utils/date.utils";
import { useAuth } from "@/context/auth.provider";
import { useCacheUtils } from "@/utils/cache.utils";

const CustomTable = ({
  title,
  tableData = {},
  defaultTable = "all",
  onModify,
}) => {
  const { accountUsers } = useAuth();
  const [dataset, setDataset] = useState(defaultTable);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [search, setSearch] = useState("");

  const textUtils = useTextUtils;
  const dateUtils = useDateUtils;

  const data = tableData?.[dataset] || [];

  useEffect(() => {
    fetchCache();
  }, []);

  const fetchCache = async () => {
    const storedValuePerPage = await useCacheUtils.get("valuePerPage");
    setItemsPerPage(storedValuePerPage || 5);
  };

  const handleChange = (e) => {
    setDataset(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = async (e) => {
    const value = Number(e.target.value);
    await useCacheUtils.save("valuePerPage", value);
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const filteredData = data.filter(
    (item) =>
      item?.merchant?.toLowerCase().includes(search.toLowerCase()) ||
      item?.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentData = filteredData.slice(startIdx, startIdx + itemsPerPage);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getUser = (uid) => {
    return `${accountUsers[uid]?.fname} ${accountUsers[uid]?.lname}`;
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>

        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={handleSearchChange}
            className="border text-sm rounded-md px-2 py-1 flex-grow min-w-[150px]"
          />

          <select
            value={dataset}
            onChange={handleChange}
            className="border text-sm rounded-md px-2 py-1 min-w-[120px]"
          >
            {Object.keys(tableData)?.map((key) => (
              <option key={key} value={key}>
                {textUtils.capitalize(key)}
              </option>
            ))}
          </select>

          <select
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            className="border text-sm rounded-md px-2 py-1 min-w-[120px]"
          >
            {[5, 10, 20, 50].map((num) => (
              <option key={num} value={num}>
                {num} / page
              </option>
            ))}
          </select>

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
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Merchant</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            {currentData.map((item, index) => {
              const initials = textUtils.getInitials(getUser(item?.reportedBy));

              return (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-4 items-center p-2 text-sm text-gray-900 min-w-[700px] hover:bg-secondary cursor-pointer"
                  onClick={() => {
                    onModify?.("edit", item);
                  }}
                >
                  <div className="col-span-1">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                      {initials}
                    </div>
                  </div>
                  <div className="col-span-3">
                    {dateUtils.getDaysAgo(item.date)}
                  </div>
                  <div className="col-span-3">{item.merchant}</div>
                  <div className="col-span-3">{item.category}</div>
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
