import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/auth.provider";
import DataTable from "@/views/components/tables/data.table";
import { useDateUtils } from "@/utils/date.utils";
import { waitlistSchema } from "@/schema/waitlist.schema";

const WaitlistPage = () => {
  const { waitlist } = useAuth();
  const dataset = waitlist;
  const [tableData, setTableData] = useState([]);

  // Async clean and transform waitlist data
  const cleanData = async () => {
    if (!dataset || dataset.length === 0) return [];

    // Map returns array of promises, await all of them
    const data = await Promise.all(
      dataset.map(async (item, index) => {
        const { location = {}, ...rest } = item;

        // Await getDaysAgo if async, else remove await
        const daysAgo = await useDateUtils.getDaysAgo(item?.date);
        const age = await useDateUtils.getAge(item?.dob);

        return {
          id: { value: item?._id, type: "number" },
          name: {
            value: `${item?.fname || ""} ${item?.lname || ""}`.trim(),
            type: "text",
          },
          gender: { value: item?.gender, type: "text" },
          email: { value: item?.email, type: "text" },
          phoneNumber: { value: item?.phoneNumber, type: "text" },
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
  }, [dataset]);

  return (
    <div className="flex h-screen bg-dashboard-background">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {dataset?.length > 0 && (
            <DataTable
              schema={waitlistSchema}
              data={tableData}
              rawData={waitlist}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitlistPage;
