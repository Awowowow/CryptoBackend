import { WITHDRAWAL_JOB_NAMES, withdrawalQueue } from "../queues/withdrawal.queue.js";

const enqueueApprovedWithdrawalJob = async({withdrawalId}) => {
    return withdrawalQueue.add(WITHDRAWAL_JOB_NAMES.PROCESS_APPROVED_WITHDRAWAL,
        {
            withdrawalId,
        },
        {
            jobId: `withdrawal-${withdrawalId}`,
            attempts: 5,
            backoff:{
                type: "exponential",
                delay: 5000
            },
            removeOnComplete: 1000,
            removeOnFail: 5000
        }
    );
};

const enqueueSubmittedWithdrawalFinalizationJob = async ({
    withdrawalId,
    delayMs = 0,
  }) => {
    const jobIdSuffix = delayMs > 0 ? Date.now() : "initial";
  
    return withdrawalQueue.add(
      WITHDRAWAL_JOB_NAMES.FINALIZE_SUBMITTED_WITHDRAWAL,
      {
        withdrawalId,
      },
      {
        jobId: `withdrawal-finalize-${withdrawalId}-${jobIdSuffix}`,
        delay: delayMs,
        attempts: 10,
        backoff: {
          type: "exponential",
          delay: 10000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }
    );
  };

export { enqueueApprovedWithdrawalJob, enqueueSubmittedWithdrawalFinalizationJob };