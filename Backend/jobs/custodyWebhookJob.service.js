import {
  CUSTODY_WEBHOOK_JOB_NAMES,
  custodyWebhookQueue,
} from "../queues/custodyWebhook.queue.js";

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

const enqueueBitGoDepositFinalizationJob = async ({
  eventId,
  delayMs = 0,
}) => {
  const jobIdSuffix = delayMs > 0 ? Date.now() : "initial";

  return custodyWebhookQueue.add(
    CUSTODY_WEBHOOK_JOB_NAMES.FINALIZE_BITGO_DEPOSIT,
    {
      eventId,
    },
    {
      jobId: `custody-webhook-finalize-deposit-${eventId}-${jobIdSuffix}`,
      delay: delayMs,
      attempts: 20,
      backoff: {
        type: "exponential",
        delay: 10000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    }
  );
};

export {
  enqueueBitGoDepositFinalizationJob,
  enqueueCustodyWebhookProcessingJob,
};
