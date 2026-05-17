import { getKycStatus, submitKyc, uploadKycDocumentForSubmission } from "../services/user-kyc-service/kyc.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";
import { validateKycInput } from "../validators/kyc.validator.js";
import { validateKycDocumentUploadInput } from "../validators/kycDoument.validator.js";


const submitKycApplication = asyncWrapper(async (req, res) => {
    const userId = req.user.userId;

    const payload = validateKycInput(req.body ?? {});

    const submission = await submitKyc({userId, payload});

    res.status(201).json({
        success: true,
        message: "KYC submitted successfully",
        data: submission,
    });
});

const getMyKycStatus = asyncWrapper(async(req,res)=>{
    const userId = req.user.userId;

    const submission = await getKycStatus(userId);

    res.status(200).json({
        success: true,
        message: "KYC status retrieved successfully",
        data: submission
    });
})

const uploadMyKycDocument = asyncWrapper(async(req,res)=>{
    const userId = req.user.userId;

    const {fileType} = validateKycDocumentUploadInput(req.body ?? {});

    const document = await uploadKycDocumentForSubmission({
        userId,
        fileType,
        file: req.file,
    });

    res.status(200).json({
        success: true,
        message: "KYC document uploaded successfully",
        data: document,
    });
})

export {submitKycApplication, getMyKycStatus , uploadMyKycDocument} 