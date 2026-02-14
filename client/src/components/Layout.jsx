import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Layout.module.css";

export default function Layout() {
  const { user, logout, canAccessMovies, canAccessUsers } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <NavLink to="/" className={styles.logo} end>
            User Management
          </NavLink>
          <div className={styles.links}>
            <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : "")} end>
              Dashboard
            </NavLink>
            {canAccessMovies && (
              <NavLink to="/movies" className={({ isActive }) => (isActive ? styles.active : "")}>
                Movies
              </NavLink>
            )}
            {canAccessUsers && (
              <NavLink to="/users" className={({ isActive }) => (isActive ? styles.active : "")}>
                Users
              </NavLink>
            )}
          </div>
          <div className={styles.user}>
            <span className={styles.email}>{user?.email}</span>
            <span className={styles.role}>{user?.role}</span>
            <button type="button" onClick={handleLogout} className={styles.logout}>
              Log out
            </button>
          </div>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
