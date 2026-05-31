import { Queue } from "bullmq";

const redisConnection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIT_PORT || 6379)
}

const CUSTODY_WEBHOOK_QUEUE_NAME = "custody-webhook-processing";

const CUSTODY_WEBHOOK_JOB_NAMES = Object.freeze({
    PROCESS_BITGO_TRANSFER_WEBHOOK: "process-bitgo-transfer-webhook",
})

const custodyWebhookQueue = new Queue(CUSTODY_WEBHOOK_QUEUE_NAME, {
    connection: redisConnection,
});

export {
    CUSTODY_WEBHOOK_JOB_NAMES,
    custodyWebhookQueue,
    redisConnection,
    CUSTODY_WEBHOOK_QUEUE_NAME
  };