import { useAuth } from "../../../context/useAuth";

export default function AuthInitializer({ children }) {
  const { loading } = useAuth();
  if (loading) {
    return <p>Loading</p>;
  }
  return children;
}
