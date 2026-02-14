import User from "../models/User.js";
import bcrypt from "bcrypt";
import { getLastSeenBatch, getOnlineStatusBatch } from "../config/redis.js";
import { syncLastSeenToDatabase } from "../jobs/syncLastSeen.js";

export async function listUsersHandler(request, reply) {
  const users = await User.findAll({
    attributes: ["id", "email", "role", "createdAt"],
    order: [["createdAt", "DESC"]],
    raw: false,
  });

  // Get user IDs
  const userIds = users.map((u) => u.id);

  // Fetch lastSeen and online status from Redis in parallel
  const [lastSeenMap, onlineStatusMap] = await Promise.all([
    getLastSeenBatch(userIds),
    getOnlineStatusBatch(userIds),
  ]);

  return {
    users: users.map((u) => {
      const userId = u.id;
      const isOnline = onlineStatusMap[userId] || false;
      const lastSeenTimestamp = lastSeenMap[userId] || null;

      // If user is online, show "online", otherwise show lastSeen timestamp
      const lastSeen = isOnline ? "online" : lastSeenTimestamp;

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastSeen: lastSeen,
        isOnline: isOnline,
      };
    }),
  };
}

export async function updateUserHandler(request, reply) {
  const { id } = request.params;
  const { email, role, password } = request.body;

  const user = await User.findByPk(id);
  if (!user) return reply.code(404).send({ error: "User not found" });

  if (email !== undefined) {
    const existing = await User.findOne({ where: { email } });
    if (existing && existing.id !== id)
      return reply.code(409).send({ error: "Email already in use" });
    user.email = email;
  }
  if (role !== undefined) {
    if (!["user", "admin", "moderator"].includes(role))
      return reply.code(400).send({ error: "Invalid role" });
    user.role = role;
  }
  if (password !== undefined && password !== "") {
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  await user.save();
  return { id: user.id, email: user.email, role: user.role };
}

export async function deleteUserHandler(request, reply) {

  const { id } = request.params;
  const currentUserId = request.user?.id;
  if (id === currentUserId)
    return reply.code(400).send({ error: "Cannot delete your own account" });

  const user = await User.findByPk(id);
  if (!user) return reply.code(404).send({ error: "User not found" });
  await user.destroy();
  return { ok: true };
}


export async function syncLastSeenHandler(request, reply) {
  try {
    await syncLastSeenToDatabase();
    return { success: true, message: "LastSeen sync completed successfully" };
  } catch (error) {
    console.error(error);
    return reply.code(500).send({ success: false, error: "Failed to sync lastSeen data" });
  }
}