import { Heart } from 'lucide-react';

const MatchProfileCard = ({ 
  name, 
  title, 
  company, 
  profileImage, 
  isLiked = false 
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="relative">
        {/* Profile Image */}
        <div className="w-full h-40 rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          {profileImage ? (
            <img 
              src={profileImage} 
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-white text-4xl font-bold">
              <Heart className="w-12 h-12" />
            </div>
          )}
        </div>
        
        {/* Like indicator */}
        {isLiked && (
          <div className="absolute top-2 right-2 bg-red-500 rounded-full p-2">
            <Heart className="w-4 h-4 text-white fill-current" />
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900 text-lg">{name}</h3>
        {title && (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{title}</p>
              {company && (
                <p className="text-xs text-gray-600">{company}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchProfileCard; 