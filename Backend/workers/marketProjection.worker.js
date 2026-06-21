import "dotenv/config";
import { Kafka } from "kafkajs";
import prisma from "../config/prisma.js";
import redisClient from "../config/redis.js";
import { MARKET_EVENTS_TOPIC } from "../services/market-data-service/marketEvent.constants.js";
import { projectMarketEvent } from "../services/market-data-service/marketProjection.service.js";

const KAFKA_CLIENT_ID =
  process.env.KAFKA_CLIENT_ID || "cryptoex-backend";

const KAFKA_BROKERS = (
  process.env.KAFKA_BROKERS || "localhost:9092"
)
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const MARKET_PROJECTION_CONSUMER_GROUP =
  process.env.KAFKA_MARKET_PROJECTION_CONSUMER_GROUP ||
  "cryptoex-market-projection-worker";

const MARKET_PROJECTION_FROM_BEGINNING = process.env.KAFKA_MARKET_PROJECTION_FROM_BEGINNING !== "false";

const MARKET_PROJECTION_DEBUG = process.env.MARKET_PROJECTION_DEBUG === "true";

let isShuttingDown = false;

const kafka = new Kafka({
  clientId: `${KAFKA_CLIENT_ID}-market-projection`,
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({
  groupId: MARKET_PROJECTION_CONSUMER_GROUP,
});

const parseMarketEventMessage = (message) => {
    if (!message.value) {
      throw new Error("Kafka market event message value is missing");
    }
  
    const rawValue = message.value.toString("utf8");
  
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      throw new Error(
        `Kafka market event contains invalid JSON: ${error.message}`
      );
    }
};

const processMarketEventMessage = async ({ message }) => {
    const marketEvent = parseMarketEventMessage(message);
  
    const projectionResult = await projectMarketEvent({
      marketEvent,
    });
  
    return {
      eventId: marketEvent.eventId,
      eventType: marketEvent.eventType,
      symbol: marketEvent.symbol,
      provider: marketEvent.provider,
      projectionResult,
    };
};

const startMarketProjectionWorker = async () => {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  
    await consumer.connect();
  
    await consumer.subscribe({
      topic: MARKET_EVENTS_TOPIC,
      fromBeginning: MARKET_PROJECTION_FROM_BEGINNING,
    });
  
    console.log("Market projection worker listening:", {
      topic: MARKET_EVENTS_TOPIC,
      groupId: MARKET_PROJECTION_CONSUMER_GROUP,
      fromBeginning: MARKET_PROJECTION_FROM_BEGINNING,
    });
  
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const result = await processMarketEventMessage({
            message,
          });
  
          if (MARKET_PROJECTION_DEBUG) {
            console.log("Market event projected:", {
              topic,
              partition,
              offset: message.offset,
              eventId: result.eventId,
              eventType: result.eventType,
              symbol: result.symbol,
            });
          }
        } catch (error) {
          console.error("Market event projection failed:", {
            topic,
            partition,
            offset: message.offset,
            error: error.message,
          });
  
          throw error;
        }
      },
    });
};

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `Received ${signal}. Closing market projection worker...`
  );

  try {
    await consumer.disconnect();

    if (redisClient.isOpen) {
      await redisClient.quit();
    }

    await prisma.$disconnect();

    console.log("Market projection worker closed.");
    process.exit(0);
  } catch (error) {
    console.error(
      "Failed to close market projection worker:",
      error
    );

    process.exit(1);
  }
};


process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  
process.on("SIGTERM", () => {
    shutdown("SIGTERM");
});
  
process.on("unhandledRejection", (reason) => {
    console.error(
      "Unhandled rejection in market projection worker:",
      reason
    );
  
    shutdown("unhandledRejection");
});
  
process.on("uncaughtException", (error) => {
    console.error(
      "Uncaught exception in market projection worker:",
      error
    );
  
    shutdown("uncaughtException");
});

await startMarketProjectionWorker();