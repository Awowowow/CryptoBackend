import {
  CUSTODY_WEBHOOK_JOB_NAMES,
  custodyWebhookQueue,
} from "../../queues/custodyWebhook.queue.js";

const enqueueCustodyWebhookProcessingJob = async ({ eventId }) => {
  return custodyWebhookQueue.add(
    CUSTODY_WEBHOOK_JOB_NAMES.PROCESS_BITGO_TRANSFER_WEBHOOK,
    {
      eventId,
    },
    {
      jobId: `custody-webhook-${eventId}`,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    }
  );
};

export { enqueueCustodyWebhookProcessingJob };