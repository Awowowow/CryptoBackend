import express from 'express';
import authentication from '../middleware/authentication.js';
import {
    getMyKycStatus,
    submitKycApplication,
    uploadMyKycDocument,
  } from "../controllers/kyc.controller.js";
import uploadKycDocument from "../middleware/uploadKycDocument.js";
import { kycSubmitRateLimiter } from '../middleware/rate-limiters/index.js';
const kycRouter = express.Router();

kycRouter.get("/status", authentication, getMyKycStatus)

kycRouter.post("/submit", authentication, kycSubmitRateLimiter , submitKycApplication);

kycRouter.post(
    "/documents",
    authentication,
    kycSubmitRateLimiter,
    uploadKycDocument,
    uploadMyKycDocument
  );

export {kycRouter}

 