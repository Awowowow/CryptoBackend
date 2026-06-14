import { receiveBitGoWebhookEvent } from "../services/custody-service/custodyWebhook.service.js";
import { enqueueCustodyWebhookProcessingJob } from "../jobs/custodyWebhookJob.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const receiveBitGoWebhook = asyncWrapper(async (req, res) => {
  const { event, wasCreated, shouldEnqueue } = await receiveBitGoWebhookEvent(req.body);

  let job = null;

  if (shouldEnqueue) {
    job = await enqueueCustodyWebhookProcessingJob({
      eventId: event.id,
    });
  }

  res.status(200).json({
    success: true,
    message: shouldEnqueue
      ? "BitGo webhook received and queued successfully"
      : "BitGo webhook received and queue skipped",
    data: {
      eventId: event.id,
      status: event.status,
      wasCreated,
      queued: Boolean(job),
      jobId: job?.id ?? null,
    },
  });
});


export { receiveBitGoWebhook};

