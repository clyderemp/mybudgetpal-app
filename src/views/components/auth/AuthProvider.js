import { AuthContext } from "../../../context/useAuth";
import { useState, useEffect } from "react";
import { login, logout } from "../../../services/client/firebase-auth.service";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../configs/firebase.config";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
