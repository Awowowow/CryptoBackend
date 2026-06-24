import express from "express";
import requireAdmin from "../middleware/requireAdmin.js";
import authentication from "../middleware/authentication.js";
import { adminActionRateLimiter } from "../middleware/rate-limiters/index.js";
import {
  getKycSubmissionDetailsForAdmin,
  getKycSubmissionsForAdmin,
  reviewKycApplication,
} from "../controllers/adminKyc.controller.js";

const adminRouter = express.Router();

adminRouter.use(authentication);
adminRouter.use(requireAdmin);
adminRouter.use(adminActionRateLimiter);

adminRouter.get( "/kyc/submissions", getKycSubmissionsForAdmin);

adminRouter.get("/kyc/submissions/:submissionId", getKycSubmissionDetailsForAdmin);

adminRouter.patch("/kyc/submissions/:submissionId/review", reviewKycApplication);

export default adminRouter;