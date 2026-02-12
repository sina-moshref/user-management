import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import styles from "./UsersList.module.css";

const ROLES = ["user", "moderator", "admin"];

function roleClass(role) {
  if (role === "admin") return styles.roleAdmin;
  if (role === "moderator") return styles.roleModerator;
  return styles.roleUser;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatLastSeen(iso) {
  if (!iso) return "recently";
  try {
    const now = new Date();
    const lastSeen = new Date(iso);

    // Check if date is valid
    if (isNaN(lastSeen.getTime())) {
      console.warn("Invalid lastSeen date:", iso);
      return "Never";
    }

    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 0.5) return "online";
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;

    // For older dates, show formatted date
    return lastSeen.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "Never";
  }
}

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editPassword, setEditPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEdit = (user) => {
    setEditing(user);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword("");
    setEditError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setEditEmail("");
    setEditRole("user");
    setEditPassword("");
    setEditError(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      const payload = { email: editEmail.trim(), role: editRole };
      if (editPassword.trim()) payload.password = editPassword;
      await api.updateUser(editing.id, payload);
      closeEdit();
      await fetchUsers();
    } catch (err) {
      setEditError(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    setDeletingId(user.id);
    try {
      await api.deleteUser(user.id);
      await fetchUsers();
    } catch (err) {
      alert(err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>Loading users…</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Users</h1>
      <div className={styles.card}>
        {users.length === 0 ? (
          <div className={styles.empty}>No users yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>
                    <span className={`${styles.roleBadge} ${roleClass(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className={styles.date}>{formatDate(user.createdAt)}</td>
                  <td className={styles.date}>
                    <span className={user.lastSeen ? styles.lastSeenActive : styles.lastSeenNever}>
                      {formatLastSeen(user.lastSeen)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnEdit}`}
                        onClick={() => openEdit(user)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDelete}`}
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                      >
                        {deletingId === user.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className={styles.overlay} onClick={closeEdit}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Edit user</h2>
            <form onSubmit={handleSaveEdit}>
              <div className={styles.formGroup}>
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-password">New password (leave blank to keep)</label>
                <input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
              {editError && (
                <div className="form-error" style={{ marginBottom: "1rem" }}>
                  {editError}
                </div>
              )}
              <div className={styles.modalActions}>
                <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={closeEdit}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnSave}`} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
