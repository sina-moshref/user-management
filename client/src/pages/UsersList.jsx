import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import styles from "./UsersList.module.css";
import { formatDate, formatLastSeen } from "../../libs/helper";

const ROLES = ["user", "moderator", "admin"];

function roleClass(role) {
  if (role === "admin") return styles.roleAdmin;
  if (role === "moderator") return styles.roleModerator;
  return styles.roleUser;
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

  const { socket } = useAuth();

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

  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.on("online-user-id", (data) => {
      const userId = data.userId;
      const lastSeen = data.lastSeen || null;
      editLastSeen(userId, "online", lastSeen);
    });

    socket.on("offline-user-id", (data) => {
      const userId = data.userId;
      const lastSeen = data.lastSeen || null;
      editLastSeen(userId, "offline", lastSeen);
    });

    return () => {
      socket.off("online-user-id");
      socket.off("offline-user-id");
    };
  }, [socket]);

  const openEdit = (user) => {
    setEditing(user);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword("");
    setEditError(null);
  };

  const editLastSeen = (id, status, lastSeenTimestamp = null) => {
    setUsers(prev => prev.map(user => {
      if (user.id === id) {
        const lastSeenValue = status === "online"
          ? "online"
          : lastSeenTimestamp;
        return { ...user, lastSeen: lastSeenValue, isOnline: status === "online" };
      }
      return user;
    }));
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
                    <span className={user.isOnline || user.lastSeen === "online" ? styles.lastSeenActive : styles.lastSeenNever}>
                      {user.isOnline || user.lastSeen === "online"
                        ? "online"
                        : (user.lastSeen && user.lastSeen !== "online"
                          ? formatLastSeen(user.lastSeen)
                          : "Never")}
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
