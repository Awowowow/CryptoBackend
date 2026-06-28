import express from 'express';
import { receiveBitGoWebhook } from '../controllers/custodyWebhook.controller.js';
import validateBitGoWebhookPayload from '../middleware/validateBitGoWebhookPayload.js';

const webhookRouter = express.Router();

webhookRouter.post("/custody/bitgo", validateBitGoWebhookPayload, receiveBitGoWebhook);



export default webhookRouter;
