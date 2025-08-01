import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/auth.provider";
import DataTable from "@/views/components/tables/data.table";
import { useDateUtils } from "@/utils/date.utils";
import { useTextUtils } from "@/utils/text.utils";

const UsersPage = () => {
  const { user, users } = useAuth();
  const dataset = users;
  const [tableData, setTableData] = useState([]);

  // Async clean and transform waitlist data
  const cleanData = async () => {
    if (!dataset || dataset.length === 0) return [];

    // Map returns array of promises, await all of them
    const data = await Promise.all(
      dataset.map(async (item, index) => {
        const { location = {}, ...rest } = item;

        // Await getDaysAgo if async, else remove await
        const fullName = `${item?.userData?.basicProfile?.fname} ${item?.userData?.basicProfile?.lname}`;
        const gender = useTextUtils.capitalize(
          item?.userData?.basicProfile?.gender
        );
        const daysAgo = await useDateUtils.getDaysAgo(item?.createdOn);
        const age = await useDateUtils.getAge(
          item?.userData?.basicProfile?.dob
        );

        return {
          id: { value: item?.uid, type: "number" },
          name: {
            value: fullName.trim(),
            type: "text",
          },
          gender: { value: gender, type: "text" },
          age: { value: age || 18, type: "number" },
          registered: { value: daysAgo, type: "date" },
          country: {
            value: item?.location?.country || "Unknown",
            type: "text",
          },
        };
      })
    );

    return data;
  };

  useEffect(() => {
    if (dataset && dataset.length > 0) {
      (async () => {
        const data = await cleanData();
        setTableData(data);
      })();
    }
  }, [tableData]);

  return (
    <div className="flex h-screen bg-dashboard-background">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {tableData.length > 0 && <DataTable data={tableData} />}
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
