import { ChevronLeft, ChevronRight } from "lucide-react";
import CustomButton from "./customButton";
import { useModal } from "@/context/modal.provider";
import BlogForm from "../forms/blogs.form";
import { useToast } from "@/context/toast.provider";
import { useAuth } from "@/context/auth.provider";
import { useDateUtils } from "@/utils/date.utils";
import { useActionUtils } from "@/utils/action.utils";

const CustomBlogCards = ({ title, data = [], showAddButton = false }) => {
  const { user, reloadData } = useAuth();
  const { openModal } = useModal();
  const { showToast } = useToast();

  const handleOpenBlogForm = (blog = {}) => {
    openModal(
      <BlogForm
        data={blog}
        onSuccess={async () => {
          if (blog?._id) {
            await useActionUtils.logAction(user?.uid, "edit_blog");
            handleSuccess();
          } else {
            await useActionUtils.logAction(user?.uid, "new_blog");
          }
        }}
      />
    );
  };

  const handleSuccess = () => {
    showToast("Changes Saved.", "success");
    reloadData?.("blogs");
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {title || "Missing Title Here..."}
        </h2>
        <div className="flex items-center space-x-2">
          {showAddButton && (
            <CustomButton
              label="New Blog"
              className={`rounded-full`}
              color="primary"
              onClick={() => handleOpenBlogForm()}
            />
          )}
          <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map((item, index) => (
          <div
            key={item._id || index}
            className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow ${
              data.length < 3 ? "md:col-span-2" : ""
            }`}
          >
            {/* Thumbnail with Visits Badge */}
            <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
              <button
                onClick={() => handleOpenBlogForm(item)}
                className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded-full shadow opacity-80 hover:opacity-100 hover:bg-secondary"
              >
                Edit
              </button>
              <button className="absolute top-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded-full shadow opacity-80 hover:opacity-100">
                {`${item.visits?.length || 0} Visits`}
              </button>

              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-400 text-sm">Missing Thumbnail</span>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2">
                {item.title}
              </h3>

              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                  {item.author?.image ? (
                    <img
                      src={item.author.image}
                      alt={item.author.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-gray-600">
                      {item.author?.name?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.author?.name || "Unknown Author"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {useDateUtils.getDaysAgo(item.date) || ""}
                  </p>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-purple-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}

        {/* Add New Blog Card */}
        {data.length < 4 && (
          <div
            onClick={() => handleOpenBlogForm()}
            className={`bg-white rounded-xl shadow-sm border border-dashed border-gray-300 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center cursor-pointer ${
              data.length < 3 ? "md:col-span-2" : ""
            }`}
          >
            <div className="p-6">
              <p className="text-gray-500 font-medium">+ Create a New Blog</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomBlogCards;
