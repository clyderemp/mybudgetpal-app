import { ClipLoader } from "react-spinners";
import savingImage from "@/assets/images/budgetpAL.png";
import loadingImage from "@/assets/images/budgetpAL.png";
import searchingImage from "@/assets/images/budgetpAL.png";

const typeToImage = {
  saving: savingImage,
  loading: loadingImage,
  searching: searchingImage,
};

const Loader = ({ text = "Loading", type = "default", progress = null }) => {
  const renderContent = () => {
    if (type === "default") {
      return <ClipLoader size={60} color="#3B82F6" />;
    }

    const image = typeToImage[type];
    return (
      <img
        src={image}
        alt={`${type} animation`}
        className="w-24 h-24 object-contain"
      />
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="flex flex-col items-center space-y-4">
        {renderContent()}
        <p className="text-gray-500 text-lg font-medium">{`${text}...`}</p>
        {progress !== null && (
          <div className="w-64 h-2 bg-gray-200 rounded overflow-hidden">
            <div
              className="bg-blue-500 h-2 transition-all"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Loader;
