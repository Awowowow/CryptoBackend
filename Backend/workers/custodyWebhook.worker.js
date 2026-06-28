import "dotenv/config";
import { Worker } from "bullmq";
import {
  CUSTODY_WEBHOOK_JOB_NAMES,
  redisConnection,
} from "../queues/custodyWebhook.queue.js";
import {
  finalizeBitGoDepositFromWebhookEvent,
  processBitGoTransferWebhookEvent,
} from "../services/custody-service/custodyWebhookProcessor.service.js";

const CUSTODY_WEBHOOK_QUEUE_NAME = "custody-webhook-processing";

let isShuttingDown = false;

const custodyWebhookWorker = new Worker(
  CUSTODY_WEBHOOK_QUEUE_NAME,
  async (job) => {
    const supportedJobNames = new Set([
      CUSTODY_WEBHOOK_JOB_NAMES.PROCESS_BITGO_TRANSFER_WEBHOOK,
      CUSTODY_WEBHOOK_JOB_NAMES.FINALIZE_BITGO_DEPOSIT,
    ]);

    if (!supportedJobNames.has(job.name)) {
      throw new Error(`Unsupported custody webhook job: ${job.name}`);
    }

    const { eventId } = job.data ?? {};

    if (!eventId || typeof eventId !== "string") {
      throw new Error("Custody webhook job eventId is required");
    }

    console.log("Custody webhook job started:", {
      jobId: job.id,
      eventId,
      attempt: job.attemptsMade + 1,
    });

    if (job.name === CUSTODY_WEBHOOK_JOB_NAMES.FINALIZE_BITGO_DEPOSIT) {
      return finalizeBitGoDepositFromWebhookEvent({
        eventId,
      });
    }

    const result = await processBitGoTransferWebhookEvent({
      eventId,
    });

    return {
      eventId,
      eventStatus: result.event.status,
      resourceType: result.resourceType,
      depositId: result.deposit?.id ?? null,
      withdrawalId: result.withdrawal?.withdrawalId ?? null,
      followUp: result.followUp ?? null,
    };
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.CUSTODY_WEBHOOK_WORKER_CONCURRENCY || 3),
  }
);

custodyWebhookWorker.on("completed", (job, result) => {
  console.log("Custody webhook job completed:", {
    jobId: job.id,
    result,
  });
});

custodyWebhookWorker.on("failed", (job, error) => {
  console.error("Custody webhook job failed:", {
    jobId: job?.id,
    name: job?.name,
    attemptsMade: job?.attemptsMade,
    error: error.message,
  });
});

custodyWebhookWorker.on("error", (error) => {
  console.error("Custody webhook worker error:", error);
});

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Received ${signal}. Closing custody webhook worker...`);

  try {
    await custodyWebhookWorker.close();

    console.log("Custody webhook worker closed");

    process.exit(0);
  } catch (error) {
    console.error("Failed to close custody webhook worker:", error);

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
  console.error("Unhandled rejection in custody webhook worker:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in custody webhook worker:", error);

  shutdown("uncaughtException");
});
