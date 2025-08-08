import React from "react";
import { IMAGE_PLACEHOLDERS } from "@/constants/placeholder.constant";
import { useDateUtils } from "@/utils/date.utils";
import { useTextUtils } from "@/utils/text.utils";
import { useModal } from "@/context/modal.provider";
import ViewReceiptCard from "./viewReceipt.card";

const UserCard = ({ user, reports = [], onAction }) => {
  const { openModal, closeModal } = useModal();
  if (!user) return null;

  const { _id, fname, lname, dob, createdOn, gender } = user;

  const fullName = `${fname} ${lname}`.trim();
  const dobFormatted = dob ? new Date(dob).toLocaleDateString() : "N/A";
  const createdFormatted = createdOn
    ? new Date(createdOn).toLocaleDateString()
    : "N/A";

  // Show only last 5 reports
  const lastReports = reports
    .filter((report) => report.reportedBy === user._id)
    .slice(0, 5);

  const handleViewReceipt = (data) => {
    openModal(<ViewReceiptCard receipt={data} />);
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-xl w-full">
      {/* Top Section: Image + ID and user details */}
      <div className="flex space-x-6 mb-6">
        {/* Image top-left */}
        <img
          src={IMAGE_PLACEHOLDERS[gender] || IMAGE_PLACEHOLDERS["default"]}
          alt={`${fullName} avatar`}
          className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
        />

        {/* Info to right */}
        <div className="flex flex-col justify-between text-gray-800">
          <div className="font-mono text-md mb-1 truncate">{_id}</div>
          <div className="text-xl font-semibold mb-1">
            {fullName || "Unknown User"}
          </div>
          <div className="text-sm mb-1">
            Birthday: {useDateUtils.getFormattedDateString(dob)}
          </div>
          <div className="text-sm mb-1">
            Account created: {useDateUtils.getDaysAgo(createdFormatted)}
          </div>
        </div>
      </div>

      {/* Reports table */}
      <div>
        <h3 className="text-md font-semibold mb-2">Last 5 Reports</h3>
        {lastReports.length > 0 ? (
          <table className="w-full text-left text-sm border-collapse border border-gray-200">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1">Date</th>
                <th className="border border-gray-300 px-2 py-1">Type</th>
                <th className="border border-gray-300 px-2 py-1">Merchant</th>
              </tr>
            </thead>
            <tbody>
              {lastReports.map((report) => (
                <tr
                  key={report.id}
                  className="odd:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewReceipt(report)} // pass entire report here
                >
                  <td className="border border-gray-300 px-2 py-1">
                    {useDateUtils.getDaysAgo(report.date)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {useTextUtils.capitalize(report.type)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {report.merchant}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">No reports available.</p>
        )}
      </div>

      {/* Save reports button */}
      <div className="mt-4 text-right">
        <button
          onClick={() => onAction(user)}
          className="bg-secondary hover:primary text-white text-xs font-semibold py-2 px-4 rounded"
        >
          Edit User
        </button>
      </div>
    </div>
  );
};

export default UserCard;
