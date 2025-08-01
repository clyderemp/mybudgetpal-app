import { useFirebaseConfig } from "@/configs/firebase.config";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { useCacheUtils } from "@/utils/cache.utils";

const { auth } = useFirebaseConfig;

class FirebaseAuth {
  async login(credentials) {
    const { email, password } = credentials;
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = userCredential?.user?.uid; // get the UID from the logged-in user
      return { success: true, uid };
    } catch (err) {
      if (err.code === "auth/invalid-email") {
        return {
          message: "Invalid email",
          success: false,
          errors: { email: true },
        };
      } else if (err.code === "auth/wrong-password") {
        return {
          message: "Invalid password",
          success: false,
          errors: { password: true },
        };
      } else {
        return {
          message: "Invalid Credentials",
          success: false,
          errors: { email: true, password: true },
        };
      }
    }
  }

  logout() {
    useCacheUtils.clear();
    auth.signOut();
  }

  async createUserCredentials(newUser, adminUser) {
    try {
      // 1. Create new user (this logs in as new user)
      const { newEmail, newPassword } = newUser;
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newEmail,
        newPassword
      );
      const uid = userCredential.user.uid;

      // 2. Sign out new user
      await auth.signOut();

      // 3. Sign back in as admin user
      const { adminEmail,  adminPassword } = adminUser;
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      return { success: true, uid };
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        return {
          message: "Email already in use",
          success: false,
          errors: { email: true },
        };
      } else if (err.code === "auth/invalid-email") {
        return {
          message: "Invalid email",
          success: false,
          errors: { email: true },
        };
      } else if (err.code === "auth/weak-password") {
        return {
          message: "Password is too weak",
          success: false,
          errors: { password: true },
        };
      } else if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        return {
          message: "Failed to re-authenticate as admin",
          success: false,
        };
      } else {
        return { message: "Failed to create user", success: false };
      }
    }
  }
}

export const useFirebaseAuth = new FirebaseAuth();
