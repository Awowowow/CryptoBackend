import redisClient from "../../config/redis.js";
import AppError from "../../utils/AppError.js";

const RECENT_TWO_FA_TTL_SECONDS = 15 * 60; 

const buildRecentTwoFaKey = ({userId, sessionId}) =>{
    return `twofa:recent:${userId}:${sessionId}`;
}

const markRecentTwoFa = async({userId, sessionId}) =>{
    await redisClient.setEx(
        buildRecentTwoFaKey({userId, sessionId}),
        RECENT_TWO_FA_TTL_SECONDS,
        "verified"
    );
};

const requireRecentTwoFa = async({userId, sessionId}) =>{
    const recentTwoFa = await redisClient.get(
        buildRecentTwoFaKey({userId, sessionId})
    );

    if(!recentTwoFa){
        throw new AppError("Recent 2FA verification required", 403);
    }
    return true
}

export{requireRecentTwoFa, markRecentTwoFa}

