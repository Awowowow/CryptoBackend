import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
  console.log('Redis error:', err);
});

redisClient.on("connect", () => {
    console.log("Redis client connecting...");
});
redisClient.on("ready", () => {
    console.log("Redis connected and ready");
});

export default redisClient;
