import React, { useState, useEffect } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { useAnalyticsUtils } from "@/utils/analytics.utils";
import { useAuth } from "@/context/auth.provider";
import { useTextUtils } from "@/utils/text.utils";
import { useModal } from "@/context/modal.provider";
import DataCorrectionForm from "../forms/dataCorrect.form";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useToast } from "@/context/toast.provider";

const DataCorrectorCard = () => {
  const {
    user,
    activeUser,
    accountUsers,
    transactions,
    exchangeRate,
    reloadData,
  } = useAuth();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(0);
  const [activeUserTabID, setActiveUserTabID] = useState(activeUser?._id);
  const [analytics, setAnalytics] = useState(null);
  const userKeys = Object.keys(accountUsers);

  const fetchAnalytics = async () => {
    const userId = userKeys[activeTab];
    const data = await useAnalyticsUtils.getUserAnalytics(
      transactions,
      accountUsers,
      userId
    );
    setAnalytics(data);
  };

  useEffect(() => {
    if (userKeys.length > 0) fetchAnalytics();
  }, [activeTab, transactions, accountUsers]);

  const handleOpenCorrectorForm = () => {
    const selectedUser = analytics[activeUserTabID].raw;
    const data = {
      ...selectedUser,
      expenses: selectedUser?.expenses?.total,
      user: activeUserTabID,
    };
    openModal(
      <DataCorrectionForm initialData={data} onSave={handleSaveCorrection} />
    );
  };

  const handleSaveCorrection = async (data) => {
    try {
      await useFirestoreServices.updateDocument("users", user?._id, {
        correctionParams: {
          ...user?.correctionParams,
          [activeUserTabID]: data,
        },
      });
      closeModal();
      reloadData("user");
      showToast("Correction Parameters Saved!", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      {/* Tabs */}
      <div className="flex border-b mb-4">
        {userKeys.map((userId, index) => {
          const user = accountUsers[userId];
          const label = `${user.fname} ${user.lname}`;
          return (
            <button
              key={userId}
              onClick={() => {
                setActiveUserTabID(userId);
                setActiveTab(index);
              }}
              className={`flex-1 py-2 text-center ${
                index === activeTab
                  ? "border-b-2 border-blue-600 font-semibold"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Analytics Display */}
      <div className="space-y-2">
        {analytics ? (
          <>
            <div className="flex justify-between items-center">
              <span>Total Expenses:</span>
              <div className="flex items-center gap-1 text-right">
                <span>
                  {useTextUtils.getMoneyText(
                    analytics[activeUserTabID].expenses?.total,
                    exchangeRate?.code
                  )}
                </span>
                <Pencil
                  size={16}
                  onClick={handleOpenCorrectorForm}
                  className="text-gray-500 cursor-pointer ml-2"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Total Credit:</span>
              <div className="flex items-center gap-1 text-right">
                <span>
                  {useTextUtils.getMoneyText(
                    analytics[activeUserTabID].credit,
                    exchangeRate?.code
                  )}
                </span>
                <Pencil
                  size={16}
                  onClick={handleOpenCorrectorForm}
                  className="text-gray-500 cursor-pointer ml-2"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Total Income:</span>
              <div className="flex items-center gap-1 text-right">
                <span>
                  {useTextUtils.getMoneyText(
                    analytics[activeUserTabID].income,
                    exchangeRate?.code
                  )}
                </span>
                <Pencil
                  size={16}
                  onClick={handleOpenCorrectorForm}
                  className="text-gray-500 cursor-pointerml-2 ml-2"
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Total Savings:</span>
              <div className="flex items-center gap-1 text-right">
                <span>
                  {useTextUtils.getMoneyText(
                    analytics[activeUserTabID].savings,
                    exchangeRate?.code
                  )}
                </span>
                <Pencil
                  size={16}
                  onClick={handleOpenCorrectorForm}
                  className="text-gray-500 cursor-pointer ml-2"
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Loading stats...</p>
        )}
      </div>

      {/* Recalibrate Button */}
      <div className="mt-4 text-right">
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Recalibrate
        </button>
      </div>
    </div>
  );
};

export default DataCorrectorCard;
