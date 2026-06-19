import "dotenv/config";
import { Kafka } from "kafkajs";
import prisma from "../config/prisma.js";
import { updateCandlesFromTradeEvent } from "../services/trading-service/candle.service.js";

const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "cryptoex-backend";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const TRADE_EVENTS_TOPIC =
  process.env.KAFKA_TRADE_EVENTS_TOPIC || "cryptoex.trade.events";

const TRADE_CANDLE_CONSUMER_GROUP =
  process.env.KAFKA_TRADE_CANDLE_CONSUMER_GROUP ||
  "cryptoex-trade-candle-worker";

let isShuttingDown = false;

const kafka = new Kafka({
  clientId: `${KAFKA_CLIENT_ID}-trade-candles`,
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({
  groupId: TRADE_CANDLE_CONSUMER_GROUP,
});

const parseKafkaMessage = (message) => {
  if (!message.value) {
    throw new Error("Kafka message value is missing");
  }

  return JSON.parse(message.value.toString());
};

const processTradeEventMessage = async ({ message }) => {
  const domainEvent = parseKafkaMessage(message);

  if (domainEvent.eventType !== "trade.executed") {
    return {
      skipped: true,
      reason: `Unsupported event type: ${domainEvent.eventType}`,
    };
  }

  const result = await updateCandlesFromTradeEvent({
    tradeEvent: domainEvent.payload,
  });

  return {
    skipped: false,
    eventId: domainEvent.eventId,
    eventType: domainEvent.eventType,
    aggregateId: domainEvent.aggregateId,
    ...result,
  };
};

const startTradeCandleWorker = async () => {
  await consumer.connect();

  await consumer.subscribe({
    topic: TRADE_EVENTS_TOPIC,
    fromBeginning: false,
  });

  console.log("Trade candle worker listening:", {
    topic: TRADE_EVENTS_TOPIC,
    groupId: TRADE_CANDLE_CONSUMER_GROUP,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const result = await processTradeEventMessage({
          message,
        });

        console.log("Trade candle event processed:", {
          topic,
          partition,
          offset: message.offset,
          result,
        });
      } catch (error) {
        console.error("Trade candle event failed:", {
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

  console.log(`Received ${signal}. Closing trade candle worker...`);

  try {
    await consumer.disconnect();
    await prisma.$disconnect();

    console.log("Trade candle worker closed.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to close trade candle worker:", error);
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
  console.error("Unhandled rejection in trade candle worker:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in trade candle worker:", error);

  shutdown("uncaughtException");
});

await startTradeCandleWorker();