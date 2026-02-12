import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client";
import { io } from "socket.io-client";

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null); // Track socket to prevent duplicates

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }
    const payload = parseJwt(token);

    if (payload && payload.exp * 1000 > Date.now()) {
      setUser({ id: payload.id, email: payload.email, role: payload.role });
      setLoading(false); // Set loading to false immediately after setting user

      // Only create socket if one doesn't exist or is disconnected
      if (!socketRef.current || socketRef.current.disconnected) {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const newSocket = io(API_URL, {
          auth: {
            token: token,
          },
          transports: ["websocket", "polling"],

        });

        newSocket.on("connect", () => {
          console.log("Socket.IO connected");
        });

        newSocket.on("disconnect", () => {
          console.log("Socket.IO disconnected");
        });

        newSocket.on("error", (error) => {
          console.error("Socket.IO error:", error);
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket.IO connection error:", error);
          // Don't block UI if Socket.IO fails to connect
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Cleanup on unmount or token change
        return () => {
          if (socketRef.current && socketRef.current.connected) {
            console.log("Cleaning up socket:", socketRef.current.id);
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
          }
        };
      }
    } else {
      localStorage.removeItem("token");
      setTokenState(null);
      setUser(null);
      setLoading(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    }
  }, [token]);

  // Separate effect to clean up socket when token is removed
  useEffect(() => {
    if (!token && socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [token, socket]);

  const setToken = useCallback((newToken) => {
    if (newToken) {
      localStorage.setItem("token", newToken);
      setTokenState(newToken);
    } else {
      localStorage.removeItem("token");
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { token: t } = await api.login(email, password);
    setToken(t);
  }, [setToken]);

  const register = useCallback(async (email, password, role = "user") => {
    await api.register(email, password, role);
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setToken(null);
  }, [setToken, socket]);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    socket,
    isAuthenticated: !!token,
    canAccessMovies: user?.role === "admin" || user?.role === "moderator",
    canAccessUsers: user?.role === "admin"
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
