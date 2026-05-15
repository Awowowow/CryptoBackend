import { KycStatus } from "@prisma/client";
import AppError from "../utils/appError.js";


const REVIEWABLE_KYC_STATUSES = [
  KycStatus.PENDING,
  KycStatus.APPROVED,
  KycStatus.REJECTED,
];

const FINAL_REVIEW_STATUSES = [
  KycStatus.APPROVED,
  KycStatus.REJECTED,
];

const validateKycStatusFilter = (status) => {
  if (!status) {
    return undefined;
  }

  if (!REVIEWABLE_KYC_STATUSES.includes(status)) {
    throw new AppError("Invalid KYC status filter", 400);
  }

  return status;
};

const validateKycReviewInput = ({ status, rejectionReason }) => {
  if (!status) {
    throw new AppError("Review status is required", 400);
  }

  if (!FINAL_REVIEW_STATUSES.includes(status)) {
    throw new AppError("Review status must be APPROVED or REJECTED", 400);
  }

  if (status === KycStatus.REJECTED) {
    if (typeof rejectionReason !== "string" || !rejectionReason.trim()) {
      throw new AppError("Rejection reason is required", 400);
    }
  }

  return {
    status,
    rejectionReason:
      status === KycStatus.REJECTED ? rejectionReason.trim() : null,
  };
};

export {
  validateKycReviewInput,
  validateKycStatusFilter,
};
