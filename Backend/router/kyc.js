import express from 'express';
import authentication from '../middleware/authentication.js';
import { getMyKycStatus, submitKycApplication } from '../controllers/kyc.controller.js';
import uploadMyKycDocument from '../middleware/uploadKycDocument.js';
import uploadKycDocument from '../middleware/uploadKycDocument.js';

const kycRouter = express.Router();

kycRouter.get("/status", authentication, getMyKycStatus)

kycRouter.post("/submit", authentication, submitKycApplication);

kycRouter.post("/documents", authentication, uploadKycDocument, uploadMyKycDocument);

export {kycRouter}

