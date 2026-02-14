import Redis from "ioredis";

// Track connection state to avoid spam
let isConnected = false;
let lastErrorTime = 0;
let hasGivenUp = false; // Track if we've stopped trying
const ERROR_THROTTLE_MS = 30000; // Only log errors every 30 seconds
const MAX_RECONNECT_ATTEMPTS = 3; // Stop trying after 3 attempts

// Create Redis client with lazy connect and limited retries
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true, // Don't connect immediately
  retryStrategy: (times) => {
    // Stop retrying after MAX_RECONNECT_ATTEMPTS
    if (times > MAX_RECONNECT_ATTEMPTS) {
      if (!hasGivenUp) {
        hasGivenUp = true;
        console.warn("⚠️  Redis: Stopping reconnection attempts after", MAX_RECONNECT_ATTEMPTS, "tries.");
        console.warn("   LastSeen tracking is disabled. To enable, start Redis and restart the server.");
      }
      return null; // Stop retrying
    }
    const delay = Math.min(times * 1000, 5000); // Max 5 seconds between retries
    return delay;
  },
  maxRetriesPerRequest: 0, // Don't retry failed requests
  enableOfflineQueue: false, // Don't queue commands when offline
  connectTimeout: 3000, // 3 second timeout
  showFriendlyErrorStack: false, // Reduce error verbosity
});

// Attempt to connect on startup (only once)
let connectionAttempted = false;

const attemptConnection = async () => {
  if (connectionAttempted) return;
  connectionAttempted = true;

  try {
    await redis.connect();
  } catch (err) {
    const now = Date.now();
    if (now - lastErrorTime > ERROR_THROTTLE_MS) {
      lastErrorTime = now;
      console.warn("⚠️  Redis not available. LastSeen tracking will be disabled.");
      console.warn("   To enable Redis, make sure Redis is running on", 
        `${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`);
      console.warn("   Error:", err.message || "Connection refused");
      console.warn("   The app will continue to work without Redis.");
    }
  }
};

// Only attempt connection if REDIS_ENABLED is not explicitly set to false
if (process.env.REDIS_ENABLED !== "false") {
  attemptConnection();
}

redis.on("connect", () => {
  isConnected = true;
  hasGivenUp = false; // Reset on successful connection
  console.log("✅ Redis connected successfully");
});

redis.on("ready", () => {
  isConnected = true;
  hasGivenUp = false;
  console.log("✅ Redis ready");
});

redis.on("error", (err) => {
  isConnected = false;
  // Suppress errors if we've given up
  if (hasGivenUp) {
    return;
  }
  const now = Date.now();
  // Throttle error messages to avoid spam
  if (now - lastErrorTime > ERROR_THROTTLE_MS) {
    lastErrorTime = now;
    console.warn("⚠️  Redis connection error:", err.message || "Connection failed");
  }
});

redis.on("close", () => {
  isConnected = false;
  // Suppress close messages - they're too noisy
});

redis.on("reconnecting", (delay) => {
  // Suppress reconnecting messages if we've given up
  if (hasGivenUp) {
    return;
  }
  // Suppress reconnecting messages - they're too noisy
  // Only show first attempt
  // (removed logging to reduce spam)
});

// Helper functions for lastSeen tracking
export const lastSeenKeys = {
  // Key format: lastSeen:userId
  getKey: (userId) => `lastSeen:${userId}`,
  // Key format: online:userId (stores timestamp when user came online)
  getOnlineKey: (userId) => `online:${userId}`,
};

/**
 * Check if Redis is connected
 * @returns {boolean}
 */
export function isRedisConnected() {
  return isConnected && redis.status === "ready";
}

/**
 * Update user's last seen timestamp in Redis
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function updateLastSeen(userId) {
  if (!isRedisConnected()) {
    return; // Silently fail if Redis is not available
  }
  try {
    const timestamp = new Date().toISOString();
    await redis.set(lastSeenKeys.getKey(userId), timestamp);
    // Set expiration to 30 days (optional, to prevent Redis from growing too large)
    await redis.expire(lastSeenKeys.getKey(userId), 30 * 24 * 60 * 60);
  } catch (error) {
    // Silently fail - Redis might be temporarily unavailable
  }
}

/**
 * Mark user as online in Redis
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function setUserOnline(userId) {
  if (!isRedisConnected()) {
    return;
  }
  try {
    const timestamp = new Date().toISOString();
    await redis.set(lastSeenKeys.getOnlineKey(userId), timestamp);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Mark user as offline in Redis
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function setUserOffline(userId) {
  if (!isRedisConnected()) {
    return;
  }
  try {
    await redis.del(lastSeenKeys.getOnlineKey(userId));
    // Update lastSeen when user goes offline
    await updateLastSeen(userId);
  } catch (error) {
    // Silently fail
  }
}

/**
 * Check if user is online
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function isUserOnline(userId) {
  if (!isRedisConnected()) {
    return false;
  }
  try {
    const result = await redis.exists(lastSeenKeys.getOnlineKey(userId));
    return result === 1;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's last seen timestamp
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - ISO timestamp or null
 */
export async function getLastSeen(userId) {
  if (!isRedisConnected()) {
    return null;
  }
  try {
    const timestamp = await redis.get(lastSeenKeys.getKey(userId));
    return timestamp;
  } catch (error) {
    return null;
  }
}

/**
 * Get last seen for multiple users
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object>} - Object mapping userId to lastSeen timestamp
 */
export async function getLastSeenBatch(userIds) {
  if (!isRedisConnected()) {
    return {};
  }
  try {
    if (userIds.length === 0) return {};
    
    const keys = userIds.map(id => lastSeenKeys.getKey(id));
    const values = await redis.mget(...keys);
    
    const result = {};
    userIds.forEach((userId, index) => {
      result[userId] = values[index] || null;
    });
    
    return result;
  } catch (error) {
    return {};
  }
}

/**
 * Get online status for multiple users
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<Object>} - Object mapping userId to online status (boolean)
 */
export async function getOnlineStatusBatch(userIds) {
  if (!isRedisConnected()) {
    return {};
  }
  try {
    if (userIds.length === 0) return {};
    
    // Use pipeline for better performance
    const pipeline = redis.pipeline();
    userIds.forEach(id => {
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
    return {};
  }
}

export default redis;

