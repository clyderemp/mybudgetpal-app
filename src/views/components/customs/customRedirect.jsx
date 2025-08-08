import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useToast } from "@/context/toast.provider";

const UnderConstructionRedirect = () => {
  const { showToast } = useToast();

  useEffect(() => {
    showToast(
      "We're so sorry! The page you're trying to access is still under construction",
      "warning"
    );
  }, []);

  return <Navigate to="/" replace />;
};

export default UnderConstructionRedirect;
