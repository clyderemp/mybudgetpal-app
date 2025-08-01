
const UserProfileCard = ({ 
  name, 
  gender, 
  dateOfBirth, 
  location, 
  profileImage,
  onSelectAnotherUser 
}) => {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="text-center mb-6">
        <div className="w-48 h-48 mx-auto mb-4 rounded-2xl overflow-hidden">
          <img 
            src={profileImage || "/api/placeholder/192/192"} 
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
        
        <button 
          onClick={onSelectAnotherUser}
          className="bg-gray-800 text-white px-6 py-2 rounded-full font-medium hover:bg-gray-700 transition-colors"
        >
          Select Another User
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
          <p className="text-lg font-semibold text-gray-900">{name}</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Gender</label>
          <p className="text-lg font-semibold text-gray-900">{gender}</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Date of Birth</label>
          <p className="text-lg font-semibold text-gray-900">{dateOfBirth}</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Location</label>
          <p className="text-lg font-semibold text-gray-900">{location}</p>
        </div>
      </div>
    </div>
  );
};

export default UserProfileCard; 