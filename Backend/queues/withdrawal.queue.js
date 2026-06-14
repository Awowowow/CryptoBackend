import { Queue } from "bullmq";

const redisConnection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
}

const WITHDRAWAL_QUEUE_NAME = "withdrawal-processing";

const WITHDRAWAL_JOB_NAMES = Object.freeze({
    PROCESS_APPROVED_WITHDRAWAL: "process-approved-withdrawal",
    FINALIZE_SUBMITTED_WITHDRAWAL: "finalize-submitted-withdrawal",
})

const withdrawalQueue = new Queue(WITHDRAWAL_QUEUE_NAME,{
    connection: redisConnection,
});

export { WITHDRAWAL_QUEUE_NAME, redisConnection, withdrawalQueue, WITHDRAWAL_JOB_NAMES };