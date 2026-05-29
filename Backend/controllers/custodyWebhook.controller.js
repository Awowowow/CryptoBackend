import { receiveBitGoWebhookEvent } from "../services/custody-service/custodyWebhook.service.js";
import { fetchTransferForBitGoWebhookEvent, processBitGoTransferWebhookEvent } from "../services/custody-service/custodyWebhookProcessor.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const receiveBitGoWebhook = asyncWrapper(async (req, res) => {
  const event = await receiveBitGoWebhookEvent(req.body);

  res.status(200).json({
    success: true,
    message: "BitGo webhook received successfully",
    data: {
      eventId: event.id,
      status: event.status,
    },
  });
});

const fetchBitGoWebhookTransferForDev = asyncWrapper(async (req, res) => {
    const { eventId } = req.params;
  
    const result = await fetchTransferForBitGoWebhookEvent({
      eventId,
    });
  
    res.status(200).json({
      success: true,
      message: "BitGo webhook transfer fetched successfully",
      data: {
        event: {
          id: result.event.id,
          provider: result.event.provider,
          eventType: result.event.eventType,
          status: result.event.status,
          coin: result.event.coin,
          transferId: result.event.transferId,
        },
        networkCode: result.networkCode,
        transfer: result.transfer,
      },
    });
  });

  const processBitGoWebhookTransferForDev = asyncWrapper(async (req, res) => {
    const { eventId } = req.params;
  
    const result = await processBitGoTransferWebhookEvent({
      eventId,
    });
  
    res.status(200).json({
      success: true,
      message: "BitGo webhook transfer processed successfully",
      data: {
        event: {
          id: result.event.id,
          status: result.event.status,
          processedAt: result.event.processedAt,
        },
        deposit: result.deposit,
      },
    });
  });

export { receiveBitGoWebhook, fetchBitGoWebhookTransferForDev, processBitGoWebhookTransferForDev};