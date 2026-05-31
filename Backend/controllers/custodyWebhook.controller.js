import { receiveBitGoWebhookEvent } from "../services/custody-service/custodyWebhook.service.js";
import { enqueueCustodyWebhookProcessingJob } from "../services/custody-service/custodyWebhookJob.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const receiveBitGoWebhook = asyncWrapper(async (req, res) => {
  const event = await receiveBitGoWebhookEvent(req.body);

  const job = await enqueueCustodyWebhookProcessingJob({
    eventId: event.id,
  })

  res.status(200).json({
    success: true,
    message: "BitGo webhook received successfully",
    data: {
      eventId: event.id,
      status: event.status,
      jobId: job.id,
    },
  });
});


export { receiveBitGoWebhook};
