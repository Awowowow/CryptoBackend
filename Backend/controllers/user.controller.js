import { getUserProfile } from "../services/user-kyc-service/userProfile.service.js";

import asyncWrapper from "../utils/asyncWrapper.js";


const getProfile = asyncWrapper(async(req, res) => {
    const userId = req.user.userId;

    const profile = await getUserProfile(userId);

    res.status(200).json({
        success: true,
        message: "User profile fetched successfully",
        data: profile,
    })
})

export {getProfile}