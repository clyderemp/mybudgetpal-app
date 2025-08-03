import { AlertCircle, CheckCircle, Clock, X, XCircle } from 'lucide-react';

const VerificationModal = ({ 
  isOpen, 
  onClose, 
  status, 
  message, 
  title = "Verification Status",
  details = null,
  showCloseButton = true,
  size = "md" 
}) => {
  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'successful':
      case 'verified':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'failed':
      case 'rejected':
        return <XCircle className="w-8 h-8 text-red-600" />;
      case 'pending':
        return <Clock className="w-8 h-8 text-yellow-600" />;
      case 'warning':
        return <AlertCircle className="w-8 h-8 text-orange-600" />;
      default:
        return <AlertCircle className="w-8 h-8 text-blue-600" />;
    }
  };

  const getStatusColors = () => {
    switch (status) {
      case 'successful':
      case 'verified':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800'
        };
      case 'failed':
      case 'rejected':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800'
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800'
        };
      case 'warning':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-sm';
      case 'lg':
        return 'max-w-2xl';
      case 'xl':
        return 'max-w-4xl';
      default:
        return 'max-w-md';
    }
  };

  const colors = getStatusColors();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl ${getSizeClasses()} w-full max-h-[90vh] overflow-auto`}>
        <div className={`${colors.bg} ${colors.border} border rounded-t-2xl p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {getStatusIcon()}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className={`${colors.text} font-medium mt-1`}>{message}</p>
              </div>
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {details && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Verification Details</h4>
              <div className="space-y-2 text-sm text-gray-600">
                {details}
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;
