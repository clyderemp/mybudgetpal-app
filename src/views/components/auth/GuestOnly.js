import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../../context/useAuth";

export default function GuestOnly() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" /> : <Outlet />;
}
