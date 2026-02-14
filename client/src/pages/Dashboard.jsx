import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Dashboard.module.css";
import { useEffect } from "react";

export default function Dashboard() {
  const { user, canAccessMovies, canAccessUsers, token, socket } = useAuth();

  useEffect(() => {
    // Only connect if user is authenticated and socket exists
    if (!socket) {
      console.log("⚠️  Socket not available yet");
      return;
    }

    // const getRoomInfo = () => {
    //   socket.emit("get-all-rooms", (rooms, onlineUserIds) => {
    //     console.log("🔌 All rooms:", rooms);
    //     console.log("🔌 Online user IDs:", onlineUserIds);
    //   });

    //   socket.emit("get-room-members", "role:admin", (members) => {
    //     console.log("🔌 Admin members:", members);
    //   });
    //   socket.emit("get-room-members", "role:moderator", (members) => {
    //     console.log("🔌 Moderator members:", members);
    //   });
    //   socket.emit("get-room-members", "role:user", (members) => {
    //     console.log("🔌 User members:", members);
    //   });
    // }

    // If socket is already connected, get room info immediately
    // if (socket.connected) {
    //   getRoomInfo();
    // }

    // Connection event
    socket.on("connect", () => {
      console.log("✅ Socket.IO connected:", socket.id);
      // Get room info when connected
      // getRoomInfo();
      socket.on("hello", (message) => {
        console.log("🔌Admin Hello message:", message);
      });
    });

    // Disconnection event
    socket.on("disconnect", (reason) => {
      console.log("🔌 Socket.IO disconnected:", reason);
    });

    // Connection error
    socket.on("connect_error", (error) => {
      console.error("❌ Socket.IO connection error:", error.message);
      if (error.message === "Authentication failed") {
        console.error("💡 Authentication failed. Please log in again.");
      }
    });





    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
      }
    };
  }, [socket]);




  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.welcome}>
        Hello, <strong>{user?.email}</strong>. You’re signed in as{" "}
        <strong>{user?.role}</strong>.
      </p>
      <div className={styles.card}>
        <h2>Quick info</h2>
        <ul>
          <li>Your role: <strong>{user?.role}</strong></li>
          {canAccessMovies ? (
            <li>You can access the <Link to="/movies">Movies</Link> section (admin/moderator).</li>
          ) : (
            <li>Movies section is only available for admin and moderator roles.</li>
          )}
          {canAccessUsers && <li>Users section is only available for admin role.</li>}
        </ul>
      </div>
    </div>
  );
}
