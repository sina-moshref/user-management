// server.js
import "dotenv/config";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import sequelize, { syncModels } from "./config/database.js";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { authRoutes } from "./routes/auth.js";
import { moviesRoutes } from "./routes/movies.js";
import { usersRoutes } from "./routes/users.js";
import User from "./models/User.js";
import {
  updateLastSeen,
  setUserOnline,
  setUserOffline,
  getLastSeen,
} from "./config/redis.js";
import { syncLastSeenToDatabase } from "./jobs/syncLastSeen.js";
import cron from "node-cron";

const fastify = Fastify({ logger: true });

const PORT = process.env.PORT;

fastify.register(cors, {
  origin: true,
  credentials: true,
});
fastify.register(jwt, {
  secret: "super-secret-change-me",
});
fastify.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: { title: "fastify-api" },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT from POST /login. Example: Bearer &lt;token&gt;",
        },
      },
    },
  },
});

fastify.register(swaggerUi, {
  routePrefix: "/docs",
  exposeRoute: true,
});

fastify.decorate("authenticate", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

fastify.decorate("requireRoles", (allowedRoles) => {
  return async (request, reply) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
});

fastify.register(authRoutes);
fastify.register(moviesRoutes);
fastify.register(usersRoutes);

fastify.get("/health", async () => {
  return { status: "ok" };
});

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Sequelize connected ✅");

    await syncModels();

    await fastify.listen({ port: PORT || 3000, host: "0.0.0.0" });
 
    console.log(`🚀 Server running on http://localhost:${PORT || 3000}`);

    // Schedule daily sync of lastSeen from Redis to database
    // Runs every day at 2:00 AM (configure timezone if needed)
    cron.schedule("0 2 * * *", async () => {
      await syncLastSeenToDatabase();
    }, {
      scheduled: true,
      timezone: process.env.TZ || "UTC"
    });
    console.log("📅 Daily lastSeen sync scheduled (runs at 2:00 AM daily)");

    try {
      const { Server } = await import("socket.io");
      const io = new Server(fastify.server, {
        cors: {
          origin: true,
          credentials: true,
          methods: ["GET", "POST"],
        },
        transports: ["websocket", "polling"],
      });

      io.use(async (socket, next) => {
        try {
          const token =
            socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.replace("Bearer ", "");

          if (!token) {
            return next(new Error("Authentication required"));
          }

          const decoded = await fastify.jwt.verify(token);
          socket.userId = decoded.id;
          socket.userEmail = decoded.email;
          socket.userRole = decoded.role;

          next();
        } catch (error) {
          console.error("Socket.IO authentication failed:", error.message);
          next(new Error("Authentication failed"));
        }
      });

      io.on("connection", async (socket) => {
        const userId = socket.userId;
        const userEmail = socket.userEmail;
        const userRole = socket.userRole;

        console.log(
          "Socket.IO client connected:",
          socket.id,
          "User:",
          userEmail,
          "Role:",
          userRole,
        );

        const roleRoom = `role:${userRole}`;
        socket.join(roleRoom);
        console.log(`User ${userEmail} joined room: ${roleRoom}`);

        await setUserOnline(userId);
        await updateLastSeen(userId);

        const heartbeatInterval = setInterval(async () => {
          await updateLastSeen(userId);
        }, 60000);

        // Notify admins that user is online
        io.to("role:admin").emit("online-user-id", {
          userId,
          lastSeen: "online",
        });

        socket.on("disconnect", async (reason) => {
          clearInterval(heartbeatInterval);

          socket.leave(roleRoom);
          console.log(`User ${userEmail} left room: ${roleRoom}`);

          const lastSeenTimestamp = new Date().toISOString();

          await setUserOffline(userId);

          await updateLastSeen(userId);

          // Notify admins that user is offline (send user data with lastSeen)
          io.to("role:admin").emit("offline-user-id", {
            userId,
            lastSeen: lastSeenTimestamp,
          });
        });

        // Handle errors
        socket.on("error", (error) => {
          console.error("Socket.IO error:", error);
        });
      });

      console.log(`Socket.IO available at http://localhost:${PORT || 3000}`);
    } catch (error) {
      console.warn(
        "Socket.IO not available. To enable Socket.IO, run: npm install socket.io",
      );
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
