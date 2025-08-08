import React, { useEffect, useState } from "react";
import CustomHeaderBanner from "@/views/components/customs/customHeaderBanner";
import { useAuth } from "@/context/auth.provider";
import { useModal } from "@/context/modal.provider";
import UserCard from "@/views/components/cards/user.card";
import UserForm from "@/views/components/forms/user.form";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useToast } from "@/context/toast.provider";
import { reload } from "firebase/auth";

const UsersPage = () => {
  const { user, accountUsers, transactions, reloadData } = useAuth();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const date = new Date().toDateString();

  const handleEditUser = (user) => {
    // Example: open modal or save report logic here
    openModal(
      <UserForm data={user} onSubmit={(data) => handleSaveUser(data)} />
    );
  };

  const handleSaveUser = async (data) => {
    try {
      const id = data?._id;
      //Check if its a co-user
      if (id?.includes("USER")) {
        const mainUserID = user?._id;
        await useFirestoreServices.updateDocument(
          `users/${mainUserID}/coUsers`,
          id,
          data
        );
      } else {
        await useFirestoreServices.updateDocument(`users`, id, data);
      }
      showToast(`Your changes have been saved`, "success");
      reloadData();
    } catch (err) {
      showToast(err?.message, "error");
    } finally {
      closeModal();
    }
  };

  return (
    <div className="flex h-screen bg-dashboard-background">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <CustomHeaderBanner
            date={date}
            title="User Accounts Manager"
            message="Manage your accounts users here."
            buttonText="Chat with AL"
            onButtonClick={() => {}}
            showImage
          />

          <section className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Account Users</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accountUsers && Object.values(accountUsers).length > 0 ? (
                Object.values(accountUsers).map((user, index) => (
                  <UserCard
                    key={user._id}
                    user={user}
                    reports={transactions}
                    onAction={handleEditUser}
                    align={index % 2 === 0 ? "left" : "right"}
                  />
                ))
              ) : (
                <p>No co-users available.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
