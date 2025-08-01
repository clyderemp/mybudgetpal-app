import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../../context/useAuth";

export default function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet></Outlet> : <Navigate to="/" />;
}
