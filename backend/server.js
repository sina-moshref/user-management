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

const fastify = Fastify({ logger: true });

const PORT = process.env.PORT;

fastify.register(cors, {
  origin: true, 
  credentials: true
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
    

    try {
      const { Server } = await import("socket.io");
      const io = new Server(fastify.server, {
        cors: {
          origin: true,
          credentials: true,
          methods: ["GET", "POST"]
        },
        transports: ["websocket", "polling"]
      });


      io.use(async (socket, next) => {
          try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
            
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

      // Helper function to update lastSeen
      const updateLastSeen = async (userId, userEmail) => {
        try {
          await User.update(
            { lastSeen: new Date() },
            { where: { id: userId } }
          );
        } catch (error) {
          console.error("Failed to update lastSeen:", error.message);
        }
      };

      // Socket.IO connection handler
      io.on("connection", async (socket) => {
        const userId = socket.userId;
        const userEmail = socket.userEmail;
        const userRole = socket.userRole;
        
        console.log("Socket.IO client connected:", socket.id, "User:", userEmail, "Role:", userRole);


        // Join role-based room
        const roleRoom = `role:${userRole}`;
        socket.join(roleRoom);
        console.log(`User ${userEmail} joined room: ${roleRoom}`);
        
        // Log room members after join
        const room = io.sockets.adapter.rooms.get(roleRoom);
      

        // Helper function to get room members
        const getRoomMembers = (roomName) => {
          const room = io.sockets.adapter.rooms.get(roomName);
          if (!room) return [];
      
          // Get socket IDs in the room
          const socketIds = Array.from(room);
      
          // Get user info for each socket
          const members = socketIds.map(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              return {
                socketId: socket.id,
                userId: socket.userId,
                userEmail: socket.userEmail,
                userRole: socket.userRole
              };
            }
            return null;
          }).filter(Boolean);
          
          return members;
        };

        const getRoomMembersIds = (roomName) => {
          const room = io.sockets.adapter.rooms.get(roomName);
          if (!room) return [];
      
          // Get socket IDs in the room
          const socketIds = Array.from(room);
      
          // Get user info for each socket
          const memberIds = socketIds.map(socketId => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              return socket.userId
            }
            return null;
          }).filter(Boolean);
          
          return memberIds;
        };

        // Handle request to get room members
        socket.on("get-room-members", (roomName, callback) => {
          const members = getRoomMembers(roomName);
          // console.log(`Room ${roomName} has ${members.length} members:`, members);
          callback(members);
        });

        // Handle request to get all rooms
        socket.on("get-all-rooms", (callback) => {
          const rooms = {};
          const onlineUserIds = [];
          io.sockets.adapter.rooms.forEach((sockets, roomName) => {
            // Only include role-based rooms
            if (roomName.startsWith("role:")) {
              rooms[roomName] = getRoomMembers(roomName);
              onlineUserIds.push(...getRoomMembersIds(roomName));
            }
          });
          // console.log("All role-based rooms:", rooms);
          callback(rooms, onlineUserIds);
        });

        // Update lastSeen when user connects
        await updateLastSeen(userId, userEmail);
        
        // Set up periodic updates (every 30 seconds while connected)
        const heartbeatInterval = setInterval(async () => {
          await updateLastSeen(userId, userEmail);
        }, 60000); // Update every 30 seconds

        io.to("role:admin").emit("online-users", "Hello from the other side");

        // Handle disconnection
        socket.on("disconnect", async (reason) => {
          // Clear heartbeat interval
          clearInterval(heartbeatInterval);
          
          // Leave role-based room
          socket.leave(roleRoom);
          console.log(`User ${userEmail} left room: ${roleRoom}`);
          
          // Update lastSeen when user disconnects
          await updateLastSeen(userId, userEmail);
        });

        // Handle errors
        socket.on("error", (error) => {
          console.error("Socket.IO error:", error);
        });
      });

      console.log(`Socket.IO available at http://localhost:${PORT || 3000}`);
    } catch (error) {
      console.warn("Socket.IO not available. To enable Socket.IO, run: npm install socket.io");
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
