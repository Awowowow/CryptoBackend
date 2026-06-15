import "dotenv/config";
import { Client } from "pg";
import { DomainEventOutboxStatus } from "@prisma/client";
import prisma from "../config/prisma.js";
import { disconnectKafkaProducer, publishDomainEventToKafka } from "../services/event-service/kafkaProducer.service.js";

const OUTBOX_NOTIFY_CHANNEL = "domain_event_outbox_inserted";
const OUTBOX_POLL_INTERVAL_MS = 60_000;
const OUTBOX_BATCH_SIZE = 50;

let isShuttingDown = false;
let isProcessingOutbox = false;

const getPostgresConnectionString = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  return connectionString;
};

const publishOutboxEvent = async (event) => {
    console.log("Publishing domain event to Kafka:", {
      id: event.id,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
    });
  
    await publishDomainEventToKafka(event);
  };

const processOutboxBatch = async () => {
  if (isProcessingOutbox) {
    return;
  }

  isProcessingOutbox = true;

  try {
    const events = await prisma.domainEventOutbox.findMany({
      where: {
        status: DomainEventOutboxStatus.PENDING,
        availableAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: OUTBOX_BATCH_SIZE,
    });

    for (const event of events) {
      const lockedEvent = await prisma.domainEventOutbox.updateMany({
        where: {
          id: event.id,
          status: DomainEventOutboxStatus.PENDING,
        },
        data: {
          status: DomainEventOutboxStatus.PUBLISHING,
          lockedAt: new Date(),
          attempts: {
            increment: 1,
          },
          lastError: null,
        },
      });

      if (lockedEvent.count === 0) {
        continue;
      }

      try {
        await publishOutboxEvent(event);

        await prisma.domainEventOutbox.update({
          where: {
            id: event.id,
          },
          data: {
            status: DomainEventOutboxStatus.PUBLISHED,
            publishedAt: new Date(),
            lastError: null,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Outbox publish failed";

        await prisma.domainEventOutbox.update({
          where: {
            id: event.id,
          },
          data: {
            status: DomainEventOutboxStatus.PENDING,
            availableAt: new Date(Date.now() + 30_000),
            lastError: message,
          },
        });
      }
    }
  } finally {
    isProcessingOutbox = false;
  }
};

const startOutboxListener = async () => {
  const pgClient = new Client({
    connectionString: getPostgresConnectionString(),
  });

  await pgClient.connect();

  await pgClient.query(`LISTEN ${OUTBOX_NOTIFY_CHANNEL}`);

  console.log(`Domain event outbox worker listening on ${OUTBOX_NOTIFY_CHANNEL}`);

  pgClient.on("notification", async (message) => {
    if (message.channel !== OUTBOX_NOTIFY_CHANNEL) {
      return;
    }

    console.log("Outbox notification received:", {
      channel: message.channel,
      payload: message.payload,
    });

    await processOutboxBatch();
  });

  return pgClient;
};

const pgClient = await startOutboxListener();

const pollInterval = setInterval(() => {
  processOutboxBatch();
}, OUTBOX_POLL_INTERVAL_MS);

await processOutboxBatch();

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Received ${signal}. Closing domain event outbox worker...`);

  clearInterval(pollInterval);

  try {
    await pgClient.end();
    await disconnectKafkaProducer();
    await prisma.$disconnect();

    console.log("Domain event outbox worker closed.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to close domain event outbox worker:", error);
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
  console.error("Unhandled rejection in domain event outbox worker:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in domain event outbox worker:", error);
  shutdown("uncaughtException");
});