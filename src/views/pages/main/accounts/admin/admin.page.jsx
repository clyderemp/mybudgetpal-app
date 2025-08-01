import React, { useEffect, useState } from "react";
import DataTable from "@/views/components/tables/data.table";
import { useAuth } from "@/context/auth.provider";
import { useDateUtils } from "@/utils/date.utils";
import { adminSchema } from "@/schema/admin.schema";
import { useFirebaseAuth } from "@/services/client/firebase-auth.service";
import { useBackendServices } from "@/services/server/backend.services";
import { useModal } from "@/context/modal.provider";
import { useToast } from "@/context/toast.provider";
import { useActionUtils } from "@/utils/action.utils";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";

const AdminPage = () => {
  const { admins, user, reloadData } = useAuth();
  const dataset = admins;
  const { closeModal } = useModal();
  const { showToast } = useToast();
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    if (dataset && dataset.length > 0) {
      (async () => {
        const data = await cleanData();
        setTableData(data);
      })();
    }
  }, [dataset]);

  const cleanData = async () => {
    if (!dataset || dataset.length === 0) return [];

    // Map returns array of promises, await all of them
    const data = await Promise.all(
      dataset.map(async (item, index) => {
        const { location = {}, ...rest } = item;
        const dobString = await useDateUtils.getFormattedDateString(item?.dob);

        return {
          id: { value: item?._id, type: "number" },
          email: {
            value: `${item?.email}`.trim(),
            type: "email",
          },
          fname: {
            value: `${item?.fname}`.trim(),
            type: "text",
          },
          lname: {
            value: `${item?.lname}`.trim(),
            type: "text",
          },
          dob: { value: dobString, type: "number" },
          role: { value: item?.role, type: "dropdown" },
          accessLevel: { value: `L${item?.accessLevel}`, type: "dropdown" },
        };
      })
    );

    return data;
  };

  const handleSubmit = async (data) => {
    const newUser = { email: data?.email, password: "Blindate@2024" };
    const adminUser = { email: user?.email, password: user?.password };
    try {
      if (!data?.uid) {
        await useActionUtils.logAction(user?.uid, "new_admin_account");
        const response = await useFirebaseAuth.createUserCredentials(
          newUser,
          adminUser
        );
        if (response?.success) {
          const userData = {
            uid: response?.uid,
            adminID: user?.uid,
            ...data,
            ...newUser,
          };
          const backendResponse = await useBackendServices.create(
            "admin",
            userData
          );

          if (backendResponse.acknowledged) {
            await useFirestoreServices.addDocument("admin", {
              ...userData,
              _id: backendResponse?.insertedId,
            });
            showToast("Admin account successfully created.", "success");
          }
        }
      } else {
        await useActionUtils.logAction(user?.uid, "edit_admin_account");
        const success = await useBackendServices.update(
          "admin",
          data?._id,
          data
        );
        if (success) {
          showToast("Changes saved", "success");
        }
      }
    } catch (err) {
      showToast("Unable to save changes.", "error");
    } finally {
      closeModal?.();
      reloadData?.("admin");
    }
  };

  const handleView = async (data) => {};

  const handleDelete = async (data) => {
    try {
      const id = data?.id;
      await useBackendServices.update("admin", id, {
        archived: true,
      });
    } catch (err) {
      showToast("Unable to delete admin account", "error");
    } finally {
      showToast("Successfully deleted", "success");
      reloadData?.("admin");
    }
  };

  return (
    <div className="flex h-screen bg-dashboard-background">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {dataset?.length > 0 && (
            <DataTable
              schema={adminSchema}
              data={tableData}
              rawData={admins}
              onSubmit={handleSubmit}
              onView={handleView}
              onDelete={handleDelete}
              showAddButton
              showActions
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
