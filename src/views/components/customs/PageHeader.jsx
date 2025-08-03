import { ArrowLeft, ArrowRight } from "lucide-react";

const PageHeader = ({ 
  title, 
  subtitle, 
  showBackButton = false, 
  showEditButton = false,
  editButtonText = "Edit User Profile",
  onBackClick,
  onEditClick
}) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center space-x-4">
        {showBackButton && (
          <button 
            onClick={onBackClick}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      
      {showEditButton && (
        <button 
          onClick={onEditClick}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span className="font-medium">{editButtonText}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default PageHeader; 