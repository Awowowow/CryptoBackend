const KYC_AUDIT_ACTIONS = {
    SUBMITTED: "SUBMITTED",
    DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
    REVIEW_APPROVED: "REVIEW_APPROVED",
    REVIEW_REJECTED: "REVIEW_REJECTED",
  };
  
  const createKycAuditLog = async ({
    tx,
    submissionId,
    actorUserId,
    action,
    fromStatus = null,
    toStatus = null,
    reason = null,
  }) => {
    return tx.kycAuditLog.create({
      data: {
        submissionId,
        actorUserId,
        action,
        fromStatus,
        toStatus,
        reason,
      },
    });
  };
  
  export {
    createKycAuditLog,
    KYC_AUDIT_ACTIONS,
  };