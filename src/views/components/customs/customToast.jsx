import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

const Toast = ({ 
  isVisible, 
  onClose, 
  type = 'success', 
  message, 
  duration = 3000,
  position = 'bottom-center',
  showCloseButton = false
}) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6" />;
      case 'error':
        return <XCircle className="w-6 h-6" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6" />;
      case 'info':
        return <Info className="w-6 h-6" />;
      default:
        return <CheckCircle className="w-6 h-6" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600 text-white';
      case 'error':
        return 'bg-red-600 text-white';
      case 'warning':
        return 'bg-yellow-600 text-white';
      case 'info':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-green-600 text-white';
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'top-center':
        return 'top-8 left-1/2 transform -translate-x-1/2 animate-slide-down';
      case 'top-right':
        return 'top-8 right-8 animate-slide-down';
      case 'bottom-right':
        return 'bottom-8 right-8 animate-slide-up';
      case 'bottom-left':
        return 'bottom-8 left-50 animate-slide-up';
      case 'bottom-center':
      default:
        return 'bottom-8 left-1/2 transform -translate-x-1/2 animate-slide-up';
    }
  };

  return (
    <div className={`fixed z-50 ${getPositionStyles()}`}>
      <div className={`${getStyles()} px-6 py-4 rounded-lg shadow-lg flex items-center space-x-3 min-w-max max-w-md`}>
        {getIcon()}
        <span className="font-medium">{message}</span>
        {showCloseButton && (
          <button 
            onClick={onClose}
            className="ml-2 hover:opacity-80 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
