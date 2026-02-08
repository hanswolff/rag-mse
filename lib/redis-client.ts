import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    if (process.env.NODE_ENV !== "test") {
      redisClient.on("error", (err) => {
        console.error("Redis connection error:", err);
      });

      redisClient.on("connect", () => {
        console.log("Redis client connected");
      });
    }
  }
  return redisClient;
}

export function closeRedisClient(): void {
  if (redisClient) {
    redisClient.quit();
    redisClient = null;
  }
}

export async function resetRedisForTesting(): Promise<void> {
  const client = getRedisClient();
  const keys = await client.keys("ratelimit:*");
  if (keys.length > 0) {
    await client.del(...keys);
  }
}
