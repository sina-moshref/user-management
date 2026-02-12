import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Movies from "./pages/Movies";
import { useAuth } from "./context/AuthContext";
import UsersList  from "./pages/UsersList";

function ProtectedRoute({ children, requireRoles }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <div className="app-loading">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireRoles?.length && !requireRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="movies"
          element={
            <ProtectedRoute requireRoles={["admin", "moderator"]}>
              <Movies />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute requireRoles={["admin"]}>
              <UsersList />
            </ProtectedRoute>
          }
        />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
