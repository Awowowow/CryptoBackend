import { Worker } from "bullmq";
import {
  CUSTODY_WEBHOOK_JOB_NAMES,
  CUSTODY_WEBHOOK_QUEUE_NAME,
  redisConnection,
} from "../queues/custodyWebhook.queue.js";
import { processBitGoTransferWebhookEvent } from "../services/custody-service/custodyWebhookProcessor.service.js";

const custodyWebhookWorker = new Worker(
    CUSTODY_WEBHOOK_QUEUE_NAME,
    async (job) => {
      if (job.name !== CUSTODY_WEBHOOK_JOB_NAMES.PROCESS_BITGO_TRANSFER_WEBHOOK) {
        throw new Error(`Unsupported custody webhook job: ${job.name}`);
      }
  
      const { eventId } = job.data;
  
      if (!eventId || typeof eventId !== "string") {
        throw new Error("Custody webhook job eventId is required");
      }
  
      return processBitGoTransferWebhookEvent({
        eventId,
      });
    },
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );
  
  custodyWebhookWorker.on("completed", (job) => {
    console.log(`Custody webhook job completed: ${job.id}`);
  });
  
  custodyWebhookWorker.on("failed", (job, error) => {
    console.error(
      `Custody webhook job failed: ${job?.id}`,
      error.message
    );
  });
  
  export { custodyWebhookWorker };