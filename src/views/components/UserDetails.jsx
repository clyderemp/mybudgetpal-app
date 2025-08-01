import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "./static/Sidebar";
import { ActionButtons, PageHeader, StatusBadge, Toast } from "./customs";

const UserDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState("selfie");
  const [activeToast, setActiveToast] = useState(null); // Single toast state
  const [toastTimeoutId, setToastTimeoutId] = useState(null); // Track timeout ID

  // Mock user data - in real app, this would be fetched based on userId
  const userData = {
    id: userId,
    name: "Jane Henderson",
    gender: "Female",
    dateOfBirth: "August 27th, 1999",
    nationality: "Canadian",
    joinedDate: "July 2, 2025",
    avatar: "/api/placeholder/300/300",
    address: {
      addressLine: "No 35 Jimmy Ebi Street",
      city: "Toronto",
      state: "Ontario",
      country: "Canada",
    },
    contact: {
      phone: "(437) 981 - 0818",
      email: "tomilola@me.com",
    },
    accountTier: {
      current: "Free",
      options: ["Free", "Basic", "Plus"],
    },
    mediaFiles: [
      {
        type: "selfie",
        label: "Selfie",
        file: "1 File",
        image: "/api/placeholder/400/300",
      },
      {
        type: "id",
        label: "ID Document",
        file: "1 File",
        image: "/api/placeholder/400/300",
      },
    ],
    verification: {
      status: "successful",
      message: "Account Verification successful",
    },
  };

  // Helper function to show toast and manage timeouts
  const showToast = (type, message) => {
    // Clear any existing timeout
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }

    // Set the new toast
    setActiveToast({ type, message });

    // Set new timeout
    const newTimeoutId = setTimeout(() => {
      setActiveToast(null);
      setToastTimeoutId(null);
    }, 3000);

    setToastTimeoutId(newTimeoutId);
  };

  const handleBackClick = () => {
    navigate("/data-management/app-users");
  };

  const handleEditClick = () => {
    console.log("Edit user profile");
    // Navigate to edit page or open modal
  };

  const handleDeleteUser = () => {
    console.log("Delete user");
    // Show delete toast (will clear any existing toast)
    showToast("error", "User Deleted Successfully!");
  };

  const handleVerifyUser = () => {
    console.log("Verify user");
    // Show verification toast (will clear any existing toast)
    showToast("success", "Account Verification Successful!");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <PageHeader
            title="User Details"
            showBackButton={true}
            showEditButton={true}
            editButtonText="Edit User Profile"
            onBackClick={handleBackClick}
            onEditClick={handleEditClick}
          />

          <div className="grid grid-cols-12 gap-8">
            {/* Left Column - User Profile */}
            <div className="col-span-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                <div className="text-center mb-6">
                  <div className="w-48 h-48 mx-auto mb-4 rounded-2xl overflow-hidden relative">
                    <img
                      src={userData.avatar}
                      alt={userData.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full text-sm">
                      Joined on {userData.joinedDate}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Name
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {userData.name}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Gender
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {userData.gender}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Date of Birth
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {userData.dateOfBirth}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Nationality
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {userData.nationality}
                    </p>
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Address
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address Line
                    </label>
                    <p className="text-gray-900">
                      {userData.address.addressLine}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      City
                    </label>
                    <p className="text-gray-900">{userData.address.city}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Province / State
                    </label>
                    <p className="text-gray-900">{userData.address.state}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Country
                    </label>
                    <p className="text-gray-900">{userData.address.country}</p>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Contact Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Phone Number
                    </label>
                    <p className="text-gray-900">{userData.contact.phone}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Email
                    </label>
                    <p className="text-gray-900">{userData.contact.email}</p>
                  </div>
                </div>

                {/* Account Tier */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-500 mb-3">
                    Account Tier
                  </label>
                  <div className="space-y-2">
                    {userData.accountTier.options.map((tier, index) => (
                      <div key={tier} className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            userData.accountTier.current === tier
                              ? "bg-black border-black"
                              : "border-gray-300"
                          }`}
                        >
                          {userData.accountTier.current === tier && (
                            <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                          )}
                        </div>
                        <span
                          className={`text-sm ${
                            userData.accountTier.current === tier
                              ? "font-medium text-gray-900"
                              : "text-gray-600"
                          }`}
                        >
                          {tier}
                        </span>
                        {userData.accountTier.current === tier && (
                          <StatusBadge
                            status="Current"
                            variant="info"
                            size="xs"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Media Files */}
            <div className="col-span-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Media Files
                </h2>

                <div className="grid grid-cols-2 gap-6">
                  {userData.mediaFiles.map((media, index) => (
                    <div key={media.type} className="space-y-4">
                      <div
                        className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all ${
                          selectedFile === media.type
                            ? "ring-2 ring-blue-500"
                            : "hover:shadow-lg"
                        }`}
                        onClick={() => setSelectedFile(media.type)}
                      >
                        <img
                          src={media.image}
                          alt={media.label}
                          className="w-full h-64 object-cover"
                        />
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-between">
                            <span className="font-medium text-gray-900">
                              {media.label}
                            </span>
                            <span className="text-sm text-gray-600">
                              {media.file}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Single Toast Component */}
          {activeToast && (
            <Toast
              isVisible={true}
              onClose={() => {
                if (toastTimeoutId) {
                  clearTimeout(toastTimeoutId);
                  setToastTimeoutId(null);
                }
                setActiveToast(null);
              }}
              type={activeToast.type}
              message={activeToast.message}
              duration={0} // We're managing duration manually
              position="bottom-left"
            />
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex justify-end">
            <ActionButtons
              primaryAction={handleVerifyUser}
              primaryLabel="Verify User"
              primaryVariant="success"
              secondaryAction={handleDeleteUser}
              secondaryLabel="Delete User"
              secondaryVariant="danger"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetails;
