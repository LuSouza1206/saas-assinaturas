import Redis from "ioredis";
import { env } from "./env";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 8000,
      lazyConnect: false,
      tls: env.redisUrl.startsWith("rediss://") ? {} : undefined,
    });
  }
  return redis;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await getRedis().ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
