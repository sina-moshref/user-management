import User from "../models/User.js";
import { getAllLastSeen } from "../config/redis.js";

export async function syncLastSeenToDatabase() {
  try {
    console.log("🔄 Starting daily sync of lastSeen from Redis to database...");
    
    const lastSeenMap = await getAllLastSeen();
    
    if (Object.keys(lastSeenMap).length === 0) {
      console.log("ℹ️  No lastSeen data found in Redis");
      return;
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const [userId, timestamp] of Object.entries(lastSeenMap)) {
      try {
        // Parse the ISO timestamp string to Date object
        const lastSeenDate = new Date(timestamp);
        
        // Validate the date
        if (isNaN(lastSeenDate.getTime())) {
          console.warn(`⚠️  Invalid timestamp for user ${userId}: ${timestamp}`);
          errorCount++;
          continue;
        }
        
        // Update the user's lastSeen in the database
        const [affectedRows] = await User.update(
          { lastSeen: lastSeenDate },
          { where: { id: userId } }
        );
        
        if (affectedRows > 0) {
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to update lastSeen for user ${userId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Daily sync completed: ${updatedCount} users updated, ${errorCount} errors`);
  } catch (error) {
    console.error("❌ Failed to sync lastSeen to database:", error.message);
  }
}

