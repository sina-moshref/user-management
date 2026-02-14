import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("Redis connected ✅");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});

export const lastSeenKeys = {
  getKey: (userId) => `lastSeen:${userId}`,
  getOnlineKey: (userId) => `online:${userId}`,
};

export async function updateLastSeen(userId) {
  try {
    const timestamp = new Date().toISOString();
    await redis.set(lastSeenKeys.getKey(userId), timestamp);
    await redis.expire(lastSeenKeys.getKey(userId), 30 * 24 * 60 * 60);
  } catch (error) {
    console.error("Failed to update lastSeen in Redis:", error.message);
  }
}

export async function setUserOnline(userId) {
  try {
    const timestamp = new Date().toISOString();
    await redis.set(lastSeenKeys.getOnlineKey(userId), timestamp);
  } catch (error) {
    console.error("Failed to set user online in Redis:", error.message);
  }
}

export async function setUserOffline(userId) {
  try {
    await redis.del(lastSeenKeys.getOnlineKey(userId));
    await updateLastSeen(userId);
  } catch (error) {
    console.error("Failed to set user offline in Redis:", error.message);
  }
}

export async function isUserOnline(userId) {
  try {
    const result = await redis.exists(lastSeenKeys.getOnlineKey(userId));
    return result === 1;
  } catch (error) {
    console.error("Failed to check if user is online:", error.message);
    return false;
  }
}

export async function getLastSeen(userId) {
  try {
    const timestamp = await redis.get(lastSeenKeys.getKey(userId));
    return timestamp;
  } catch (error) {
    console.error("Failed to get lastSeen from Redis:", error.message);
    return null;
  }
}

export async function getLastSeenBatch(userIds) {
  try {
    if (userIds.length === 0) return {};

    const keys = userIds.map((id) => lastSeenKeys.getKey(id));
    const values = await redis.mget(...keys);

    const result = {};
    userIds.forEach((userId, index) => {
      result[userId] = values[index] || null;
    });

    return result;
  } catch (error) {
    console.error("Failed to get lastSeen batch from Redis:", error.message);
    return {};
  }
}

export async function getOnlineStatusBatch(userIds) {
  try {
    if (userIds.length === 0) return {};

    // Use pipeline for better performance
    const pipeline = redis.pipeline();
    userIds.forEach((id) => {
      pipeline.exists(lastSeenKeys.getOnlineKey(id));
    });

    const results = await pipeline.exec();

    const result = {};
    userIds.forEach((userId, index) => {
      // results is an array of [error, result] tuples
      const [, exists] = results[index] || [null, 0];
      result[userId] = exists === 1;
    });

    return result;
  } catch (error) {
    console.error(
      "Failed to get online status batch from Redis:",
      error.message,
    );
    return {};
  }
}

export async function getAllLastSeen() {
  try {
    // Get all keys matching the pattern lastSeen:*
    const keys = await redis.keys("lastSeen:*");
    
    if (keys.length === 0) return {};
    
    // Extract user IDs from keys (remove "lastSeen:" prefix)
    const userIds = keys.map(key => key.replace("lastSeen:", ""));
    
    // Get all values in batch
    const values = await redis.mget(...keys);
    
    const result = {};
    userIds.forEach((userId, index) => {
      if (values[index]) {
        result[userId] = values[index];
      }
    });
    
    return result;
  } catch (error) {
    console.error("Failed to get all lastSeen from Redis:", error.message);
    return {};
  }
}

export default redis;
