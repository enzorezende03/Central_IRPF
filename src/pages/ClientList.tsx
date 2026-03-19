import { Navigate } from "react-router-dom";

// ClientList is now merged into Dashboard
export default function ClientList() {
  return <Navigate to="/" replace />;
}
