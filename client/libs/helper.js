export function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }
  
  export function formatLastSeen(iso) {
    if (!iso) return "recently";
    try {
      const now = new Date();
      const lastSeen = new Date(iso);
  
      // Check if date is valid
      if (isNaN(lastSeen.getTime())) {
        console.warn("Invalid lastSeen date:", iso);
        return "Never";
      }
  
      const diffMs = now - lastSeen;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
  
      if (diffMins < 0.5) return "recently";
      if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
      if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  
      // For older dates, show formatted date
      return lastSeen.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "Never";
    }
  }