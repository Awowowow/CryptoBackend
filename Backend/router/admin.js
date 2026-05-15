import express from 'express';
import requireAdmin from "../middleware/requireAdmin.js";
import authentication from '../middleware/authentication.js';
import { getKycSubmissionsForAdmin, reviewKycApplication } from '../controllers/adminKyc.controller.js';

const adminRouter = express.Router();


adminRouter.get(
    "/kyc/submissions",
    authentication,
    requireAdmin,
    getKycSubmissionsForAdmin
  );

adminRouter.patch(
    "/kyc/submissions/:submissionId/review",
    authentication,
    requireAdmin,
    reviewKycApplication
);
  
export default adminRouter