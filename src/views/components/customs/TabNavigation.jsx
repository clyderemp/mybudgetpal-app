
const TabNavigation = ({ tabs = [], activeTab, onTabChange, className = "" }) => {
  return (
    <div className={`flex space-x-1 ${className}`}>
      {tabs.map((tab, index) => (
        <button
          key={index}
          onClick={() => onTabChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === tab.key
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
              activeTab === tab.key
                ? 'bg-blue-200 text-blue-800'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation; 