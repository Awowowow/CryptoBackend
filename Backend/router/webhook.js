import express from 'express';
import { receiveBitGoWebhook } from '../controllers/custodyWebhook.controller.js';
import verifyBitGoWebhookSignature from '../middleware/verifyBitGoWebhookSignature.js';
import preventBitGoWebhookReplay from '../middleware/preventBitGoWebhookReplay.js';
import validateBitGoWebhookPayload from '../middleware/validateBitGoWebhookPayload.js';

const webhookRouter = express.Router();

webhookRouter.post("/custody/bitgo",verifyBitGoWebhookSignature,preventBitGoWebhookReplay,validateBitGoWebhookPayload, receiveBitGoWebhook);



export default webhookRouter;