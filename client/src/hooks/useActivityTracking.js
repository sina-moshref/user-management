import { useEffect, useRef } from "react";

/**
 * Custom hook to track user activity and emit events via Socket.io
 * @param {Object} socket - Socket.io client instance
 * @param {Object} options - Configuration options
 * @param {number} options.throttleMs - Minimum time between activity events (default: 5000ms)
 * @param {boolean} options.enabled - Whether tracking is enabled (default: true)
 */
export function useActivityTracking(socket, options = {}) {
  const { throttleMs = 5000, enabled = true } = options;
  const lastEmitTime = useRef(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!socket || !enabled) {
      return;
    }

    // Throttled emit function
    const emitActivity = () => {
      // Only emit if socket is connected
      if (!socket.connected) {
        return;
      }

      const now = Date.now();
      if (now - lastEmitTime.current >= throttleMs) {
        lastEmitTime.current = now;
        socket.emit("user-activity");
        // console.log("Activity emitted to server"); // Commented out for production
      } else {
        // If throttled, schedule an emit after the throttle period
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (socket.connected) {
            lastEmitTime.current = Date.now();
            socket.emit("user-activity");
            // console.log("Activity emitted to server (delayed)"); // Commented out for production
          }
        }, throttleMs - (now - lastEmitTime.current));
      }
    };

    // Track various user activities (reduced set for better performance)
    const activities = [
      "mousedown",
      "keydown",
      "scroll",
      "click",
    ];

    // Wait for socket connection before adding listeners
    const setupListeners = () => {
      if (socket.connected) {
        // Add event listeners
        activities.forEach((event) => {
          window.addEventListener(event, emitActivity, { passive: true });
        });

        // Emit activity on initial connection
        emitActivity();
      }
    };

    // Setup listeners if already connected
    if (socket.connected) {
      setupListeners();
    }

    // Also listen for connect event
    socket.on("connect", setupListeners);

    // Cleanup
    return () => {
      socket.off("connect", setupListeners);
      activities.forEach((event) => {
        window.removeEventListener(event, emitActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [socket, throttleMs, enabled]);
}

