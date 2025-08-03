import {
  ChevronLeft,
  ChevronRight,
  FileText,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import CustomButton from "../customs/customButton";
import { useModal } from "@/context/modal.provider";
import { useToast } from "@/context/toast.provider";
import { useAuth } from "@/context/auth.provider";
import { useDateUtils } from "@/utils/date.utils";
import { useActionUtils } from "@/utils/action.utils";
import TransactionForm from "../forms/transaction.form";
import { useRef } from "react";
import { useTextUtils } from "@/utils/text.utils";
import ALImage from "@/assets/images/budgetpAL-accountant.png";

const ReceiptCards = ({
  title = "Receipts",
  data = [],
  showAddButton = false,
}) => {
  const { user, exchangeRate, reloadData } = useAuth();
  const { openModal } = useModal();
  const { showToast } = useToast();
  const scrollRef = useRef(null);

  const handleOpenReceiptForm = (receipt = {}) => {
    openModal(
      <TransactionForm
        data={receipt}
        onSuccess={async () => {
          if (receipt?._id) {
            await useActionUtils.logAction(user?.uid, "edit_receipt");
            handleSuccess();
          } else {
            await useActionUtils.logAction(user?.uid, "new_receipt");
            handleSuccess();
          }
        }}
      />
    );
  };

  const handleSuccess = () => {
    showToast("Receipt saved successfully.", "success");
    reloadData?.("receipts");
  };

  const scrollByAmount = (amount) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  const scrollToStart = () => {
    scrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  const scrollToEnd = () => {
    scrollRef.current?.scrollTo({
      left: scrollRef.current.scrollWidth,
      behavior: "smooth",
    });
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center space-x-2">
          {showAddButton && (
            <CustomButton
              label="New Receipt"
              className="rounded-full"
              color="secondary"
              onClick={() => handleOpenReceiptForm()}
            />
          )}
          {/* Scroll Controls */}
          <button
            onClick={scrollToStart}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronsLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => scrollByAmount(-300)}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => scrollByAmount(300)}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={scrollToEnd}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronsRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Scrollable Cards */}
      {data?.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center text-center py-20 text-gray-400 bg-white rounded-2xl">
          <img src={ALImage} alt="No data" className="w-32 h-32 mb-4" />

          <p className="text-lg font-medium mb-2">No Data Found</p>
          <p className="text-sm">
            You can add a new one using the button above.
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2"
        >
          {data?.map((item, index) => (
            <div
              key={item._id || index}
              className="min-w-[250px] bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex-shrink-0"
            >
              {/* Receipt Image / Actions */}
              <div className="relative h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
                <button
                  onClick={() => handleOpenReceiptForm(item)}
                  className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded-full shadow opacity-80 hover:opacity-100"
                >
                  Edit
                </button>
                <button className="absolute top-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded-full shadow opacity-80 hover:opacity-100">
                  {useTextUtils.getMoneyText(item?.value, exchangeRate?.code)}
                </button>

                {item.image ? (
                  <img
                    src={item?.image}
                    alt="Receipt"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <FileText className="w-12 h-12 mb-1" />
                    <span className="text-sm">No Image</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 truncate">
                  {item.merchant || "Unknown Merchant"}
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  {useDateUtils.getDaysAgo(item?.date)}
                </p>
                <div className="text-xs text-gray-400">
                  Category:{" "}
                  <span className="text-gray-600">
                    {item.category || "Uncategorized"}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Add New Card */}
          {showAddButton && (
            <div
              onClick={() => handleOpenReceiptForm()}
              className="min-w-[250px] bg-white rounded-xl shadow-sm border border-dashed border-gray-300 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center cursor-pointer flex-shrink-0"
            >
              <div className="p-6">
                <p className="text-gray-500 font-medium">
                  + Upload a New Receipt
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceiptCards;
