import express from 'express';
import { fetchBitGoWebhookTransferForDev, processBitGoWebhookTransferForDev, receiveBitGoWebhook } from '../controllers/custodyWebhook.controller.js';

const webhookRouter = express.Router();

webhookRouter.post("/custody/bitgo", receiveBitGoWebhook);

webhookRouter.post(
    "/custody/bitgo/events/:eventId/fetch-transfer",
    fetchBitGoWebhookTransferForDev
  );

  webhookRouter.post(
    "/custody/bitgo/events/:eventId/process-transfer",
    processBitGoWebhookTransferForDev
  );

export default webhookRouter;