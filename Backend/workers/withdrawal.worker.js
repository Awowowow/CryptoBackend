import "dotenv/config";
import {
  redisConnection,
  WITHDRAWAL_JOB_NAMES,
  WITHDRAWAL_QUEUE_NAME,
} from "../queues/withdrawal.queue.js";
import { Worker } from "bullmq";
import { processApprovedWithdrawal } from "../services/wallet-ledger-service/withdrawalProcessor.service.js";

let isShuttingDown = false;

const withdrawalWorker = new Worker(
  WITHDRAWAL_QUEUE_NAME,
  async (job) => {
    if (job.name != WITHDRAWAL_JOB_NAMES.PROCESS_APPROVED_WITHDRAWAL) {
      throw new Error(`Unsupported Withdrawal job: ${job.name}`);
    }

    const { withdrawalId } = job.data ?? {};
    if (!withdrawalId || typeof withdrawalId !== "string") {
        throw new Error("Withdrawal job withdrawalId is required");
      }
    console.log("Withdrawal job started:", {
      jobId: job.id,
      withdrawalId,
      attempt: job.attemptsMade + 1,
    });
    return processApprovedWithdrawal({
      withdrawalId,
    });
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.WITHDRAWAL_WORKER_CONCURRENCY || 3),
  }
);

withdrawalWorker.on("completed", (job, result) => {
  console.log("Withdrawal job completed:", {
    jobId: job.id,
    result,
  });
});

withdrawalWorker.on("failed", (job, error) => {
  console.error("Withdrawal job failed:", {
    jobId: job?.id,
    name: job?.name,
    attemptsMade: job?.attemptsMade,
    error: error.message,
  });
});

withdrawalWorker.on("error", (error) => {
  console.error("Withdrawal worker error:", error);
});


const shutdown = async (signal) => {
    if (isShuttingDown){
        return;
    }
    isShuttingDown = true;
    console.log(`Received ${signal}. Closing withdrawal worker...`);

    try{
        await withdrawalWorker.close();
        console.log("Withdrawal worker closed.");
        process.exit(0);
    } catch(error){
        console.error("Failed to close withdrawal worker:", error);
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
    console.error("Unhandled rejection in withdrawal worker:", reason);
  });
  
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception in withdrawal worker:", error);
  
    shutdown("uncaughtException");
  });
