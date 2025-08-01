import React, { useContext } from "react";
import { AuthContext } from "./auth.provider";
import Loader from "@/views/components/static/Loader";

const AuthInitializer = ({ children }) => {
  const { loading } = useContext(AuthContext);

  if (loading) {
    // Show spinner or placeholder while checking auth status
    return <Loader />;
  }

  // Optionally, you could add logic here to redirect
  // if user is null or not authenticated, but usually
  // your route guards handle that.

  return <>{children}</>;
};

export default AuthInitializer;
