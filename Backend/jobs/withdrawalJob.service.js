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

export { enqueueApprovedWithdrawalJob };