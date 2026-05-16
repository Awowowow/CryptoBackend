import {
  getKycSubmissionForAdmin,
    listKycSubmissionsForAdmin,
    reviewKycSubmission,
  } from "../services/user-kyc-service/kyc.service.js";
  import asyncWrapper from "../utils/asyncWrapper.js";
  import {
    validateKycReviewInput,
    validateKycStatusFilter,
  } from "../validators/adminKyc.validator.js";
  
const getKycSubmissionsForAdmin = asyncWrapper(async (req, res) => {
    const status = validateKycStatusFilter(req.query.status);
  
    const submissions = await listKycSubmissionsForAdmin({
      status,
    });
  
    res.status(200).json({
      success: true,
      message: "KYC submissions fetched successfully",
      data: submissions,
    });
  });
  
const reviewKycApplication = asyncWrapper(async (req, res) => {
    const { submissionId } = req.params;
    const reviewedByUserId = req.user.userId
  
    const { status: reviewStatus, rejectionReason } = validateKycReviewInput(
      req.body ?? {}
    );
  
    const submission = await reviewKycSubmission({
      submissionId,
      reviewStatus,
      rejectionReason,
      reviewedByUserId,
    });
  
    res.status(200).json({
      success: true,
      message: "KYC submission reviewed successfully",
      data: submission,
    });
  });

const getKycSubmissionDetailsForAdmin = asyncWrapper(async (req, res) => {
    const { submissionId } = req.params;
  
    const submission = await getKycSubmissionForAdmin(submissionId);
  
    res.status(200).json({
      success: true,
      message: "KYC submission details fetched successfully",
      data: submission,
    });
  });
  
  export {
    getKycSubmissionsForAdmin,
    reviewKycApplication,
    getKycSubmissionDetailsForAdmin,
  };