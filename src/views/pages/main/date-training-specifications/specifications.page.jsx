import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/static/Sidebar";
import {
  CompatibilityChart,
  MatchProfileCard,
  MetricCard,
  PageHeader,
  UserProfileCard,
} from "../../../components/customs";

const DataTrainingSpecifications = () => {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate("/dashboard");
  };

  const handleEditClick = () => {
    console.log("Edit profile clicked");
    // You can navigate to an edit page or open a modal
    // navigate('/edit-user-profile');
  };

  const handleSelectAnotherUser = () => {
    console.log("Select another user clicked");
    // You can navigate to a user selection page
    // navigate('/select-user');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Page Header */}
          <PageHeader
            title="Select User"
            showBackButton={true}
            showEditButton={true}
            editButtonText="Edit User Profile"
            onBackClick={handleBackClick}
            onEditClick={handleEditClick}
          />

          <div className="grid grid-cols-12 gap-8">
            {/* Left Column - User Profile */}
            <div className="col-span-4">
              <UserProfileCard
                name="Jane Henderson"
                gender="Female"
                dateOfBirth="August 27th, 1999"
                location="Toronto, ON, Canada"
                profileImage="/api/placeholder/192/192"
                onSelectAnotherUser={handleSelectAnotherUser}
              />

              {/* Match Profile Card */}
              <div className="mt-6">
                <MatchProfileCard
                  name="John Doe"
                  title="Rokaia Dawoud"
                  company="COO & Co-Founder"
                  isLiked={true}
                />
              </div>
            </div>

            {/* Middle Column - Compatibility Chart */}
            <div className="col-span-4">
              <CompatibilityChart
                title="Compatibility Analysis"
                subtitle="as of June 16, 2025"
                userCount1="600"
                userCount2="300"
              />
            </div>

            {/* Right Column - Media Files Grid */}
            <div className="col-span-4">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Media Files
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {/* Level 1 Results */}
                  <MetricCard
                    title="Level 1 Results"
                    subtitle="App & Content Filter"
                    value="200 matches"
                    description="Found 200 matches out of 1.3 users"
                    percentage={80}
                    gradientFrom="purple-100"
                    gradientTo="purple-200"
                    accentColor="purple-600"
                    strokeColor="#8b5cf6"
                  />

                  {/* Level 2 Results */}
                  <MetricCard
                    title="Level 2 Results"
                    subtitle="Basic Data Filter"
                    value="180 matches"
                    description="Found 180 out of 200.1.1 matches"
                    percentage={80}
                    gradientFrom="purple-100"
                    gradientTo="purple-200"
                    accentColor="purple-600"
                    strokeColor="#8b5cf6"
                  />

                  {/* Level 3 Results */}
                  <MetricCard
                    title="Level 3 Results"
                    subtitle="Dating Preferences"
                    value="123 matches"
                    description="Found 123 out of 180.1.2 matches"
                    percentage={80}
                    gradientFrom="purple-100"
                    gradientTo="purple-200"
                    accentColor="purple-600"
                    strokeColor="#8b5cf6"
                  />

                  {/* L4 Results */}
                  <MetricCard
                    title="L4 Results"
                    subtitle="Lifestyle"
                    value="57 matches"
                    description="Found 57 out of 123 matches"
                    percentage={80}
                    gradientFrom="purple-100"
                    gradientTo="purple-200"
                    accentColor="purple-600"
                    strokeColor="#8b5cf6"
                  />

                  {/* Level 5 Results */}
                  <MetricCard
                    title="Level 5 Results"
                    subtitle="Data Planned Filter"
                    value="23 matches"
                    description="Found 23 out of 57 matches"
                    percentage={80}
                    gradientFrom="purple-100"
                    gradientTo="purple-200"
                    accentColor="purple-600"
                    strokeColor="#8b5cf6"
                  />

                  {/* Final Results */}
                  <MetricCard
                    title="Final Results"
                    subtitle="Final Verdict"
                    value="9 matches"
                    description="Found 9 out of 23 matches"
                    percentage={80}
                    gradientFrom="purple-100"
                    gradientTo="purple-200"
                    accentColor="purple-600"
                    strokeColor="#8b5cf6"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataTrainingSpecifications;
