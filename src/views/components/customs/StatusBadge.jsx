
const StatusBadge = ({ 
  status, 
  variant = 'default',
  size = 'sm',
  className = "" 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'px-2 py-1 text-xs';
      case 'sm':
        return 'px-3 py-1 text-sm';
      case 'md':
        return 'px-4 py-2 text-sm';
      default:
        return 'px-3 py-1 text-sm';
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'danger':
        return 'bg-red-100 text-red-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span 
      className={`inline-flex items-center font-medium rounded-full ${getSizeClasses()} ${getVariantClasses()} ${className}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge; 