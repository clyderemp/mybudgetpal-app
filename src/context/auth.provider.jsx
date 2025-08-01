import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useFirebaseConfig } from "@/configs/firebase.config";
import { useFirebaseAuth } from "@/services/client/firebase-auth.service";
import { useFirestoreServices } from "@/services/client/firebase-firestore.service";
import { useBackendServices } from "@/services/server/backend.services";
import { useCacheUtils } from "@/utils/cache.utils";
import { useFilterUtils } from "@/utils/filter.utils";
import { useActionUtils } from "@/utils/action.utils";

const { auth } = useFirebaseConfig;

// Create the context
export const AuthContext = createContext();

// Hook to consume context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState(null);
  const [waitlist, setWaitlist] = useState(null);
  const [blogs, setBlogs] = useState(null);
  const [admins, setAdmins] = useState(null);
  const [loading, setLoading] = useState(true);

  const { login, logout } = useFirebaseAuth;

  // Extracted reusable function to load all data
  const loadData = async (uid) => {
    setLoading(true);
    try {
      let adminData = null;

      // Check Firestore first
      const firestoreData = await useFirestoreServices.getDocument(
        "admin",
        uid
      );

      if (firestoreData?._id) {
        // Check Backend — if missing, create it
        try {
          const mongoData = await useBackendServices.get("admin", uid);
          adminData = mongoData;
        } catch {
          const { _id, ...rest } = firestoreData;
          await useBackendServices.create("admin", {
            ...rest,
          });
          const mongoData = await useBackendServices.get("admin", uid);
          adminData = mongoData;
        }
      } else {
        try {
          const mongoData = await useBackendServices.get("admin", uid);
          adminData = mongoData;
          await useFirestoreServices.addDocument("admin", {
            ...mongoData,
            _id: uid,
          });
        } catch {}
      }

      await useActionUtils.setUserData(adminData);
      const accessLevel = JSON.parse(adminData?.accessLevel);

      const loadCollection = async (key) => {
        const stored = await useCacheUtils.get(key);
        if (stored) return JSON.parse(stored);
        const fetched = await useBackendServices.getAll(key);
        await useCacheUtils.save(key, JSON.stringify(fetched));
        return fetched;
      };

      const usersCollection = await loadCollection("users");
      const waitlistCollection = await loadCollection("waitlist");
      const blogsCollection = await loadCollection("blogs");

      let adminCollection = await loadCollection("admin");
      if (accessLevel < 2) {
        adminCollection = await useFilterUtils.filterOutArchived(
          adminCollection
        );
      }

      setUser(adminData);
      setUsers(usersCollection);
      setWaitlist(waitlistCollection);
      setBlogs(blogsCollection);
      setAdmins(adminCollection);
    } catch (err) {
      console.error(err);
      logout();
      setUser(null);
      setUsers(null);
      setWaitlist(null);
      setBlogs(null);
      setAdmins(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.uid) {
        await loadData(firebaseUser.uid);
      } else {
        setUser(null);
        setUsers(null);
        setWaitlist(null);
        setBlogs(null);
        setLoading(false);
        await useActionUtils.onLogin(firebaseUser?.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleReloadData = async (key = "all") => {
    const uid = user?.uid;
    try {
      switch (key) {
        case "all":
          await Promise.all([
            useCacheUtils.remove("users"),
            useCacheUtils.remove("waitlist"),
            useCacheUtils.remove("blogs"),
            useCacheUtils.remove("admin"),
          ]);
          await loadData(uid);
          break;

        case "users":
          await useCacheUtils.remove("users");
          await loadData(uid);
          break;

        case "waitlist":
          await useCacheUtils.remove("waitlist");
          await loadData(uid);
          break;

        case "blogs":
          await useCacheUtils.remove("blogs");
          await loadData(uid);
          break;

        case "admin":
          await useCacheUtils.remove("admin");
          await loadData(uid);
          break;

        default:
          console.warn(`Unknown reload key: ${key}`);
          break;
      }
    } catch (error) {
      console.error(`Failed to reload ${key}:`, error);
    }
  };

  const handleLogout = async () => {
    await useActionUtils.onLogout(user?.uid);
    logout?.();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        waitlist,
        blogs,
        admins,
        login,
        logout: handleLogout,
        loading,
        reloadData: handleReloadData, // expose this function so components can reload manually
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
